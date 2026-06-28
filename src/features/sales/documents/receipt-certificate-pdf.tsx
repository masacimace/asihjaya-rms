type PdfBrowserPage = {
  emulateMedia: (options: { media: "screen" | "print" }) => Promise<void>;
  goto: (
    url: string,
    options: { waitUntil: "load" | "domcontentloaded" | "networkidle" },
  ) => Promise<unknown>;
  pdf: (options: {
    printBackground: boolean;
    preferCSSPageSize: boolean;
    margin: { top: string; right: string; bottom: string; left: string };
  }) => Promise<Buffer>;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
};

type PdfBrowser = {
  close: () => Promise<void>;
  newPage: (options: {
    deviceScaleFactor: number;
    viewport: { width: number; height: number };
  }) => Promise<PdfBrowserPage>;
};

type ChromiumLauncher = {
  launch: (options: {
    args: string[];
    headless: boolean;
  }) => Promise<PdfBrowser>;
};

type PlaywrightRuntime = {
  chromium: ChromiumLauncher;
};

const A5_LANDSCAPE_VIEWPORT = {
  // 210mm x 148mm at ~96 DPI. CSS @page remains the source of truth.
  width: 794,
  height: 559,
};

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

export async function generateReceiptCertificatePdfFromUrl({
  cookieHeader,
  extraHeaders,
  url,
}: {
  cookieHeader?: string | null;
  extraHeaders?: Record<string, string>;
  url: string;
}) {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });

  try {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: A5_LANDSCAPE_VIEWPORT,
    });

    const headers: Record<string, string> = {
      ...(extraHeaders ?? {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    };

    if (Object.keys(headers).length > 0) {
      await page.setExtraHTTPHeaders(headers);
    }

    await page.goto(url, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });

    return await page.pdf({
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}
