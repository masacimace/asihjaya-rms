"use client";

import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginActionState } from "@/app/actions/auth";

const initialState: LoginActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Memeriksa akun...
        </>
      ) : (
        <>
          <LockKeyhole className="size-4" />
          Masuk
        </>
      )}
    </button>
  );
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-7 space-y-4">
      {state.message ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
        >
          {state.message}
        </div>
      ) : null}

      <label className="block text-sm" htmlFor="identifier">
        <span className="mb-2 block font-medium text-neutral-800">
          Username atau email
        </span>

        <div className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
          <UserRound className="size-4 shrink-0 text-neutral-400" />

          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            defaultValue={state.values?.identifier ?? ""}
            placeholder="admin atau admin@asihjaya.local"
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </div>

        {state.errors?.identifier ? (
          <span className="mt-1.5 block text-xs text-red-600">
            {state.errors.identifier}
          </span>
        ) : null}
      </label>

      <label className="block text-sm" htmlFor="password">
        <span className="mb-2 block font-medium text-neutral-800">
          Kata sandi
        </span>

        <div className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 transition focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
          <LockKeyhole className="size-4 shrink-0 text-neutral-400" />

          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
          />

          <button
            type="button"
            aria-label={
              showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            onClick={() => setShowPassword((current) => !current)}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>

        {state.errors?.password ? (
          <span className="mt-1.5 block text-xs text-red-600">
            {state.errors.password}
          </span>
        ) : null}
      </label>

      <div className="pt-2">
        <SubmitButton />
      </div>

      <p className="text-center text-xs leading-5 text-[var(--muted)]">
        Gunakan akun staff yang diberikan oleh administrator.
      </p>
    </form>
  );
}
