import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function load(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File tidak ditemukan: ${relativePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");

  return {
    relativePath,
    absolutePath,
    eol: raw.includes("\r\n") ? "\r\n" : "\n",
    source: raw.replace(/\r\n/g, "\n"),
  };
}

function save(file) {
  const output =
    file.eol === "\r\n"
      ? file.source.replace(/\n/g, "\r\n")
      : file.source;

  fs.writeFileSync(file.absolutePath, output, "utf8");
}

function replaceOnce(file, before, after, label) {
  const count = file.source.split(before).length - 1;

  if (count === 0 && file.source.includes(after)) {
    console.log(`SKIP: ${label} sudah diterapkan.`);
    return;
  }

  if (count !== 1) {
    throw new Error(
      `${label}: expected tepat 1 anchor, ditemukan ${count} di ${file.relativePath}.`,
    );
  }

  file.source = file.source.replace(before, after);
  console.log(`APPLY: ${label}`);
}

function patch(relativePath, callback) {
  const file = load(relativePath);
  callback(file);
  save(file);
}

// -----------------------------------------------------------------------------
// 1. Processing Workspace
// -----------------------------------------------------------------------------
patch("src/components/buybacks/buyback-processing-workspace.tsx", (file) => {
  replaceOnce(
    file,
    `import {
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  PackageCheck,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";`,
    `import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Clock3,
  ImagePlus,
  LoaderCircle,
  PackageCheck,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";`,
    "Processing Workspace: import quick-print UI",
  );

  replaceOnce(
    file,
    `function weightDifference(before: string, after: string | null) {
  if (!after) return null;
  const difference = Number(after) - Number(before);
  if (!Number.isFinite(difference)) return null;
  const sign = difference > 0 ? "+" : "";
  return \`\${sign}\${difference.toFixed(3)} gr\`;
}

function ProcessingProductImage({`,
    `function weightDifference(before: string, after: string | null) {
  if (!after) return null;
  const difference = Number(after) - Number(before);
  if (!Number.isFinite(difference)) return null;
  const sign = difference > 0 ? "+" : "";
  return \`\${sign}\${difference.toFixed(3)} gr\`;
}

function QuickLabelPrintButton({
  itemId,
  compact = false,
}: {
  itemId: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "printing" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function printLabel() {
    setStatus("printing");
    setMessage(null);

    try {
      const response = await fetch("/api/print-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          itemId,
          copies: 1,
          requestId: crypto.randomUUID(),
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Label belum dapat dikirim ke printer.");
      }

      setStatus("success");
      setMessage("Label dikirim ke printer.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Label belum dapat dikirim ke printer.",
      );
    }
  }

  return (
    <div className={compact ? "min-w-0" : "w-full"}>
      <button
        type="button"
        onClick={printLabel}
        disabled={status === "printing"}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 font-semibold !text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60",
          compact ? "h-9 px-3 text-xs" : "h-11 w-full px-4 text-sm",
        )}
      >
        {status === "printing" ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Printer className="size-4" />
        )}
        {status === "printing"
          ? "Mengirim..."
          : status === "success"
            ? "Cetak Lagi"
            : "Cetak Label"}
      </button>
      {message ? (
        <p
          className={cn(
            "mt-1.5 text-xs",
            status === "error" ? "text-red-700" : "text-emerald-700",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ProcessingProductImage({`,
    "Processing Workspace: add reusable QuickLabelPrintButton",
  );

  replaceOnce(
    file,
    `  priceRates,
  onClose,
  onCompleted,
}: {
  row: BuybackProcessingQueueRow;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  onClose: () => void;
  onCompleted: (message: string) => void;
}) {
  const [state, formAction, isPending] = useActionState(
    completeBuybackProcessingAction,
    initialBuybackProcessingActionState,
  );
  const router = useRouter();`,
    `  priceRates,
  onClose,
  onCompleted,
  canPrintLabel,
  canViewInventory,
}: {
  row: BuybackProcessingQueueRow;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  onClose: () => void;
  onCompleted: (message: string) => void;
  canPrintLabel: boolean;
  canViewInventory: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    completeBuybackProcessingAction,
    initialBuybackProcessingActionState,
  );
  const completionReportedRef = useRef(false);
  const router = useRouter();`,
    "Processing Drawer: add print/inventory permissions",
  );

  replaceOnce(
    file,
    `  useEffect(() => {
    if (state.status === "success") {
      onCompleted(state.message ?? "Pemrosesan Buyback selesai.");
    }
  }, [onCompleted, state.message, state.status]);`,
    `  useEffect(() => {
    if (state.status !== "success" || completionReportedRef.current) return;
    completionReportedRef.current = true;
    onCompleted(state.message ?? "Pemrosesan Buyback selesai.");
  }, [onCompleted, state.message, state.status]);`,
    "Processing Drawer: report completion once without closing drawer",
  );

  replaceOnce(
    file,
    `      weightGram,
    ],
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/35 lg:flex lg:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyback-processing-title"`,
    `      weightGram,
    ],
  );

  if (state.status === "success" && state.result) {
    return (
      <div
        className="fixed inset-0 z-[70] bg-black/35 lg:flex lg:justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buyback-processing-success-title"
      >
        <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white lg:w-[min(560px,calc(100vw-48px))] lg:border-l lg:border-[var(--border)]">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Processing selesai
              </span>
              <h2
                id="buyback-processing-success-title"
                className="mt-2 text-lg font-semibold text-neutral-950"
              >
                Item siap dijual
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Hasil {processingLabel(state.result.processingType)} sudah masuk
                Inventory dan tersedia di POS.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
              aria-label="Tutup"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto p-5 sm:p-6">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <PackageCheck className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-950">
                    {row.sourceDisplayName}
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">
                    SKU {state.result.sku}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    Barcode {state.result.barcode}
                  </p>
                </div>
              </div>
            </div>

            {canPrintLabel ? (
              <div className="mt-5">
                <QuickLabelPrintButton itemId={state.result.productItemId} />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                Item sudah tersimpan. Akun ini belum memiliki permission cetak
                label inventaris.
              </div>
            )}

            <div
              className={cn(
                "mt-4 grid gap-2",
                canViewInventory && "sm:grid-cols-2",
              )}
            >
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Selesai
              </button>
              {canViewInventory ? (
                <Link
                  href={\`/admin/inventaris/item/\${state.result.productItemId}\`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  Lihat Item
                  <ArrowUpRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/35 lg:flex lg:justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyback-processing-title"`,
    "Processing Drawer: keep success state open with SKU/barcode/quick print",
  );

  replaceOnce(
    file,
    `  priceRates,
  canProcess,
}: {
  data: BuybackProcessingData;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
}) {`,
    `  priceRates,
  canProcess,
  canPrintLabel,
  canViewInventory,
}: {
  data: BuybackProcessingData;
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
  canPrintLabel: boolean;
  canViewInventory: boolean;
}) {`,
    "Processing Workspace: accept print/inventory permissions",
  );

  replaceOnce(
    file,
    `                            Proses {processingLabel(row.processingType)}
                          </button>
                        </div>
                      ) : null}
                    </article>`,
    `                            Proses {processingLabel(row.processingType)}
                          </button>
                        </div>
                      ) : row.resultProductItemId && canPrintLabel ? (
                        <div className="border-t border-[var(--border)] bg-neutral-50 p-3">
                          <QuickLabelPrintButton
                            itemId={row.resultProductItemId}
                          />
                        </div>
                      ) : null}
                    </article>`,
    "Processing Workspace: completed mobile card quick print",
  );

  replaceOnce(
    file,
    `                          ) : (
                            <span className="text-xs text-[var(--muted)]">
                              {formatDate(row.processedAt)}
                            </span>
                          )}`,
    `                          ) : (
                            <div className="space-y-2">
                              <span className="block text-xs text-[var(--muted)]">
                                {formatDate(row.processedAt)}
                              </span>
                              {row.resultProductItemId && canPrintLabel ? (
                                <QuickLabelPrintButton
                                  itemId={row.resultProductItemId}
                                  compact
                                />
                              ) : null}
                            </div>
                          )}`,
    "Processing Workspace: completed desktop row quick print",
  );

  replaceOnce(
    file,
    `          onClose={() => setSelected(null)}
          onCompleted={(message) => {
            setFeedback(message);
            setSelected(null);
            router.refresh();
          }}
        />`,
    `          onClose={() => setSelected(null)}
          onCompleted={(message) => {
            setFeedback(message);
            router.refresh();
          }}
          canPrintLabel={canPrintLabel}
          canViewInventory={canViewInventory}
        />`,
    "Processing Workspace: keep drawer open after completion",
  );
});

// -----------------------------------------------------------------------------
// 2. Processing page permissions
// -----------------------------------------------------------------------------
patch("src/app/(pos)/pos/buyback/pemrosesan/page.tsx", (file) => {
  replaceOnce(
    file,
    `        canProcess={hasPermission(auth, "buybacks.create")}
      />`,
    `        canProcess={hasPermission(auth, "buybacks.create")}
        canPrintLabel={hasPermission(auth, "inventory.print_label")}
        canViewInventory={
          hasPermission(auth, "inventory.view") ||
          hasPermission(auth, "inventory.receive") ||
          hasPermission(auth, "inventory.adjust") ||
          hasPermission(auth, "inventory.transfer") ||
          hasPermission(auth, "inventory.manage")
        }
      />`,
    "Processing page: pass print/inventory permissions",
  );
});

// -----------------------------------------------------------------------------
// 3. Quick actions opened from Buyback history
// -----------------------------------------------------------------------------
patch("src/components/buybacks/buyback-processing-quick-actions.tsx", (file) => {
  replaceOnce(
    file,
    `  priceRates,
  canProcess,
  variant = "desktop",
}: {
  rows: BuybackProcessingQueueRow[];
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
  variant?: "mobile" | "desktop";`,
    `  priceRates,
  canProcess,
  canPrintLabel,
  canViewInventory,
  variant = "desktop",
}: {
  rows: BuybackProcessingQueueRow[];
  categories: ProductMasterCategoryOption[];
  productMasters: ProductMasterOption[];
  colorPresets: ProductColorPresetOption[];
  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
  canPrintLabel: boolean;
  canViewInventory: boolean;
  variant?: "mobile" | "desktop";`,
    "Quick Actions: accept print/inventory permissions",
  );

  replaceOnce(
    file,
    `          onClose={() => setSelected(null)}
          onCompleted={() => {
            setSelected(null);
            router.refresh();
          }}
        />`,
    `          onClose={() => setSelected(null)}
          onCompleted={() => {
            router.refresh();
          }}
          canPrintLabel={canPrintLabel}
          canViewInventory={canViewInventory}
        />`,
    "Quick Actions: keep success drawer open and pass permissions",
  );
});

// -----------------------------------------------------------------------------
// 4. History panel prop contract + quick-action calls
// -----------------------------------------------------------------------------
patch("src/components/buybacks/buyback-history-panel.tsx", (file) => {
  replaceOnce(
    file,
    `  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
};`,
    `  priceRates: BuybackProcessingRateOption[];
  canProcess: boolean;
  canPrintLabel: boolean;
  canViewInventory: boolean;
};`,
    "History Panel: extend quick-action permission contract",
  );

  replaceOnce(
    file,
    `                    priceRates={processingQuickActions.priceRates}
                    canProcess={processingQuickActions.canProcess}
                    variant="mobile"`,
    `                    priceRates={processingQuickActions.priceRates}
                    canProcess={processingQuickActions.canProcess}
                    canPrintLabel={processingQuickActions.canPrintLabel}
                    canViewInventory={processingQuickActions.canViewInventory}
                    variant="mobile"`,
    "History Panel: mobile quick actions permissions",
  );

  replaceOnce(
    file,
    `                            priceRates={processingQuickActions.priceRates}
                            canProcess={processingQuickActions.canProcess}
                          />`,
    `                            priceRates={processingQuickActions.priceRates}
                            canProcess={processingQuickActions.canProcess}
                            canPrintLabel={processingQuickActions.canPrintLabel}
                            canViewInventory={processingQuickActions.canViewInventory}
                          />`,
    "History Panel: desktop quick actions permissions",
  );
});

// -----------------------------------------------------------------------------
// 5. Compact history panel quick-action call
// -----------------------------------------------------------------------------
patch("src/components/buybacks/buyback-compact-history-panel.tsx", (file) => {
  replaceOnce(
    file,
    `                          priceRates={processingQuickActions.priceRates}
                          canProcess={processingQuickActions.canProcess}
                        />`,
    `                          priceRates={processingQuickActions.priceRates}
                          canProcess={processingQuickActions.canProcess}
                          canPrintLabel={processingQuickActions.canPrintLabel}
                          canViewInventory={processingQuickActions.canViewInventory}
                        />`,
    "Compact History: pass quick-print permissions",
  );
});

// -----------------------------------------------------------------------------
// 6. Buyback main page quick-action permission payload
// -----------------------------------------------------------------------------
patch("src/app/(pos)/pos/buyback/page.tsx", (file) => {
  replaceOnce(
    file,
    `      canProcess: canCreate,
    };`,
    `      canProcess: canCreate,
      canPrintLabel: hasPermission(auth, "inventory.print_label"),
      canViewInventory:
        hasPermission(auth, "inventory.view") ||
        hasPermission(auth, "inventory.receive") ||
        hasPermission(auth, "inventory.adjust") ||
        hasPermission(auth, "inventory.transfer") ||
        hasPermission(auth, "inventory.manage"),
    };`,
    "Buyback main page: quick-action print/inventory permissions",
  );
});

// -----------------------------------------------------------------------------
// 7. Buyback history page quick-action permission payload
// -----------------------------------------------------------------------------
patch("src/app/(pos)/pos/buyback/riwayat/page.tsx", (file) => {
  replaceOnce(
    file,
    `      canProcess: canCreate,
    };`,
    `      canProcess: canCreate,
      canPrintLabel: hasPermission(auth, "inventory.print_label"),
      canViewInventory:
        hasPermission(auth, "inventory.view") ||
        hasPermission(auth, "inventory.receive") ||
        hasPermission(auth, "inventory.adjust") ||
        hasPermission(auth, "inventory.transfer") ||
        hasPermission(auth, "inventory.manage"),
    };`,
    "Buyback history page: quick-action print/inventory permissions",
  );
});

// -----------------------------------------------------------------------------
// 8. Existing processing regression contract
// -----------------------------------------------------------------------------
patch("scripts/check-buyback-b3-processing.ts", (file) => {
  replaceOnce(
    file,
    `assert(
  service.includes("calculateJewelryBasePrice({") &&
    !service.includes("pricePerGram: payload.pricePerGram -"),
  "Potongan/Gram metadata tidak boleh mengubah kalkulasi sellingAmount hasil.",
);`,
    `assert(
  workspace.includes("QuickLabelPrintButton") &&
    workspace.includes('fetch("/api/print-jobs"') &&
    workspace.includes("Cetak Label") &&
    workspace.includes("Cetak Lagi") &&
    page.includes('hasPermission(auth, "inventory.print_label")'),
  "Processing selesai wajib menyediakan quick print dengan permission label existing.",
);

assert(
  service.includes("calculateJewelryBasePrice({") &&
    !service.includes("pricePerGram: payload.pricePerGram -"),
  "Potongan/Gram metadata tidak boleh mengubah kalkulasi sellingAmount hasil.",
);`,
    "Processing regression: assert quick print integration",
  );
});

console.log("");
console.log("Batch 4 Buyback Processing → Quick Print Label berhasil diterapkan.");
console.log("Tidak ada schema/migration/barcode generator/hardware endpoint baru.");
