import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Landmark,
  QrCode,
  Settings2,
  ShieldCheck,
  Store,
} from "lucide-react";

import { IdrCurrencyInput } from "@/components/settings/idr-currency-input";
import {
  saveManualPaymentPolicyAction,
  saveManualPaymentProfileAction,
} from "@/app/actions/manual-payment-settings";
import type {
  ManualPaymentSettingsData,
  ManualPaymentSettingsProfile,
} from "@/features/settings/manual-payment-contracts";
import { getManualPaymentSettingsData } from "@/features/settings/manual-payment-queries";
import type { NonCashManualPaymentMethod } from "@/features/pos/manual-payment-verification";
import { requirePermission } from "@/lib/auth/session";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
const labelClassName = "mb-1.5 block text-xs font-semibold text-neutral-700";

const methodLabels: Record<NonCashManualPaymentMethod, string> = {
  qris_manual: "QRIS Manual",
  debit_card: "Debit EDC",
  credit_card: "Credit EDC",
  bank_transfer: "Bank Transfer",
};

const profileTypeLabels = {
  qris: "Akun QRIS",
  edc: "Terminal EDC",
  bank_account: "Rekening Bank",
} as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function ProfileFields({
  data,
  profile,
  profileType,
}: {
  data: ManualPaymentSettingsData;
  profile?: ManualPaymentSettingsProfile;
  profileType: "qris" | "edc" | "bank_account";
}) {
  const defaultSource =
    profile?.verificationSource ??
    (profileType === "qris"
      ? "merchant_app"
      : profileType === "edc"
        ? "edc_terminal"
        : "bank_app");

  return (
    <>
      {profile ? (
        <input type="hidden" name="profileId" value={profile.id} />
      ) : null}
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
            <option value="" disabled>
              Pilih outlet
            </option>
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
            placeholder={
              profileType === "qris"
                ? "QRIS-BCA"
                : profileType === "edc"
                  ? "EDC-BCA-01"
                  : "BANK-BCA"
            }
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
            placeholder={
              profileType === "qris"
                ? "BCA Merchant — Outlet Utama"
                : profileType === "edc"
                  ? "BCA EDC — Kasir 1"
                  : "BCA •••• 1234 — Asih Jaya"
            }
            className={inputClassName}
          />
        </label>

        <label>
          <span className={labelClassName}>Provider / bank / acquirer</span>
          <input
            name="provider"
            required
            maxLength={80}
            defaultValue={profile?.provider ?? ""}
            placeholder="Contoh: BCA"
            className={inputClassName}
          />
        </label>

        {profileType === "qris" ? (
          <>
            <label>
              <span className={labelClassName}>Merchant ID / akun QRIS</span>
              <input
                name="merchantId"
                required
                maxLength={80}
                defaultValue={profile?.merchantId ?? ""}
                placeholder="MID / nama akun merchant"
                className={inputClassName}
              />
            </label>
            <label>
              <span className={labelClassName}>Diperiksa melalui</span>
              <select
                name="verificationSource"
                defaultValue={defaultSource}
                className={inputClassName}
              >
                <option value="merchant_app">Aplikasi merchant</option>
                <option value="bank_app">Aplikasi bank</option>
              </select>
            </label>
          </>
        ) : null}

        {profileType === "edc" ? (
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
              <input
                type="hidden"
                name="verificationSource"
                value="edc_terminal"
              />
            </label>
          </>
        ) : null}

        {profileType === "bank_account" ? (
          <>
            <label>
              <span className={labelClassName}>Rekening tujuan (masked)</span>
              <input
                name="destinationAccount"
                required
                maxLength={120}
                defaultValue={profile?.destinationAccount ?? ""}
                placeholder="BCA •••• 1234 — Asih Jaya"
                className={inputClassName}
              />
            </label>
            <label>
              <span className={labelClassName}>Diperiksa melalui</span>
              <select
                name="verificationSource"
                defaultValue={defaultSource}
                className={inputClassName}
              >
                <option value="bank_app">Aplikasi bank</option>
                <option value="bank_statement">Mutasi bank</option>
              </select>
            </label>
          </>
        ) : null}

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
        {profile
          ? "Simpan perubahan"
          : `Tambah ${profileTypeLabels[profileType]}`}
      </button>
    </>
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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Settings2 className="size-3.5" />
              Pengaturan pembayaran
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Profile Pembayaran
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Simpan akun QRIS, terminal EDC, dan rekening toko sebagai preset.
              Cashier cukup memilih preset, memasukkan reference, lalu
              mengonfirmasi bahwa pembayaran terlihat berhasil.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="flex items-center gap-2 font-semibold text-neutral-950">
              <ShieldCheck className="size-4 text-emerald-600" />
              Safety tetap aktif
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5">
              Duplicate reference, evidence threshold, co-verification, dan
              audit trail P1-A tetap diperiksa oleh backend.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={
            messageType === "error"
              ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Banknote className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">Threshold risiko</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Evidence dan co-verification hanya muncul ketika nominal mencapai
              threshold. Reference duplikat tetap selalu memerlukan review.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {data.policies.map((policy) => (
            <form
              key={policy.method}
              action={saveManualPaymentPolicyAction}
              className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4"
            >
              <input type="hidden" name="method" value={policy.method} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-950">
                    {methodLabels[policy.method]}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Evidence {formatCurrency(policy.evidenceThreshold)} ·
                    approval {formatCurrency(policy.coVerificationThreshold)}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                  <input
                    type="checkbox"
                    name="isEnabled"
                    defaultChecked={policy.isEnabled}
                    className="size-4 accent-[var(--accent)]"
                  />
                  Aktif
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label>
                  <span className={labelClassName}>Bukti wajib mulai</span>
                  <IdrCurrencyInput
                    name="evidenceThreshold"
                    defaultValue={policy.evidenceThreshold}
                    required
                    ariaLabel={`Bukti wajib mulai untuk ${methodLabels[policy.method]}`}
                    className={inputClassName}
                  />
                </label>
                <label>
                  <span className={labelClassName}>Co-verification mulai</span>
                  <IdrCurrencyInput
                    name="coVerificationThreshold"
                    defaultValue={policy.coVerificationThreshold}
                    required
                    ariaLabel={`Co-verification mulai untuk ${methodLabels[policy.method]}`}
                    className={inputClassName}
                  />
                </label>
                <label>
                  <span className={labelClassName}>Cek duplikat (hari)</span>
                  <input
                    name="duplicateLookbackDays"
                    type="number"
                    min={1}
                    max={3650}
                    defaultValue={policy.duplicateLookbackDays}
                    className={inputClassName}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                Simpan kebijakan
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Store className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-950">
              Preset pembayaran outlet
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Data provider dan identifier disimpan sekali di sini, bukan
              diketik berulang pada setiap transaksi.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <details className="group rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 transition open:bg-white open:shadow-sm">
            <summary className="flex w-full cursor-pointer list-none items-center gap-2 font-semibold text-neutral-950 select-none marker:content-none [&::-webkit-details-marker]:hidden">
              <QrCode className="size-4 text-[var(--accent)]" />
              <span>Tambah akun QRIS</span>
              <span className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-white text-neutral-500 transition group-open:border-[var(--accent)]/30 group-open:bg-[var(--accent-soft)] group-open:text-[var(--accent)]">
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
              </span>
            </summary>
            <form action={saveManualPaymentProfileAction} className="mt-4">
              <ProfileFields data={data} profileType="qris" />
            </form>
          </details>

          <details className="group rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 transition open:bg-white open:shadow-sm">
            <summary className="flex w-full cursor-pointer list-none items-center gap-2 font-semibold text-neutral-950 select-none marker:content-none [&::-webkit-details-marker]:hidden">
              <CreditCard className="size-4 text-blue-700" />
              <span>Tambah terminal EDC</span>
              <span className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-white text-neutral-500 transition group-open:border-blue-200 group-open:bg-blue-50 group-open:text-blue-700">
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
              </span>
            </summary>
            <form action={saveManualPaymentProfileAction} className="mt-4">
              <ProfileFields data={data} profileType="edc" />
            </form>
          </details>

          <details className="group rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 transition open:bg-white open:shadow-sm">
            <summary className="flex w-full cursor-pointer list-none items-center gap-2 font-semibold text-neutral-950 select-none marker:content-none [&::-webkit-details-marker]:hidden">
              <Landmark className="size-4 text-emerald-700" />
              <span>Tambah rekening bank</span>
              <span className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-white text-neutral-500 transition group-open:border-emerald-200 group-open:bg-emerald-50 group-open:text-emerald-700">
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
              </span>
            </summary>
            <form action={saveManualPaymentProfileAction} className="mt-4">
              <ProfileFields data={data} profileType="bank_account" />
            </form>
          </details>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-neutral-950">Profil tersimpan</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.profiles.length} profil ditemukan pada organisasi ini.
            </p>
          </div>
          <CheckCircle2 className="size-5 text-emerald-600" />
        </div>

        {data.profiles.length > 0 ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {data.profiles.map((profile) => (
              <details
                key={profile.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4"
              >
                <summary className="cursor-pointer marker:content-none">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-neutral-950">
                        {profile.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {profileTypeLabels[profile.profileType]} ·{" "}
                        {profile.provider} · {profile.outletName}
                      </p>
                      {profile.registerName ? (
                        <p className="mt-1 text-xs text-blue-700">
                          Register: {profile.registerName}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={
                        profile.isActive
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600"
                      }
                    >
                      {profile.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                </summary>
                <form
                  action={saveManualPaymentProfileAction}
                  className="mt-4 border-t border-[var(--border)] pt-4"
                >
                  <ProfileFields
                    data={data}
                    profile={profile}
                    profileType={profile.profileType}
                  />
                </form>
              </details>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 p-6 text-center text-sm text-[var(--muted)]">
            Belum ada preset. Tambahkan minimal satu profil untuk metode
            non-tunai yang digunakan toko.
          </div>
        )}
      </section>
    </div>
  );
}
