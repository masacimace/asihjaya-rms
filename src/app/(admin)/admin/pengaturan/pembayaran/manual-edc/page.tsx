import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Landmark,
  Settings2,
} from "lucide-react";
import Link from "next/link";

import { saveManualPaymentProfileAction } from "@/app/actions/manual-payment-settings";
import type {
  ManualPaymentSettingsData,
  ManualPaymentSettingsProfile,
} from "@/features/settings/manual-payment-contracts";
import { getManualPaymentSettingsData } from "@/features/settings/manual-payment-queries";
import type { PosManualPaymentProfileType } from "@/features/pos/contracts";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Metode & Akun Pembayaran",
};

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
const labelClassName = "mb-1.5 block text-xs font-semibold text-neutral-700";

const profileTypeLabels: Record<PosManualPaymentProfileType, string> = {
  edc: "Terminal EDC",
  bank_account: "Rekening Transfer",
};

function ProfileFields({
  data,
  profile,
  profileType,
}: {
  data: ManualPaymentSettingsData;
  profile?: ManualPaymentSettingsProfile;
  profileType: PosManualPaymentProfileType;
}) {
  const isEdc = profileType === "edc";

  return (
    <>
      {profile ? <input type="hidden" name="profileId" value={profile.id} /> : null}
      <input type="hidden" name="profileType" value={profileType} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={labelClassName}>Outlet</span>
          <select
            name="outletId"
            required
            defaultValue={profile?.outletId ?? data.outlets[0]?.id ?? ""}
            className={inputClassName}
          >
            <option value="" disabled>Pilih outlet</option>
            {data.outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} · {outlet.code}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={labelClassName}>Kode profil</span>
          <input
            name="code"
            required
            maxLength={40}
            defaultValue={profile?.code ?? ""}
            placeholder={isEdc ? "EDC-BCA-01" : "TRF-BCA-01"}
            className={inputClassName}
          />
        </label>

        <label>
          <span className={labelClassName}>Nama yang tampil di POS</span>
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={profile?.name ?? ""}
            placeholder={isEdc ? "BCA EDC — Kasir 1" : "BCA — Rekening Toko"}
            className={inputClassName}
          />
        </label>

        <label>
          <span className={labelClassName}>Bank / provider</span>
          <input
            name="provider"
            required
            maxLength={80}
            defaultValue={profile?.provider ?? ""}
            placeholder="Contoh: BCA"
            className={inputClassName}
          />
        </label>

        {isEdc ? (
          <>
            <label>
              <span className={labelClassName}>Terminal ID</span>
              <input
                name="terminalId"
                required
                maxLength={80}
                defaultValue={profile?.terminalId ?? ""}
                placeholder="Terminal ID dari EDC"
                className={inputClassName}
              />
            </label>
            <label>
              <span className={labelClassName}>Mapping register</span>
              <select
                name="registerId"
                defaultValue={profile?.registerId ?? ""}
                className={inputClassName}
              >
                <option value="">Semua register pada outlet</option>
                {data.outlets.flatMap((outlet) =>
                  outlet.registers.map((register) => (
                    <option key={register.id} value={register.id}>
                      {outlet.name} · {register.name}
                    </option>
                  )),
                )}
              </select>
            </label>
          </>
        ) : (
          <label className="sm:col-span-2">
            <span className={labelClassName}>Nomor rekening tujuan</span>
            <input
              name="destinationAccount"
              required
              maxLength={120}
              defaultValue={profile?.destinationAccount ?? ""}
              placeholder="Contoh: 1234567890 a.n. Asihjaya"
              className={inputClassName}
            />
          </label>
        )}

        <label>
          <span className={labelClassName}>Urutan pilihan POS</span>
          <input
            name="displayOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={profile?.displayOrder ?? 0}
            className={inputClassName}
          />
        </label>

        <label className="flex items-center gap-3 self-end rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={profile?.isActive ?? true}
            className="size-4 accent-[var(--accent)]"
          />
          Aktif dan dapat dipilih di POS
        </label>
      </div>

      <button
        type="submit"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        {profile ? "Simpan perubahan" : `Tambah ${profileTypeLabels[profileType]}`}
      </button>
    </>
  );
}

function ProfileSection({
  data,
  profileType,
}: {
  data: ManualPaymentSettingsData;
  profileType: PosManualPaymentProfileType;
}) {
  const profiles = data.profiles.filter((profile) => profile.profileType === profileType);
  const isEdc = profileType === "edc";
  const Icon = isEdc ? CreditCard : Landmark;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold text-neutral-950">{profileTypeLabels[profileType]}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {isEdc
              ? "Terminal yang dapat dipilih kasir untuk metode pembayaran EDC."
              : "Rekening tujuan yang dapat dipilih kasir untuk metode pembayaran Transfer."}
          </p>
        </div>
      </div>

      <details className="mt-5 rounded-2xl border border-[var(--border)] bg-neutral-50 p-4" open={profiles.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          Tambah {profileTypeLabels[profileType]}
        </summary>
        <form action={saveManualPaymentProfileAction} className="mt-4">
          <ProfileFields data={data} profileType={profileType} />
        </form>
      </details>

      <div className="mt-4 grid gap-3">
        {profiles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--muted)]">
            Belum ada {profileTypeLabels[profileType].toLowerCase()} yang dikonfigurasi.
          </p>
        ) : (
          profiles.map((profile) => (
            <details key={profile.id} className="rounded-2xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-950">{profile.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {profile.outletName} · {profile.provider}
                      {profile.terminalId ? ` · ${profile.terminalId}` : ""}
                      {profile.destinationAccount ? ` · ${profile.destinationAccount}` : ""}
                    </p>
                  </div>
                  <span className={profile.isActive ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-neutral-400"}>
                    {profile.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </summary>
              <form action={saveManualPaymentProfileAction} className="mt-4 border-t border-[var(--border)] pt-4">
                <ProfileFields data={data} profile={profile} profileType={profileType} />
              </form>
            </details>
          ))
        )}
      </div>
    </section>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("settings.manage");
  const [data, params] = await Promise.all([
    getManualPaymentSettingsData(auth.organization.id),
    searchParams,
  ]);

  const message = params.message?.slice(0, 240) ?? null;
  const messageType = params.type === "error" ? "error" : "success";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href="/admin/pengaturan"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Pengaturan
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          <Settings2 className="size-3.5" />
          Pengaturan pembayaran
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
          Metode & Akun Pembayaran
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          Atur terminal EDC dan rekening Transfer yang dapat dipilih kasir. Tidak ada approval code, evidence, co-verification, atau settlement verification pada transaksi POS.
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="size-4" />
          Metode POS: Cash, EDC, Transfer. Split payment tetap didukung.
        </p>
      </section>

      {message ? (
        <div className={messageType === "error"
          ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"}
        >
          {message}
        </div>
      ) : null}

      <ProfileSection data={data} profileType="edc" />
      <ProfileSection data={data} profileType="bank_account" />
    </div>
  );
}
