import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.PDF_RENDER_TOKEN_SECRET ??=
  "check-only-pdf-render-token-secret-with-at-least-32-characters";

const {
  authorizePdfRenderDocument,
  authorizePdfRenderMedia,
  issuePdfRenderCapability,
  PDF_RENDER_TOKEN_HEADER,
} = await import("@/features/sales/documents/pdf-render-access");

const organizationId = "11111111-1111-4111-8111-111111111111";
const saleId = "22222222-2222-4222-8222-222222222222";
const buybackId = "66666666-6666-4666-8666-666666666666";
const allowedImageKey =
  `organizations/${organizationId}/items/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.webp`;

const capability = issuePdfRenderCapability({
  scope: "receipt-sale",
  organizationId,
  saleId,
  documentProfileId: "receipt_a4_landscape_v1",
  renderMode: "full_design",
  allowedMediaKeys: [allowedImageKey],
});

assert.ok(capability.token.length > 64);
assert.equal(PDF_RENDER_TOKEN_HEADER, "x-asihjaya-pdf-render-token");

const documentAccess = authorizePdfRenderDocument({
  token: capability.token,
  scope: "receipt-sale",
  saleId,
  documentProfileId: "receipt_a4_landscape_v1",
  renderMode: "full_design",
});
assert.equal(documentAccess?.organizationId, organizationId);

assert.equal(
  authorizePdfRenderDocument({
    token: capability.token,
    scope: "receipt-sale",
    saleId: "55555555-5555-4555-8555-555555555555",
    documentProfileId: "receipt_a4_landscape_v1",
    renderMode: "full_design",
  }),
  null,
);

assert.equal(
  authorizePdfRenderMedia({
    token: capability.token,
    imageKey: allowedImageKey,
  })?.saleId,
  saleId,
);
assert.equal(
  authorizePdfRenderMedia({
    token: capability.token,
    imageKey: allowedImageKey.replace("items", "products"),
  }),
  null,
);

const buybackCapability = issuePdfRenderCapability({
  scope: "receipt-buyback",
  organizationId,
  buybackId,
  documentProfileId: "receipt_a4_landscape_v1",
  renderMode: "preprinted_overlay",
  allowedMediaKeys: [allowedImageKey],
});
const buybackAccess = authorizePdfRenderDocument({
  token: buybackCapability.token,
  scope: "receipt-buyback",
  buybackId,
  documentProfileId: "receipt_a4_landscape_v1",
  renderMode: "preprinted_overlay",
});
assert.equal(buybackAccess?.organizationId, organizationId);
assert.equal(buybackAccess?.buybackId, buybackId);
assert.equal(buybackAccess?.saleId, null);
assert.equal(
  authorizePdfRenderDocument({
    token: buybackCapability.token,
    scope: "receipt-sale",
    saleId,
    documentProfileId: "receipt_a4_landscape_v1",
    renderMode: "preprinted_overlay",
  }),
  null,
);
buybackCapability.release();

const tamperedToken = `${capability.token.slice(0, -1)}${
  capability.token.endsWith("A") ? "B" : "A"
}`;
assert.equal(
  authorizePdfRenderDocument({
    token: tamperedToken,
    scope: "receipt-sale",
    saleId,
    documentProfileId: "receipt_a4_landscape_v1",
    renderMode: "full_design",
  }),
  null,
);

capability.release();
assert.equal(
  authorizePdfRenderDocument({
    token: capability.token,
    scope: "receipt-sale",
    saleId,
    documentProfileId: "receipt_a4_landscape_v1",
    renderMode: "full_design",
  }),
  null,
);

const rendererSource = await readFile(
  "src/features/sales/documents/receipt-certificate-pdf.tsx",
  "utf8",
);
const saleRouteSource = await readFile(
  "src/app/api/sales/[saleId]/receipt-certificate/route.ts",
  "utf8",
);
const previewRouteSource = await readFile(
  "src/app/api/sales/receipt-certificate-preview/route.ts",
  "utf8",
);

assert.ok(rendererSource.includes("PDF_RENDER_MAX_QUEUE"));
assert.ok(rendererSource.includes("external_request_blocked"));
assert.ok(rendererSource.includes("PDF_RENDER_TOKEN_HEADER"));
assert.ok(!rendererSource.includes("cookieHeader"));
assert.ok(!rendererSource.includes('"x-hardware-agent-secret"'));
assert.ok(!saleRouteSource.includes("cookieHeader"));
assert.ok(!saleRouteSource.includes("extraHeaders"));
assert.ok(!previewRouteSource.includes("getHardwareAgentHeaders"));
assert.ok(!saleRouteSource.includes("receipt-certificate-html`,\n    request.url"));
assert.ok(!previewRouteSource.includes("receipt-certificate-preview-html\",\n    request.url"));

console.log("PDF render security checks passed.");
