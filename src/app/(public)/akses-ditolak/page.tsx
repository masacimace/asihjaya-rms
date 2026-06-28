import { LogOut, ShieldX } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { getCurrentAuth } from "@/lib/auth/session";

export default async function AccessDeniedPage() {
  const auth = await getCurrentAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-5">
      <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <ShieldX className="size-6" />
        </div>

        <h1 className="mt-5 text-2xl font-semibold text-neutral-950">
          Akses tidak tersedia
        </h1>

        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Akun{" "}
          <strong className="font-medium text-neutral-800">
            {auth?.user.fullName ?? "ini"}
          </strong>{" "}
          belum mempunyai izin untuk mengakses modul tersebut.
        </p>

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <LogOut className="size-4" />
            Keluar dari akun
          </button>
        </form>
      </section>
    </main>
  );
}
