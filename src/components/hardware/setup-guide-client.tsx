"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  Info,
  Search,
  ShieldAlert,
  TerminalSquare,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  HardwareGuideBadge,
  HardwareGuideCallout,
  HardwareGuideSection,
} from "@/features/hardware/setup-guide";
import { cn } from "@/lib/utils";

type GuideRuntimeStatus = {
  generatedAt: string;
  totalAgents: number;
  onlineAgents: number;
  warningAgents: number;
  unknownOutcomeJobs: number;
  staleSubmittedJobs: number;
  agents: Array<{
    id: string;
    name: string;
    outlet: string;
    register: string;
    status: string;
    version: string | null;
  }>;
};

type Props = {
  sections: HardwareGuideSection[];
  finalChecklist: readonly string[];
  guideVersion: string;
  runtimeStatus: GuideRuntimeStatus;
};

const CHECKLIST_STORAGE_KEY = "asihjaya.hardware.setup-guide.checklist.v1";

const badgeLabels: Record<HardwareGuideBadge, string> = {
  development: "Development",
  outlet: "Outlet",
  production: "Production",
  safety: "Safety",
};

function Badge({ badge }: { badge: HardwareGuideBadge }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
        badge === "development" && "bg-blue-50 text-blue-700",
        badge === "outlet" && "bg-emerald-50 text-emerald-700",
        badge === "production" && "bg-violet-50 text-violet-700",
        badge === "safety" && "bg-amber-50 text-amber-800",
      )}
    >
      {badgeLabels[badge]}
    </span>
  );
}

function Callout({ callout }: { callout: HardwareGuideCallout }) {
  const Icon =
    callout.tone === "success"
      ? CheckCircle2
      : callout.tone === "danger"
        ? ShieldAlert
        : callout.tone === "warning"
          ? AlertTriangle
          : Info;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        callout.tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
        callout.tone === "danger" &&
          "border-red-200 bg-red-50 text-red-900",
        callout.tone === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-900",
        callout.tone === "info" &&
          "border-blue-200 bg-blue-50 text-blue-900",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{callout.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{callout.body}</p>
        </div>
      </div>
    </div>
  );
}

function CommandBlock({ label, code }: { label?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-neutral-400">
          <TerminalSquare className="size-3.5 shrink-0" />
          <span className="truncate">{label ?? "PowerShell / Terminal"}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-6">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function normalizeSearchText(section: HardwareGuideSection) {
  return [
    section.title,
    section.summary,
    ...section.steps.flatMap((step) => [
      step.title,
      ...step.body,
      ...(step.checks ?? []),
      ...(step.commands?.flatMap((command) => [command.label ?? "", command.code]) ?? []),
      step.callout?.title ?? "",
      step.callout?.body ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

export function HardwareSetupGuideClient({
  sections,
  finalChecklist,
  guideVersion,
  runtimeStatus,
}: Props) {
  const [query, setQuery] = useState("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (value) {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setCompleted(
            new Set(parsed.filter((entry): entry is string => typeof entry === "string")),
          );
        }
      }
    } finally {
      setIsStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isStorageReady) return;
    window.localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify([...completed]),
    );
  }, [completed, isStorageReady]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections.filter((section) =>
      normalizeSearchText(section).includes(normalizedQuery),
    );
  }, [normalizedQuery, sections]);

  const allChecklistIds = useMemo(
    () => [
      ...sections.flatMap((section) =>
        section.steps.flatMap((step) =>
          (step.checks ?? []).map((_, index) => `${step.id}:check:${index}`),
        ),
      ),
      ...finalChecklist.map((_, index) => `final:${index}`),
    ],
    [finalChecklist, sections],
  );

  const completedCount = allChecklistIds.filter((id) => completed.has(id)).length;
  const progress = allChecklistIds.length
    ? Math.round((completedCount / allChecklistIds.length) * 100)
    : 0;

  function toggle(id: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetChecklist() {
    setCompleted(new Set());
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start print:hidden">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari panduan..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 hover:bg-white hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <nav className="mt-4 max-h-[52vh] space-y-1 overflow-y-auto pr-1">
            {visibleSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-xl px-3 py-2 text-xs font-medium leading-5 text-neutral-600 transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Checklist progress
              </p>
              <p className="mt-1 text-2xl font-semibold text-neutral-950">{progress}%</p>
            </div>
            <Clipboard className="size-6 text-[var(--accent)]" />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {completedCount} dari {allChecklistIds.length} item selesai. Progress disimpan di browser ini.
          </p>
          <button
            type="button"
            onClick={resetChecklist}
            className="mt-3 text-xs font-semibold text-neutral-500 transition hover:text-red-600"
          >
            Reset checklist
          </button>
        </div>

        <Link
          href="/admin/operasional/hardware"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
        >
          Buka Hardware Hub
          <ExternalLink className="size-4" />
        </Link>
      </aside>

      <main className="min-w-0 space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Guide version
              </p>
              <p className="mt-1 font-semibold text-neutral-950">{guideVersion}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Agent online
              </p>
              <p className="mt-1 font-semibold text-neutral-950">
                {runtimeStatus.onlineAgents}/{runtimeStatus.totalAgents}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Perlu dicek
              </p>
              <p className="mt-1 font-semibold text-neutral-950">
                {runtimeStatus.warningAgents}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Unknown / submitted stale
              </p>
              <p className="mt-1 font-semibold text-neutral-950">
                {runtimeStatus.unknownOutcomeJobs} / {runtimeStatus.staleSubmittedJobs}
              </p>
            </div>
          </div>
          {runtimeStatus.agents.length > 0 ? (
            <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-5 py-4 text-xs leading-5 text-[var(--muted)] lg:px-6">
              {runtimeStatus.agents.slice(0, 4).map((agent) => (
                <span key={agent.id} className="mr-4 inline-block">
                  <strong className="text-neutral-700">{agent.name}</strong> · {agent.outlet} · {agent.register} · {agent.status}
                  {agent.version ? ` · ${agent.version}` : ""}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {visibleSections.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-10 text-center">
            <Search className="mx-auto size-8 text-neutral-300" />
            <p className="mt-3 font-semibold text-neutral-800">Tidak ada bagian yang cocok.</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Coba kata kunci lain seperti DPAPI, SATO, Epson, fake, atau Scheduled Task.</p>
          </section>
        ) : null}

        {visibleSections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-5 rounded-3xl border border-[var(--border)] bg-white p-5 lg:p-7"
          >
            <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                  {section.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {section.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {section.badges.map((badge) => (
                  <Badge key={badge} badge={badge} />
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-7">
              {section.steps.map((step) => (
                <article key={step.id} className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">{step.title}</h3>
                    <div className="mt-2 space-y-2">
                      {step.body.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-6 text-neutral-600">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>

                  {step.commands?.map((command, index) => (
                    <CommandBlock
                      key={`${step.id}:command:${index}`}
                      label={command.label}
                      code={command.code}
                    />
                  ))}

                  {step.checks?.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Checklist
                      </p>
                      <div className="mt-3 space-y-2">
                        {step.checks.map((check, index) => {
                          const id = `${step.id}:check:${index}`;
                          const checked = completed.has(id);
                          return (
                            <label
                              key={id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(id)}
                                className="mt-0.5 size-4 rounded border-neutral-300 accent-[var(--accent)]"
                              />
                              <span
                                className={cn(
                                  "text-sm leading-5",
                                  checked ? "text-neutral-400 line-through" : "text-neutral-700",
                                )}
                              >
                                {check}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {step.callout ? <Callout callout={step.callout} /> : null}
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 lg:p-7">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700" />
            <div>
              <h2 className="text-xl font-semibold text-emerald-950">Final outlet checklist</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                Outlet belum dianggap physically validated sampai seluruh item yang relevan selesai dan evidence dicatat pada outlet report.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {finalChecklist.map((check, index) => {
              const id = `final:${index}`;
              const checked = completed.has(id);
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200 bg-white/70 p-3"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="mt-0.5 size-4 accent-emerald-700"
                  />
                  <span
                    className={cn(
                      "text-sm leading-5 text-emerald-950",
                      checked && "opacity-50 line-through",
                    )}
                  >
                    {check}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
