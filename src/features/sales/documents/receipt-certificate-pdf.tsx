import {
  issuePdfRenderCapability,
  PDF_RENDER_TOKEN_HEADER,
  type PdfRenderCapabilityInput,
} from "./pdf-render-access";
import {
  DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  resolveReceiptDocumentProfile,
  type ReceiptDocumentProfileId,
} from "./receipt-document-profiles";
import type { ReceiptCertificateRenderMode } from "./receipt-certificate-render-modes";
import { validateReceiptPdfBuffer } from "./receipt-pdf-contract";
import { serverEnv } from "@/lib/env";

type PdfRoute = {
  abort: () => Promise<void>;
  continue: () => Promise<void>;
  request: () => {
    url: () => string;
  };
};

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
  route: (
    matcher: string,
    handler: (route: PdfRoute) => Promise<void>,
  ) => Promise<void>;
  setDefaultNavigationTimeout: (timeout: number) => void;
  setDefaultTimeout: (timeout: number) => void;
  setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
};

type PdfBrowser = {
  close: () => Promise<void>;
  isConnected?: () => boolean;
  newPage: (options: {
    deviceScaleFactor: number;
    viewport: { width: number; height: number };
  }) => Promise<PdfBrowserPage>;
  on?: (event: "disconnected", handler: () => void) => void;
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
  reject: (error: Error) => void;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

type PdfRendererState = {
  browserPromise: Promise<PdfBrowser> | null;
  activeRenderCount: number;
  shutdownHooksInstalled: boolean;
  renderQueue: QueueWaiter[];
};

type PdfRendererGlobal = typeof globalThis & {
  __asihjayaPdfRendererState?: PdfRendererState;
};

type GenerateReceiptCertificatePdfInput = {
  documentProfileId?: ReceiptDocumentProfileId;
  renderMode: ReceiptCertificateRenderMode;
  access: Omit<
    PdfRenderCapabilityInput,
    "documentProfileId" | "renderMode"
  >;
};

const PDF_RENDER_TIMEOUT_MS = getPositiveIntegerEnv(
  "PDF_RENDER_TIMEOUT_MS",
  45_000,
);
const PDF_RENDER_QUEUE_WAIT_TIMEOUT_MS = getPositiveIntegerEnv(
  "PDF_RENDER_QUEUE_WAIT_TIMEOUT_MS",
  15_000,
);
const PDF_RENDER_MAX_CONCURRENCY = getPositiveIntegerEnv(
  "PDF_RENDER_MAX_CONCURRENCY",
  1,
);
const PDF_RENDER_MAX_QUEUE = getPositiveIntegerEnv("PDF_RENDER_MAX_QUEUE", 10);
const PDF_RENDER_DISABLE_SANDBOX = getBooleanEnv(
  "PDF_RENDER_DISABLE_SANDBOX",
  false,
);

function getRendererState(): PdfRendererState {
  const globalState = globalThis as PdfRendererGlobal;

  if (!globalState.__asihjayaPdfRendererState) {
    globalState.__asihjayaPdfRendererState = {
      browserPromise: null,
      activeRenderCount: 0,
      shutdownHooksInstalled: false,
      renderQueue: [],
    };
  }

  return globalState.__asihjayaPdfRendererState;
}

export class PdfRenderCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRenderCapacityError";
  }
}

export class PdfRenderTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRenderTimeoutError";
  }
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

function logPdfRender(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>,
) {
  const payload = JSON.stringify({
    component: "receipt-pdf-renderer",
    event,
    ...details,
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.info(payload);
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

async function closeBrowser() {
  const state = getRendererState();
  const pendingBrowser = state.browserPromise;
  state.browserPromise = null;

  if (!pendingBrowser) {
    return;
  }

  try {
    const browser = await pendingBrowser;
    await browser.close();
  } catch {
    // Browser mungkin sudah terputus ketika proses shutdown.
  }
}

function installShutdownHooks() {
  const state = getRendererState();

  if (state.shutdownHooksInstalled) {
    return;
  }

  state.shutdownHooksInstalled = true;
  const shutdown = () => {
    void closeBrowser();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

async function getBrowser() {
  installShutdownHooks();

  const state = getRendererState();

  if (!state.browserPromise) {
    const args = PDF_RENDER_DISABLE_SANDBOX
      ? ["--no-sandbox", "--disable-setuid-sandbox"]
      : [];

    state.browserPromise = importPlaywright()
      .then(({ chromium }) =>
        chromium.launch({
          args,
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() ||
            undefined,
          headless: true,
        }),
      )
      .then((browser) => {
        browser.on?.("disconnected", () => {
          state.browserPromise = null;
          logPdfRender("warn", "browser_disconnected", {});
        });

        return browser;
      })
      .catch((error) => {
        state.browserPromise = null;
        throw error;
      });
  }

  const browser = await state.browserPromise;
  if (browser.isConnected && !browser.isConnected()) {
    state.browserPromise = null;
    return getBrowser();
  }
  return browser;
}

async function acquireRenderSlot() {
  const state = getRendererState();
  const queuedAt = Date.now();

  if (state.activeRenderCount < PDF_RENDER_MAX_CONCURRENCY) {
    state.activeRenderCount += 1;
    return 0;
  }

  if (state.renderQueue.length >= PDF_RENDER_MAX_QUEUE) {
    throw new PdfRenderCapacityError(
      "Antrean render PDF sedang penuh. Silakan coba kembali.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const waiter: QueueWaiter = {
      reject,
      resolve: () => {
        clearTimeout(waiter.timer);
        resolve();
      },
      timer: setTimeout(() => {
        const index = state.renderQueue.indexOf(waiter);
        if (index >= 0) {
          state.renderQueue.splice(index, 1);
        }

        waiter.reject(
          new PdfRenderCapacityError(
            "Waktu tunggu antrean render PDF telah habis.",
          ),
        );
      }, PDF_RENDER_QUEUE_WAIT_TIMEOUT_MS),
    };

    state.renderQueue.push(waiter);
  });

  state.activeRenderCount += 1;
  return Date.now() - queuedAt;
}

function releaseRenderSlot() {
  const state = getRendererState();
  state.activeRenderCount = Math.max(0, state.activeRenderCount - 1);
  state.renderQueue.shift()?.resolve();
}

function isAllowedBrowserRequest(requestUrl: string, allowedOrigin: string) {
  try {
    const url = new URL(requestUrl);

    if (["data:", "blob:", "about:"].includes(url.protocol)) {
      return true;
    }

    return url.origin === allowedOrigin;
  } catch {
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new PdfRenderTimeoutError(
              `Render PDF melewati batas waktu ${timeoutMs} ms.`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function buildInternalRenderUrl({
  access,
  documentProfileId,
  renderMode,
}: {
  access: GenerateReceiptCertificatePdfInput["access"];
  documentProfileId: ReceiptDocumentProfileId;
  renderMode: ReceiptCertificateRenderMode;
}) {
  const path =
    access.scope === "receipt-sale"
      ? `/documents/sales/${access.saleId}/receipt-certificate-html`
      : access.scope === "receipt-buyback"
        ? `/documents/buybacks/${access.buybackId}/receipt-certificate-html`
        : "/documents/sales/receipt-certificate-preview-html";
  const url = new URL(path, `${serverEnv.INTERNAL_RENDER_ORIGIN}/`);
  url.searchParams.set("profile", documentProfileId);
  url.searchParams.set("mode", renderMode);
  return url;
}

export function createPdfRenderFailureResponse(error: unknown) {
  if (error instanceof PdfRenderCapacityError) {
    return Response.json(
      { success: false, error: error.message },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "5",
        },
      },
    );
  }

  if (error instanceof PdfRenderTimeoutError) {
    return Response.json(
      {
        success: false,
        error: "Render PDF melewati batas waktu. Silakan coba kembali.",
      },
      {
        status: 504,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return null;
}

export async function generateReceiptCertificatePdf({
  access,
  documentProfileId = DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  renderMode,
}: GenerateReceiptCertificatePdfInput) {
  let queueWaitMs = 0;

  try {
    queueWaitMs = await acquireRenderSlot();
  } catch (error) {
    const state = getRendererState();
    logPdfRender("warn", "queue_rejected", {
      activeRenderCount: state.activeRenderCount,
      queuedRenderCount: state.renderQueue.length,
    });
    throw error;
  }

  const startedAt = Date.now();
  const profile = resolveReceiptDocumentProfile(documentProfileId);
  const capability = issuePdfRenderCapability({
    ...access,
    documentProfileId,
    renderMode,
  });
  const renderUrl = buildInternalRenderUrl({
    access,
    documentProfileId,
    renderMode,
  });
  const allowedOrigin = renderUrl.origin;
  const pageRef: { current: PdfBrowserPage | null } = { current: null };

  logPdfRender("info", "render_started", {
    renderId: capability.renderId,
    scope: access.scope,
    documentProfileId,
    renderMode,
    queueWaitMs,
  });

  try {
    const renderOperation = (async () => {
      const browser = await getBrowser();
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: profile.viewport,
      });
      pageRef.current = page;
      page.setDefaultTimeout(PDF_RENDER_TIMEOUT_MS);
      page.setDefaultNavigationTimeout(PDF_RENDER_TIMEOUT_MS);

      await page.route("**/*", async (route) => {
        const requestUrl = route.request().url();

        if (isAllowedBrowserRequest(requestUrl, allowedOrigin)) {
          await route.continue();
          return;
        }

        let blockedOrigin = "invalid-url";
        try {
          blockedOrigin = new URL(requestUrl).origin;
        } catch {
          // Tetap gunakan label aman tanpa mencatat URL penuh.
        }

        logPdfRender("warn", "external_request_blocked", {
          renderId: capability.renderId,
          blockedOrigin,
        });
        await route.abort();
      });

      await page.setExtraHTTPHeaders({
        [PDF_RENDER_TOKEN_HEADER]: capability.token,
      });

      await page.goto(renderUrl.toString(), {
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
    })();

    const result = await withTimeout(renderOperation, PDF_RENDER_TIMEOUT_MS);

    logPdfRender("info", "render_completed", {
      renderId: capability.renderId,
      scope: access.scope,
      durationMs: Date.now() - startedAt,
      queueWaitMs,
      pageCount: result.contract.pageCount,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "";
    const shouldRestartBrowser =
      error instanceof PdfRenderTimeoutError ||
      /browser.*closed|browser.*disconnected|target.*closed/i.test(errorMessage);

    if (shouldRestartBrowser) {
      void closeBrowser();
    }

    logPdfRender("error", "render_failed", {
      renderId: capability.renderId,
      scope: access.scope,
      durationMs: Date.now() - startedAt,
      queueWaitMs,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  } finally {
    capability.release();
    await pageRef.current?.close().catch(() => undefined);
    releaseRenderSlot();
  }
}
