import { ShieldCheck, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentAuth, getDefaultRoute } from "@/lib/auth/session";

export const metadata = {
  title: "Login",
};

export default async function LoginPage() {
  const auth = await getCurrentAuth();

  if (auth) {
    redirect(getDefaultRoute(auth.permissionCodes));
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--background)] p-5">
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-[var(--accent-soft)] blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 -right-32 size-[420px] rounded-full bg-amber-50 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Store className="size-5" />
          </div>

          <div>
            <p className="font-semibold tracking-wide text-neutral-950">
              ASIHJAYA
            </p>

            <p className="text-xs text-[var(--muted)]">
              Retail Management System
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Masuk ke sistem
          </h1>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Masukkan akun untuk mengakses Dashboard Admin atau aplikasi POS.
          </p>
        </div>

        <LoginForm />

        <div className="mt-7 flex items-center justify-center gap-2 border-t border-[var(--border)] pt-5 text-xs text-[var(--muted)]">
          <ShieldCheck className="size-4" />
          Session dilindungi dan dicatat dalam audit log
        </div>
      </section>
    </main>
  );
}
