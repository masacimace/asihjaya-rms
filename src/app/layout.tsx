import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "../features/sales/documents/receipt-certificate-front-client.css";
import "../features/sales/documents/receipt-certificate-back-client.css";

export const metadata: Metadata = {
  title: {
    default: "Asihjaya RMS",
    template: "Asihjaya - %s",
  },
  description: "Sistem retail jewelry Asihjaya.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
