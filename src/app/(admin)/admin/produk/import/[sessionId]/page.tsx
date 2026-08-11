import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Download,
  ImageIcon,
  Package,
  Search,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductBatchImportSessionActions } from "@/components/products/product-batch-import-session-actions";
import {
  getProductBatchImportPreview,
  type ProductBatchPreviewIssue,
  type ProductBatchPreviewItemRow,
  type ProductBatchPreviewMasterRow,
  type ProductBatchPreviewMedia,
} from "@/features/product-batch-import/preview-queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Preview Product Batch Import" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ViewMode = "masters" | "items" | "images" | "issues";
type StatusFilter = "all" | "invalid" | "warning" | "valid";

function asText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateTime(value: Date | null, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(value);
}

function formatMoney(value: unknown) {
  const text = asText(value);
  if (text === "—") return text;
  const number = Number(text);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(number)
    : text;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    uploaded: "Uploaded",
    validating: "Validating",
    invalid: "Invalid",
    ready: "Ready",
    committing: "Committing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    expired: "Expired",
    pending: "Pending",
    valid: "Valid",
    warning: "Warning",
  };
  return labels[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "ready" || status === "valid" || status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "warning" || status === "validating" || status === "uploaded"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "invalid" || status === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-neutral-200 bg-neutral-100 text-neutral-700";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", style)}>
      {statusLabel(status)}
    </span>
  );
}

function IssueList({ issues }: { issues: ProductBatchPreviewIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      {issues.map((issue, index) => (
        <div
          key={`${issue.code}-${issue.field ?? "global"}-${index}`}
          className={cn(
            "rounded-xl border p-3 text-xs leading-5",
            issue.severity === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <span>{issue.code}</span>
            {issue.field ? <span className="font-mono opacity-75">{issue.field}</span> : null}
          </div>
          <p className="mt-1">{issue.message}</p>
          {issue.archivePath ? <p className="mt-1 break-all opacity-75">{issue.archivePath}</p> : null}
        </div>
      ))}
    </div>
  );
}

function MediaThumbnail({
  sessionId,
  media,
  label,
}: {
  sessionId: string;
  media: ProductBatchPreviewMedia | null;
  label: string;
}) {
  if (!media || media.status === "deleted") {
    return (
      <div className="grid aspect-square w-20 shrink-0 place-items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400">
        <ImageIcon className="size-5" />
      </div>
    );
  }
  return (
    <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      <Image
        src={`/admin/produk/import/${sessionId}/media/${media.id}`}
        alt={label}
        fill
        sizes="80px"
        unoptimized
        className="object-cover"
      />
    </div>
  );
}

function rowMatchesStatus(status: string, filter: StatusFilter) {
  return filter === "all" || status === filter;
}

function masterMatchesSearch(row: ProductBatchPreviewMasterRow, query: string) {
  if (!query) return true;
  const haystack = [
    row.masterKey,
    row.normalizedPayload.master_key,
    row.normalizedPayload.name,
    row.normalizedPayload.category_code,
    row.normalizedPayload.brand,
    row.normalizedPayload.material,
    row.normalizedPayload.collection,
  ]
    .map(asText)
    .join(" ")
    .toLocaleLowerCase("id-ID");
  return haystack.includes(query);
}

function itemMatchesSearch(row: ProductBatchPreviewItemRow, query: string) {
  if (!query) return true;
  const haystack = [
    row.rowKey,
    row.masterKey,
    row.normalizedPayload.row_key,
    row.normalizedPayload.master_key,
    row.normalizedPayload.display_name,
    row.normalizedPayload.outlet_code,
    row.normalizedPayload.location_code,
  ]
    .map(asText)
    .join(" ")
    .toLocaleLowerCase("id-ID");
  return haystack.includes(query);
}

function ItemCompact({
  sessionId,
  row,
}: {
  sessionId: string;
  row: ProductBatchPreviewItemRow;
}) {
  const effectiveMedia = row.media ?? (row.effectiveImageSource === "master" ? row.masterMedia : null);
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex min-w-0 items-start gap-3">
        <MediaThumbnail sessionId={sessionId} media={effectiveMedia} label={asText(row.normalizedPayload.row_key)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-[var(--muted)]">PHYSICAL_PRODUCTS row {row.rowNumber}</p>
              <h4 className="mt-1 break-words font-semibold text-neutral-950">
                {asText(row.normalizedPayload.row_key)}
              </h4>
              <p className="mt-1 break-words text-sm text-[var(--muted)]">
                {asText(row.normalizedPayload.display_name)}
              </p>
            </div>
            <StatusBadge status={row.validationStatus} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
              {asText(row.normalizedPayload.initial_availability)}
            </span>
            <span className="rounded-lg bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
              {asText(row.normalizedPayload.weight_gram)} g
            </span>
            <span className="rounded-lg bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
              {formatMoney(row.normalizedPayload.selling_amount)}
            </span>
            {row.effectiveImageSource === "master" ? (
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
                Foto master fallback
              </span>
            ) : row.effectiveImageSource === "physical" ? (
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                Foto fisik
              </span>
            ) : (
              <span className="rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                Tanpa effective image
              </span>
            )}
          </div>

          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-[var(--muted)]">Master</dt><dd className="break-words font-medium">{asText(row.normalizedPayload.master_key)}</dd></div>
            <div><dt className="text-[var(--muted)]">Outlet</dt><dd className="break-words font-medium">{row.resolvedOutletCode ?? asText(row.normalizedPayload.outlet_code)}</dd></div>
            <div><dt className="text-[var(--muted)]">Condition</dt><dd className="font-medium">{asText(row.normalizedPayload.condition)}</dd></div>
            <div><dt className="text-[var(--muted)]">Lokasi</dt><dd className="break-words font-medium">{asText(row.normalizedPayload.location_code)}</dd></div>
          </dl>

          {row.validationErrors.length || row.validationWarnings.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-700">
                Lihat {row.validationErrors.length} error · {row.validationWarnings.length} warning
              </summary>
              <div className="mt-3 space-y-2">
                <IssueList issues={row.validationErrors} />
                <IssueList issues={row.validationWarnings} />
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default async function ProductBatchImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ view?: string; status?: string; q?: string }>;
}) {
  const auth = await requirePermission("products.batch_import");
  const [{ sessionId }, queryParams] = await Promise.all([params, searchParams]);
  const preview = await getProductBatchImportPreview(auth, sessionId);
  if (!preview) notFound();

  const view: ViewMode = ["masters", "items", "images", "issues"].includes(queryParams.view ?? "")
    ? (queryParams.view as ViewMode)
    : "masters";
  const statusFilter: StatusFilter = ["all", "invalid", "warning", "valid"].includes(queryParams.status ?? "")
    ? (queryParams.status as StatusFilter)
    : "all";
  const search = (queryParams.q ?? "").trim();
  const normalizedSearch = search.toLocaleLowerCase("id-ID");

  const filteredMasters = preview.masters.filter(
    (row) => rowMatchesStatus(row.validationStatus, statusFilter) && masterMatchesSearch(row, normalizedSearch),
  );
  const filteredItems = preview.items.filter(
    (row) => rowMatchesStatus(row.validationStatus, statusFilter) && itemMatchesSearch(row, normalizedSearch),
  );
  const itemsByMaster = new Map<string, ProductBatchPreviewItemRow[]>();
  for (const item of preview.items) {
    const rows = itemsByMaster.get(item.masterKey) ?? [];
    rows.push(item);
    itemsByMaster.set(item.masterKey, rows);
  }
  const allIssues = [
    ...preview.masters.flatMap((row) => [
      ...row.validationErrors.map((issue) => ({ kind: "Master", rowNumber: row.rowNumber, key: asText(row.normalizedPayload.master_key), issue })),
      ...row.validationWarnings.map((issue) => ({ kind: "Master", rowNumber: row.rowNumber, key: asText(row.normalizedPayload.master_key), issue })),
    ]),
    ...preview.items.flatMap((row) => [
      ...row.validationErrors.map((issue) => ({ kind: "Item", rowNumber: row.rowNumber, key: asText(row.normalizedPayload.row_key), issue })),
      ...row.validationWarnings.map((issue) => ({ kind: "Item", rowNumber: row.rowNumber, key: asText(row.normalizedPayload.row_key), issue })),
    ]),
  ].filter((entry) => {
    if (statusFilter === "invalid") return entry.issue.severity === "error";
    if (statusFilter === "warning") return entry.issue.severity === "warning";
    if (statusFilter === "valid") return false;
    return true;
  }).filter((entry) => !normalizedSearch || `${entry.kind} ${entry.key} ${entry.issue.code} ${entry.issue.field ?? ""} ${entry.issue.message}`.toLocaleLowerCase("id-ID").includes(normalizedSearch));

  const summaryCards: Array<{
    label: string;
    value: number;
    icon: typeof Package;
    color: string;
  }> = [
    { label: "Master", value: preview.session.totalMasterRows, icon: Package, color: "text-neutral-900" },
    { label: "Item fisik", value: preview.session.totalItemRows, icon: Store, color: "text-neutral-900" },
    { label: "Master valid", value: preview.session.validMasterRows, icon: CheckCircle2, color: "text-emerald-700" },
    { label: "Invalid rows", value: preview.session.invalidRows, icon: XCircle, color: preview.session.invalidRows ? "text-red-700" : "text-emerald-700" },
    { label: "Warnings", value: preview.session.warningCount, icon: AlertTriangle, color: preview.session.warningCount ? "text-amber-700" : "text-neutral-700" },
  ];

  const viewHref = (nextView: ViewMode) => {
    const query = new URLSearchParams();
    query.set("view", nextView);
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (search) query.set("q", search);
    return `/admin/produk/import/${sessionId}?${query.toString()}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 overflow-x-clip pb-8">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/produk/import" className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100">
            <ArrowLeft className="size-4" />
            Kembali ke Import
          </Link>
          <StatusBadge status={preview.session.status} />
        </div>
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-neutral-950 sm:text-3xl">Preview Product Batch Import</h1>
            <p className="mt-2 break-all text-sm font-medium text-neutral-700">{preview.session.fileName}</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Preview ini membaca snapshot staging yang sama dengan hasil validation. Tidak ada SKU, barcode, QR, Product Master, atau Product Item nyata yang dibuat pada tahap review ini.
            </p>
          </div>
          <dl className="grid gap-2 rounded-2xl bg-neutral-50 p-4 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Session</dt><dd className="break-all text-right font-mono">{preview.session.id.slice(0, 8)}…</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Operator</dt><dd className="text-right font-medium">{preview.session.createdByName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Divalidasi</dt><dd className="text-right font-medium">{formatDateTime(preview.session.validatedAt, auth.organization.timezone)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Expired</dt><dd className="text-right font-medium">{formatDateTime(preview.session.expiresAt, auth.organization.timezone)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted)]">Ukuran ZIP</dt><dd className="font-medium">{formatBytes(preview.session.fileSizeBytes)}</dd></div>
          </dl>
        </div>
      </section>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
              <Icon className={cn("size-4", color)} />
            </div>
            <p className="mt-3 text-2xl font-semibold text-neutral-950">{formatNumber(value)}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap gap-2 border-b border-neutral-100 pb-4">
          {([
            ["masters", `Product Masters (${preview.masters.length})`],
            ["items", `Physical Products (${preview.items.length})`],
            ["images", `Images (${preview.media.filter((row) => row.status !== "deleted").length})`],
            ["issues", `Errors & Warnings (${allIssues.length})`],
          ] as Array<[ViewMode, string]>).map(([key, label]) => (
            <Link
              key={key}
              href={viewHref(key)}
              className={cn(
                "inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold transition",
                view === key ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <form className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]" method="get">
          <input type="hidden" name="view" value={view} />
          <label className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input name="q" defaultValue={search} placeholder="Cari master_key, row_key, nama, outlet..." className="h-10 w-full min-w-0 rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-400" />
          </label>
          <select name="status" defaultValue={statusFilter} className="h-10 min-w-0 rounded-xl border border-neutral-200 bg-white px-3 text-sm">
            <option value="all">Semua status</option>
            <option value="invalid">Invalid</option>
            <option value="warning">Warning</option>
            <option value="valid">Valid</option>
          </select>
          <button type="submit" className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white">Terapkan filter</button>
        </form>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <main className="min-w-0 space-y-4">
          {view === "masters" ? (
            filteredMasters.length ? filteredMasters.map((row) => {
              const children = itemsByMaster.get(row.masterKey) ?? [];
              return (
                <details key={row.id} open={row.validationStatus === "invalid"} className="group min-w-0 rounded-3xl border border-[var(--border)] bg-white p-4 sm:p-5">
                  <summary className="flex min-w-0 cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
                    <MediaThumbnail sessionId={sessionId} media={row.media} label={asText(row.normalizedPayload.name)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-[var(--muted)]">PRODUCT_MASTERS row {row.rowNumber}</p>
                          <h2 className="mt-1 break-words font-semibold text-neutral-950">{asText(row.normalizedPayload.name)}</h2>
                          <p className="mt-1 break-words text-sm text-[var(--muted)]">{asText(row.normalizedPayload.master_key)} · {row.resolvedCategoryCode ?? asText(row.normalizedPayload.category_code)}</p>
                        </div>
                        <div className="flex items-center gap-2"><StatusBadge status={row.validationStatus} /><ChevronRight className="size-4 text-neutral-400 transition group-open:rotate-90" /></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-lg bg-neutral-100 px-2.5 py-1">{children.length} item</span>
                        <span className="rounded-lg bg-neutral-100 px-2.5 py-1">status {asText(row.normalizedPayload.status)}</span>
                        {row.validationErrors.length ? <span className="rounded-lg bg-red-50 px-2.5 py-1 font-semibold text-red-700">{row.validationErrors.length} error</span> : null}
                        {row.validationWarnings.length ? <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{row.validationWarnings.length} warning</span> : null}
                      </div>
                    </div>
                  </summary>
                  <div className="mt-5 border-t border-neutral-100 pt-5">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-xs text-[var(--muted)]">Brand</dt><dd className="mt-1 break-words font-medium">{asText(row.normalizedPayload.brand)}</dd></div>
                      <div><dt className="text-xs text-[var(--muted)]">Material</dt><dd className="mt-1 break-words font-medium">{asText(row.normalizedPayload.material)}</dd></div>
                      <div><dt className="text-xs text-[var(--muted)]">Collection</dt><dd className="mt-1 break-words font-medium">{asText(row.normalizedPayload.collection)}</dd></div>
                      <div><dt className="text-xs text-[var(--muted)]">Image</dt><dd className="mt-1 break-all font-medium">{asText(row.normalizedPayload.primary_image)}</dd></div>
                    </dl>
                    {row.validationErrors.length || row.validationWarnings.length ? <div className="mt-4 space-y-2"><IssueList issues={row.validationErrors} /><IssueList issues={row.validationWarnings} /></div> : null}
                    <div className="mt-5 space-y-3">
                      <h3 className="text-sm font-semibold text-neutral-950">Physical Products</h3>
                      {children.length ? children.map((child) => <ItemCompact key={child.id} sessionId={sessionId} row={child} />) : <p className="rounded-xl bg-neutral-50 p-4 text-sm text-[var(--muted)]">Tidak ada item yang terhubung ke master staging ini.</p>}
                    </div>
                  </div>
                </details>
              );
            }) : <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-[var(--muted)]">Tidak ada Product Master yang cocok dengan filter.</p>
          ) : null}

          {view === "items" ? (
            filteredItems.length ? filteredItems.map((row) => <ItemCompact key={row.id} sessionId={sessionId} row={row} />) : <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-[var(--muted)]">Tidak ada Physical Product yang cocok dengan filter.</p>
          ) : null}

          {view === "images" ? (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {preview.media.filter((row) => row.status !== "deleted").map((media) => (
                <article key={media.id} className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4">
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-50">
                    <Image src={`/admin/produk/import/${sessionId}/media/${media.id}`} alt={media.archivePath} fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="object-contain" />
                  </div>
                  <p className="mt-3 break-all text-sm font-semibold text-neutral-900">{media.archivePath}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{media.entityKind} · {formatBytes(media.byteSize)} · {media.width ?? "?"}×{media.height ?? "?"}</p>
                </article>
              ))}
            </div>
          ) : null}

          {view === "issues" ? (
            allIssues.length ? allIssues.map((entry, index) => (
              <article key={`${entry.kind}-${entry.rowNumber}-${entry.issue.code}-${index}`} className={cn("rounded-2xl border bg-white p-4", entry.issue.severity === "error" ? "border-red-200" : "border-amber-200")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-xs text-[var(--muted)]">{entry.kind} · row {entry.rowNumber}</p><p className="mt-1 break-words font-semibold text-neutral-950">{entry.key}</p></div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", entry.issue.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>{entry.issue.severity}</span>
                </div>
                <div className="mt-3"><IssueList issues={[entry.issue]} /></div>
              </article>
            )) : <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-[var(--muted)]">Tidak ada error/warning yang cocok dengan filter.</p>
          ) : null}
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><ShieldCheck className="size-5" /></div>
              <div><h2 className="font-semibold text-neutral-950">Review action</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Commit belum menulis data bisnis pada 2B.5.</p></div>
            </div>
            <div className="mt-4"><ProductBatchImportSessionActions sessionId={sessionId} status={preview.session.status} invalidRows={preview.session.invalidRows} /></div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5">
            <h2 className="font-semibold text-neutral-950">Review report</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Workbook berisi summary, master errors, item errors, dan warnings dengan formula-injection protection.</p>
            <Link href={`/admin/produk/import/${sessionId}/errors`} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
              <Download className="size-4" />
              Download error workbook
            </Link>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 text-xs leading-5">
            <h2 className="font-semibold text-neutral-950">Evidence</h2>
            <dl className="mt-3 space-y-2">
              <div><dt className="text-[var(--muted)]">SHA-256 ZIP</dt><dd className="mt-1 break-all font-mono text-[11px]">{preview.session.fileSha256}</dd></div>
              <div><dt className="text-[var(--muted)]">Template</dt><dd className="font-medium">v{preview.session.templateVersion}</dd></div>
              {preview.session.failureCode ? <div className="rounded-xl bg-red-50 p-3 text-red-800"><dt className="font-semibold">{preview.session.failureCode}</dt><dd className="mt-1">{preview.session.failureMessage ?? "Failure detail tidak tersedia."}</dd></div> : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
