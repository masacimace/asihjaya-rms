import type { ReceiptCertificateData } from "./receipt-certificate";

const DEFAULT_RECEIPT_INSTAGRAM = "@asihjaya.bantargebang";

export type ReceiptOutletCopy = {
  name: string;
  address: string;
  phone: string;
  instagramHandle: string;
};

function readEnvText(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    return null;
  }

  return value;
}

function normalizeText(value: string | null | undefined, fallback: string) {
  const text = value?.trim();

  if (!text) {
    return fallback;
  }

  return text;
}

function normalizeInstagramHandle(value: string | null | undefined) {
  const handle = normalizeText(value, DEFAULT_RECEIPT_INSTAGRAM);

  if (handle.startsWith("@")) {
    return handle;
  }

  return `@${handle}`;
}

export function formatReceiptWhatsapp(phone: string) {
  return `Whatsapp: ${phone}`;
}

export function formatReceiptInstagram(instagramHandle: string) {
  return `Instagram: ${instagramHandle}`;
}

export function resolveReceiptRuntimeOutletCopy(
  data: ReceiptCertificateData,
): ReceiptOutletCopy {
  return {
    name: normalizeText(data.outlet.name, "Outlet Asihjaya"),
    address: normalizeText(data.outlet.address, "Alamat outlet belum diatur"),
    phone: normalizeText(data.outlet.phone, "-"),
    instagramHandle: normalizeInstagramHandle(
      readEnvText("RECEIPT_OUTLET_INSTAGRAM"),
    ),
  };
}

export function resolveReceiptVendorStaticOutletCopy(
  data: ReceiptCertificateData,
): ReceiptOutletCopy {
  return {
    name: normalizeText(
      readEnvText("RECEIPT_VENDOR_OUTLET_NAME"),
      data.outlet.name,
    ),
    address: normalizeText(
      readEnvText("RECEIPT_VENDOR_OUTLET_ADDRESS"),
      data.outlet.address ?? "Alamat outlet belum diatur",
    ),
    phone: normalizeText(
      readEnvText("RECEIPT_VENDOR_OUTLET_PHONE"),
      data.outlet.phone ?? "-",
    ),
    instagramHandle: normalizeInstagramHandle(
      readEnvText("RECEIPT_VENDOR_OUTLET_INSTAGRAM") ??
        readEnvText("RECEIPT_OUTLET_INSTAGRAM"),
    ),
  };
}
