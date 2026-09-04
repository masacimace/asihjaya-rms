import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const page = read("src/app/(pos)/pos/buyback/pemrosesan/page.tsx");
const workspace = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);

assert(
  page.includes(
    'w-full rounded-[22px] border border-[var(--border)] bg-neutral-50 p-4 sm:p-5 lg:w-[560px] xl:w-[500px]',
  ),
  "Header Pemrosesan wajib memakai operational card yang match dengan Buyback.",
);

assert(
  page.includes("Outlet aktif") &&
    page.includes("Hasil pemrosesan") &&
    page.includes("Submit = Siap Jual") &&
    page.includes("Langsung tersedia di inventory dan POS"),
  "Konten operational card Pemrosesan belum lengkap.",
);

assert(
  page.includes(
    'mt-3 mb-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950',
  ),
  "CTA Kembali ke Buyback wajib full-width di bawah card.",
);

assert(
  workspace.includes(
    '<th className="whitespace-nowrap px-4 py-3">Berat</th>',
  ) &&
    workspace.includes(
      '<th className="whitespace-nowrap px-4 py-3">Status</th>',
    ) &&
    workspace.includes(
      '<th className="whitespace-nowrap px-4 py-3 sm:px-5">Aksi</th>',
    ),
  "Header Berat/Status/Aksi wajib nowrap.",
);

assert(
  workspace.includes('<p className="whitespace-nowrap font-medium">'),
  "Nilai Berat wajib tetap satu baris.",
);

assert(
  workspace.includes(
    'inline-flex whitespace-nowrap rounded-full bg-red-50',
  ) &&
    workspace.includes(
      'inline-flex whitespace-nowrap rounded-full bg-emerald-50',
    ),
  "Badge Status wajib tetap satu baris.",
);

assert(
  workspace.includes(
    'inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-neutral-950',
  ),
  "Button Proses Cuci/Rongsok wajib tetap satu baris.",
);

console.log(
  "OK: Processing page refinement V2 valid — matched header + nowrap summary.",
);
