import type { LegacyCutoverSessionSummary } from "@/features/legacy-migration/cutover-contracts";

export type LegacyControlActionTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export type LegacyControlAction = {
  label: string;
  description: string;
  href: string;
  tone: LegacyControlActionTone;
};

export type LegacyWorkflowStepState = "complete" | "current" | "upcoming";

export type LegacyWorkflowStep = {
  key: "mapping" | "sessions" | "review" | "readiness" | "completed";
  label: string;
  helper: string;
  state: LegacyWorkflowStepState;
};

type MappingSummary = {
  pending: number;
  mapped: number;
  ignored: number;
};

type SessionWithIssues = Pick<
  LegacyCutoverSessionSummary,
  | "id"
  | "name"
  | "status"
  | "totalVerifications"
  | "unresolvedCount"
  | "issueCount"
  | "issues"
  | "canExecute"
  | "cutoverRun"
>;

export function getLegacySessionControlAction(
  batchId: string,
  session: SessionWithIssues,
): LegacyControlAction {
  const basePath = `/admin/migrasi-produk/${batchId}`;

  if (session.status === "completed" || session.cutoverRun) {
    return {
      label: "Lihat laporan aktivasi",
      description: "Stok sesi sudah aktif dan laporan transaksi tersimpan.",
      href: `${basePath}/cutover#session-${session.id}`,
      tone: "success",
    };
  }

  if (session.status === "cancelled") {
    return {
      label: "Lihat sesi dibatalkan",
      description: "Sesi tidak lagi menerima scan atau aktivasi stok.",
      href: `${basePath}/sesi#session-${session.id}`,
      tone: "neutral",
    };
  }

  if (session.status === "draft") {
    return {
      label: "Siapkan dan mulai sesi",
      description: "Periksa staff yang ditugaskan, lalu mulai proses scan.",
      href: `${basePath}/sesi#session-${session.id}`,
      tone: "accent",
    };
  }

  if (session.status === "active") {
    if (session.unresolvedCount > 0) {
      return {
        label: `Selesaikan ${session.unresolvedCount} review`,
        description: "Verification yang belum final harus dibereskan sebelum sesi dikunci.",
        href: `${basePath}/review?status=pending&sessionId=${session.id}`,
        tone: "warning",
      };
    }

    if (session.totalVerifications === 0) {
      return {
        label: "Mulai scan barang",
        description: "Sesi aktif dan belum memiliki verification.",
        href: `/pos/migrasi-barang/${session.id}`,
        tone: "accent",
      };
    }

    return {
      label: "Kunci saat scan selesai",
      description: "Tidak ada review tertunda. Manager dapat mengunci sesi setelah area selesai dipindai.",
      href: `${basePath}/sesi#session-${session.id}`,
      tone: "accent",
    };
  }

  if (session.canExecute) {
    return {
      label: "Aktifkan stok transactional",
      description: "Preflight bersih dan sesi siap diaktifkan.",
      href: `${basePath}/cutover#session-${session.id}`,
      tone: "success",
    };
  }

  const firstIssue = session.issues[0];
  return {
    label:
      session.issueCount > 0
        ? `Selesaikan ${session.issueCount} blocker`
        : "Periksa kesiapan sesi",
    description:
      firstIssue?.label ??
      "Periksa readiness sebelum menjalankan aktivasi stok.",
    href: firstIssue?.href ?? `${basePath}/rekonsiliasi#session-${session.id}`,
    tone: session.issueCount > 0 ? "warning" : "neutral",
  };
}

export function getLegacyBatchControlAction(input: {
  batchId: string;
  mapping: MappingSummary;
  sessions: SessionWithIssues[];
  batchIssues: Array<{ label: string; count: number; href: string }>;
}): LegacyControlAction {
  const { batchId, mapping, sessions, batchIssues } = input;
  const basePath = `/admin/migrasi-produk/${batchId}`;

  if (mapping.pending > 0) {
    return {
      label: `Selesaikan ${mapping.pending} mapping master`,
      description: "Hubungkan master legacy sebelum verification disetujui.",
      href: `${basePath}/mapping`,
      tone: "warning",
    };
  }

  if (sessions.length === 0) {
    return {
      label: "Buat sesi migrasi pertama",
      description: "Bagi pekerjaan berdasarkan etalase atau lokasi fisik.",
      href: `${basePath}/sesi`,
      tone: "accent",
    };
  }

  const firstBatchIssue = batchIssues[0];
  if (firstBatchIssue) {
    const total = batchIssues.reduce((sum, issue) => sum + issue.count, 0);
    return {
      label: `Selesaikan ${total} blocker batch`,
      description: firstBatchIssue.label,
      href: firstBatchIssue.href,
      tone: "warning",
    };
  }

  const executable = sessions.find((session) => session.canExecute);
  if (executable) {
    return {
      label: `Aktifkan stok ${executable.name}`,
      description: "Sesi sudah dikunci dan seluruh preflight transactional bersih.",
      href: `${basePath}/cutover#session-${executable.id}`,
      tone: "success",
    };
  }

  const lockedWithIssues = sessions.find(
    (session) => session.status === "locked" && session.issueCount > 0,
  );
  if (lockedWithIssues) {
    const firstIssue = lockedWithIssues.issues[0];
    return {
      label: `Selesaikan ${lockedWithIssues.issueCount} blocker`,
      description: `${lockedWithIssues.name}: ${firstIssue?.label ?? "readiness belum bersih"}.`,
      href:
        firstIssue?.href ??
        `${basePath}/rekonsiliasi#session-${lockedWithIssues.id}`,
      tone: "warning",
    };
  }

  const activeWithReview = sessions.find(
    (session) => session.status === "active" && session.unresolvedCount > 0,
  );
  if (activeWithReview) {
    return {
      label: `Review ${activeWithReview.unresolvedCount} verification`,
      description: `${activeWithReview.name} memiliki verification yang belum final.`,
      href: `${basePath}/review?status=pending&sessionId=${activeWithReview.id}`,
      tone: "warning",
    };
  }

  const active = sessions.find((session) => session.status === "active");
  if (active) {
    return {
      label:
        active.totalVerifications === 0
          ? `Mulai scan ${active.name}`
          : `Lanjutkan ${active.name}`,
      description:
        active.totalVerifications === 0
          ? "Sesi aktif dan siap menerima scan pertama."
          : "Lanjutkan scan atau kunci sesi ketika area fisik sudah selesai.",
      href:
        active.totalVerifications === 0
          ? `/pos/migrasi-barang/${active.id}`
          : `${basePath}/sesi#session-${active.id}`,
      tone: "accent",
    };
  }

  const draft = sessions.find((session) => session.status === "draft");
  if (draft) {
    return {
      label: `Mulai sesi ${draft.name}`,
      description: "Periksa assignment staff lalu aktifkan sesi.",
      href: `${basePath}/sesi#session-${draft.id}`,
      tone: "accent",
    };
  }

  const completed = sessions.filter(
    (session) => session.status === "completed" || Boolean(session.cutoverRun),
  );
  if (completed.length > 0) {
    return {
      label: "Lihat laporan aktivasi",
      description: `${completed.length} sesi sudah selesai dan memiliki laporan cutover.`,
      href: `${basePath}/cutover`,
      tone: "success",
    };
  }

  return {
    label: "Kelola sesi migrasi",
    description: "Periksa status sesi dan tentukan langkah operasional berikutnya.",
    href: `${basePath}/sesi`,
    tone: "neutral",
  };
}

export function getLegacyWorkflowSteps(input: {
  mapping: MappingSummary;
  sessions: SessionWithIssues[];
}): LegacyWorkflowStep[] {
  const { mapping, sessions } = input;
  const activeSessions = sessions.filter(
    (session) => session.status !== "cancelled",
  );
  const hasSessions = activeSessions.length > 0;
  const mappingComplete = mapping.pending === 0;
  const reviewComplete =
    hasSessions &&
    activeSessions.every(
      (session) =>
        session.unresolvedCount === 0 &&
        session.status !== "draft" &&
        session.status !== "active",
    );
  const activationStarted = activeSessions.some(
    (session) => session.status === "locked" || session.status === "completed",
  );
  const allCompleted =
    hasSessions &&
    activeSessions.every(
      (session) => session.status === "completed" || Boolean(session.cutoverRun),
    );

  return [
    {
      key: "mapping",
      label: "Mapping master",
      helper: mappingComplete
        ? `${mapping.mapped} mapping siap`
        : `${mapping.pending} masih pending`,
      state: mappingComplete ? "complete" : "current",
    },
    {
      key: "sessions",
      label: "Sesi dan scan",
      helper: hasSessions
        ? `${activeSessions.length} sesi operasional`
        : "Belum ada sesi",
      state: hasSessions
        ? "complete"
        : mappingComplete
          ? "current"
          : "upcoming",
    },
    {
      key: "review",
      label: "Review dan pengecualian",
      helper: reviewComplete
        ? "Verification sudah final"
        : "Selesaikan scan dan review",
      state: reviewComplete
        ? "complete"
        : hasSessions
          ? "current"
          : "upcoming",
    },
    {
      key: "readiness",
      label: "Kesiapan dan aktivasi",
      helper: allCompleted
        ? "Semua sesi sudah aktif"
        : activationStarted
          ? "Periksa blocker per sesi"
          : "Menunggu sesi dikunci",
      state: allCompleted
        ? "complete"
        : activationStarted
          ? "current"
          : "upcoming",
    },
    {
      key: "completed",
      label: "Laporan selesai",
      helper: allCompleted
        ? "Laporan cutover tersedia"
        : "Tersedia setelah aktivasi",
      state: allCompleted ? "complete" : "upcoming",
    },
  ];
}
