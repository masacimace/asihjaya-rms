import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertIncludes(source: string, needle: string, message: string) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

function assertExcludes(source: string, needle: string, message: string) {
  if (source.includes(needle)) {
    throw new Error(message);
  }
}

const loginPage = readSource("src/app/(public)/login/page.tsx");
const loginForm = readSource("src/components/auth/login-form.tsx");

assertIncludes(
  loginPage,
  'src="/logo/asihjaya-brand-icon.png"',
  "Header login harus memakai brand icon yang sama dengan navigation shell.",
);
assertIncludes(
  loginPage,
  'src="/logo/asihjaya-brand-text.png"',
  "Header login harus memakai brand text yang sama dengan navigation shell.",
);
assertIncludes(
  loginPage,
  "Management Dashboard",
  "Subtitle brand login harus konsisten dengan navigation shell.",
);
assertExcludes(
  loginPage,
  "<Store",
  "Header login tidak boleh kembali memakai placeholder icon Store.",
);
assertIncludes(
  loginPage,
  'minHeight: "100dvh"',
  "Login page harus memakai dynamic viewport height pada browser mobile.",
);
assertIncludes(
  loginPage,
  "flex min-h-screen flex-col items-center",
  "Login page harus memakai flex column dan horizontal centering pada semua viewport.",
);
assertIncludes(
  loginPage,
  "relative z-10 my-auto w-full max-w-md",
  "Card login harus center saat cukup ruang dan tetap terbaca saat viewport pendek.",
);
assertIncludes(
  loginPage,
  'className="pointer-events-none absolute inset-0 overflow-hidden"',
  "Dekorasi login harus dipotong pada layer terpisah agar tidak menambah area scroll.",
);
assertIncludes(
  loginPage,
  "env(safe-area-inset-top)",
  "Login page harus menghormati safe area bagian atas.",
);
assertIncludes(
  loginPage,
  "env(safe-area-inset-bottom)",
  "Login page harus menghormati safe area bagian bawah.",
);
assertExcludes(
  loginPage,
  "overflow-y-auto",
  "Main login tidak boleh menjadi scroll container ketika konten masih muat.",
);
assertExcludes(
  loginForm,
  "autoFocus",
  "Login mobile tidak boleh membuka virtual keyboard otomatis saat halaman dimuat.",
);
assertIncludes(
  loginForm,
  'enterKeyHint="next"',
  "Input identifier harus memberi action hint next pada keyboard mobile.",
);
assertIncludes(
  loginForm,
  'enterKeyHint="go"',
  "Input password harus memberi action hint go pada keyboard mobile.",
);

console.log(
  "OK: login memakai brand navigation yang terpusat, center pada desktop dan mobile, memakai dynamic viewport, safe area, natural page scroll, dan dekorasi tidak menambah overflow.",
);
