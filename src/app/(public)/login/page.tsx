import { ShieldCheck } from "lucide-react";
import Image from "next/image";
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
    <main
      className="relative flex min-h-screen flex-col items-center bg-[var(--background)] px-4 sm:px-6"
      style={{
        minHeight: "100dvh",
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-[var(--accent-soft)] blur-3xl" />

        <div className="absolute -bottom-40 -right-32 size-[420px] rounded-full bg-amber-50 blur-3xl" />
      </div>

      <section className="relative z-10 my-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] sm:p-8">
        <div className="mr-2.5 mb-8 p-2 flex justify-center">
          <div className="inline-flex items-center justify-center gap-2">
            <Image
              src="/logo/asihjaya-brand-icon.png"
              alt=""
              width={128}
              height={128}
              className="h-18 w-auto shrink-0 object-contain sm:h-21"
              priority
            />

            <div className="min-w-0 text-center">
              <Image
                src="/logo/asihjaya-brand-text.png"
                alt="Asihjaya"
                width={140}
                height={28}
                className="mx-auto h-9 w-auto object-contain sm:h-11"
                priority
              />

              <p className="mt-1 text-[13px] font-medium text-[var(--muted)] sm:text-sm">
                Management Dashboard
              </p>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
            Login Authentication
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
