import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const target = path.join(
  root,
  "src/components/buybacks/buyback-processing-workspace.tsx",
);

assert(existsSync(target), "buyback-processing-workspace.tsx tidak ditemukan.");

const source = readFileSync(target, "utf8");

assert(
  source.includes("function ProcessingDrawer({") &&
    source.includes("<ProcessingDrawer"),
  "Processing shell belum berubah menjadi drawer.",
);

assert(
  source.includes(
    'className="fixed inset-0 z-[70] bg-black/35 lg:flex lg:justify-end"',
  ),
  "Backdrop desktop drawer belum benar.",
);

assert(
  source.includes(
    'className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white lg:w-[min(720px,calc(100vw-48px))] lg:border-l lg:border-[var(--border)]"',
  ),
  "Responsive fullscreen / desktop drawer sizing belum benar.",
);

assert(
  source.includes(
    'className="shrink-0 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-white px-4 py-4 sm:px-5 lg:px-6"',
  ),
  "Drawer header wajib tetap berada di luar scroll area.",
);

assert(
  source.includes(
    'className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5 lg:p-6"',
  ),
  "Form drawer wajib scroll secara internal.",
);

assert(
  source.includes('document.body.style.overflow = "hidden"') &&
    source.includes("document.body.style.overflow = previousOverflow"),
  "Background page scroll lock belum lengkap.",
);

assert(
  !source.includes("function ProcessingDialog({") &&
    !source.includes("<ProcessingDialog"),
  "Nama ProcessingDialog lama masih ditemukan.",
);

assert(
  !source.includes(
    'mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-2xl',
  ),
  "Shell modal lama masih ditemukan.",
);

console.log(
  "OK: Processing drawer V2 valid — desktop right drawer + responsive fullscreen.",
);
