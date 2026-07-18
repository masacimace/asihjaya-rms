import {
  DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  resolveReceiptDocumentProfile,
  type ReceiptDocumentProfileId,
} from "./receipt-document-profiles";
import { validateReceiptPdfBuffer } from "./receipt-pdf-contract";

type PdfBrowserPage = {
  close: () => Promise<void>;
  emulateMedia: (options: { media: "screen" | "print" }) => Promise<void>;
  goto: (
    url: string,
    options: {
      timeout: number;
      waitUntil: "load" | "domcontentloaded" | "networkidle";
    },
  ) => Promise<unknown>;
  pdf: (options: {
    printBackground: boolean;
    preferCSSPageSize: boolean;
    margin: { top: string; right: string; bottom: string; left: string };
  }) => Promise<Buffer>;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
};

type PdfBrowser = {
  isConnected?: () => boolean;
  newPage: (options: {
    deviceScaleFactor: number;
    viewport: { width: number; height: number };
  }) => Promise<PdfBrowserPage>;
};

type ChromiumLauncher = {
  launch: (options: {
    args: string[];
    executablePath?: string;
    headless: boolean;
  }) => Promise<PdfBrowser>;
};

type PlaywrightRuntime = {
  chromium: ChromiumLauncher;
};

type QueueWaiter = {
  resolve: () => void;
};

const PDF_RENDER_TIMEOUT_MS = getPositiveIntegerEnv(
  "PDF_RENDER_TIMEOUT_MS",
  30_000,
);
const PDF_RENDER_MAX_CONCURRENCY = getPositiveIntegerEnv(
  "PDF_RENDER_MAX_CONCURRENCY",
  2,
);

let browserPromise: Promise<PdfBrowser> | null = null;
let activeRenderCount = 0;
const renderQueue: QueueWaiter[] = [];

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

async function importPlaywright() {
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<PlaywrightRuntime>;

    return await dynamicImport("playwright");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Playwright belum tersedia untuk render PDF. Jalankan npm install lalu coba ulang. Detail: ${message}`,
    );
  }
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = importPlaywright()
      .then(({ chromium }) =>
        chromium.launch({
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() ||
            undefined,
          headless: true,
        }),
      )
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }

  const browser = await browserPromise;
  if (browser.isConnected && !browser.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

async function acquireRenderSlot() {
  if (activeRenderCount < PDF_RENDER_MAX_CONCURRENCY) {
    activeRenderCount += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    renderQueue.push({ resolve });
  });
  activeRenderCount += 1;
}

function releaseRenderSlot() {
  activeRenderCount = Math.max(0, activeRenderCount - 1);
  renderQueue.shift()?.resolve();
}

export async function generateReceiptCertificatePdfFromUrl({
  cookieHeader,
  documentProfileId = DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  extraHeaders,
  url,
}: {
  cookieHeader?: string | null;
  documentProfileId?: ReceiptDocumentProfileId;
  extraHeaders?: Record<string, string>;
  url: string;
}) {
  const profile = resolveReceiptDocumentProfile(documentProfileId);
  await acquireRenderSlot();

  let page: PdfBrowserPage | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: profile.viewport,
    });

    const headers: Record<string, string> = {
      ...(extraHeaders ?? {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    };

    if (Object.keys(headers).length > 0) {
      await page.setExtraHTTPHeaders(headers);
    }

    await page.goto(url, {
      timeout: PDF_RENDER_TIMEOUT_MS,
      waitUntil: "networkidle",
    });
    await page.emulateMedia({ media: "print" });

    const pdfBuffer = await page.pdf({
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
      preferCSSPageSize: true,
      printBackground: true,
    });

    const contract = validateReceiptPdfBuffer(pdfBuffer, profile);

    return {
      buffer: pdfBuffer,
      contract,
      profile,
    };
  } finally {
    await page?.close().catch(() => undefined);
    releaseRenderSlot();
  }
}
