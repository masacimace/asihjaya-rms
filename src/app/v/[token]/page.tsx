import type { ReactNode } from "react";

import { LockKeyhole, ShieldX, UserRound } from "lucide-react";
import Image from "next/image";

import {
  PublicHistoryInitialPinChangeForm,
  PublicHistoryPinVerificationForm,
} from "@/components/customers/public-history-access-form";
import { PublicHistoryPortal } from "@/components/customers/public-history-portal";
import {
  CUSTOMER_HISTORY_ABSOLUTE_TIMEOUT_HOURS,
  CUSTOMER_HISTORY_IDLE_TIMEOUT_MINUTES,
  getCurrentCustomerHistorySession,
  getCustomerHistoryCredentialStatus,
} from "@/features/customers/history-access";
import {
  getPublicCustomerHistoryAccessContext,
  getPublicCustomerHistoryData,
} from "@/features/customers/public-history";

export const metadata = {
  title: "Riwayat Transaksi Pelanggan",
  robots: {
    index: false,
    follow: false,
  },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function BackgroundLayers() {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-30 bg-[url('/customer-history/background-mobile.webp')] bg-cover bg-center bg-no-repeat lg:bg-[url('/customer-history/background-desktop.webp')]"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-20 bg-[linear-gradient(180deg,rgba(255,252,247,.18),rgba(242,229,211,.38))] lg:bg-[linear-gradient(90deg,rgba(255,252,247,.16),rgba(236,221,199,.25))]"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-white/5 backdrop-saturate-150"
      />
    </>
  );
}

function BrandHeader() {
  return (
    <header className="flex items-center gap-3 border-b border-white/[0.55] px-5 py-5 sm:px-7">
      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/[0.65] bg-white/[0.35] backdrop-blur-lg">
        <Image
          src="/logo/asihjaya-brand-icon.png"
          alt="ASIHJAYA"
          width={60}
          height={60}
          className="h-11 w-auto object-contain"
          priority
        />
      </div>
      <div className="min-w-0">
        <Image
          src="/logo/asihjaya-brand-text.png"
          alt="ASIHJAYA"
          width={132}
          height={30}
          className="h-6 w-auto object-contain"
          priority
        />
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-600">
          Customer Portal
        </p>
      </div>
    </header>
  );
}

function GlassPageShell({
  children,
  maxWidth = "max-w-xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-3 py-6 text-neutral-950 sm:px-6 sm:py-10">
      <BackgroundLayers />
      <section
        className={`relative mx-auto ${maxWidth} overflow-hidden rounded-[30px] border border-white/[0.65] bg-white/[0.46] shadow-[0_28px_90px_rgba(73,49,24,.18)] backdrop-blur-2xl`}
      >
        <BrandHeader />
        {children}
      </section>
    </main>
  );
}

function InvalidState({ message }: { message: string }) {
  return (
    <GlassPageShell maxWidth="max-w-2xl">
      <div className="px-5 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-red-200/70 bg-red-50/75 text-red-600 shadow-sm">
            <ShieldX className="size-8" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-red-600">
            Data tidak tersedia
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Riwayat transaksi tidak dapat ditampilkan
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
            {message}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/70 bg-white/[0.45] p-5 backdrop-blur-lg">
          <p className="text-sm font-bold text-neutral-900">Yang dapat kamu lakukan</p>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-neutral-600">
            <li>1. Scan ulang QR pada nota fisik.</li>
            <li>2. Pastikan alamat situs berasal dari domain resmi ASIHJAYA.</li>
            <li>3. Hubungi outlet penerbit nota jika informasi tetap tidak tersedia.</li>
          </ol>
        </div>
      </div>
    </GlassPageShell>
  );
}

function NoCustomerState({
  message,
  outletName,
  transactionDate,
  transactionNumber,
}: {
  message: string;
  outletName: string;
  transactionDate: Date | null;
  transactionNumber: string;
}) {
  return (
    <GlassPageShell maxWidth="max-w-2xl">
      <div className="px-5 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-[#ead7ad]/80 bg-[#fff6df]/80 text-[#9a681d] shadow-sm">
            <UserRound className="size-8" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#9a681d]">
            Customer tidak terdaftar
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Riwayat pelanggan belum tersedia
          </h1>
          <p className="mt-4 text-sm leading-7 text-neutral-600 sm:text-base">
            {message}
          </p>
        </div>

        <dl className="mx-auto mt-8 max-w-xl divide-y divide-white/70 rounded-2xl border border-white/70 bg-white/[0.45] p-5 backdrop-blur-lg">
          <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[150px_1fr] sm:items-center">
            <dt className="text-sm text-neutral-500">Nomor nota</dt>
            <dd className="font-mono text-sm font-bold text-neutral-950 sm:text-right">
              {transactionNumber}
            </dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
            <dt className="text-sm text-neutral-500">Tanggal</dt>
            <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
              {formatDateTime(transactionDate)}
            </dd>
          </div>
          <div className="grid gap-1 py-3 last:pb-0 sm:grid-cols-[150px_1fr] sm:items-center">
            <dt className="text-sm text-neutral-500">Outlet</dt>
            <dd className="text-sm font-semibold text-neutral-900 sm:text-right">
              {outletName}
            </dd>
          </div>
        </dl>
      </div>
    </GlassPageShell>
  );
}

function PinAccessShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <GlassPageShell>
      <div className="px-5 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-[#ead7ad]/80 bg-[#fff6df]/80 text-[#9a681d] shadow-sm">
          <LockKeyhole className="size-8" />
        </div>
        <div className="mt-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a681d]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">{description}</p>
        </div>
        {children}
      </div>
    </GlassPageShell>
  );
}

function PinSetupRequiredState({
  outletName,
  outletPhone,
}: {
  outletName: string;
  outletPhone: string | null;
}) {
  return (
    <PinAccessShell
      eyebrow="PIN belum tersedia"
      title="Aktifkan akses riwayat pelanggan"
      description="PIN riwayat untuk pelanggan pada nota ini belum dibuat. Hubungi outlet agar petugas membuat PIN sementara secara aman."
    >
      <div className="mt-7 rounded-2xl border border-white/70 bg-white/[0.45] p-4 text-sm leading-6 text-neutral-700 backdrop-blur-lg">
        <p className="font-bold text-neutral-950">{outletName}</p>
        <p className="mt-1">{outletPhone ?? "Nomor outlet tidak tersedia"}</p>
      </div>
    </PinAccessShell>
  );
}

function PinRequiredState({ token }: { token: string }) {
  return (
    <PinAccessShell
      eyebrow="Verifikasi pelanggan"
      title="Masukkan PIN pelanggan"
      description={`Sesi akan berakhir setelah ${CUSTOMER_HISTORY_IDLE_TIMEOUT_MINUTES} menit tidak aktif atau maksimal ${CUSTOMER_HISTORY_ABSOLUTE_TIMEOUT_HOURS} jam.`}
    >
      <PublicHistoryPinVerificationForm token={token} />
      <p className="mt-5 text-center text-xs leading-5 text-neutral-500">
        Setelah 5 percobaan gagal, akses akan dibatasi sementara.
      </p>
    </PinAccessShell>
  );
}

function InitialPinChangeState({ token }: { token: string }) {
  return (
    <PinAccessShell
      eyebrow="Akses pertama"
      title="Buat PIN pribadi"
      description="PIN sementara sudah benar. Ganti dengan 6 angka yang hanya diketahui pelanggan sebelum membuka riwayat transaksi."
    >
      <PublicHistoryInitialPinChangeForm token={token} />
    </PinAccessShell>
  );
}

export default async function PublicCustomerHistoryPage({ params }: PageProps) {
  const { token } = await params;
  const context = await getPublicCustomerHistoryAccessContext(token);

  if (context.status === "invalid") {
    return <InvalidState message={context.message} />;
  }

  if (context.status === "no_customer") {
    return (
      <NoCustomerState
        message={context.message}
        outletName={context.outlet.name}
        transactionDate={
          context.transaction.completedAt ?? context.transaction.createdAt
        }
        transactionNumber={context.transaction.transactionNumber}
      />
    );
  }

  const credentialStatus = await getCustomerHistoryCredentialStatus({
    organizationId: context.organizationId,
    customerId: context.customer.id,
  });

  if (!credentialStatus.exists || !credentialStatus.isActive) {
    return (
      <PinSetupRequiredState
        outletName={context.outlet.name}
        outletPhone={context.outlet.phone}
      />
    );
  }

  const session = await getCurrentCustomerHistorySession({
    organizationId: context.organizationId,
    customerId: context.customer.id,
    touch: true,
  });

  if (!session) {
    return <PinRequiredState token={token} />;
  }

  if (session.requiresPinChange) {
    return <InitialPinChangeState token={token} />;
  }

  const data = await getPublicCustomerHistoryData(token, session.customerId);

  if (data.status !== "valid") {
    return <InvalidState message="Riwayat transaksi tidak tersedia." />;
  }

  return <PublicHistoryPortal data={data} />;
}
