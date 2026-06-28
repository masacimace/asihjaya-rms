export type HardwareAgentDisplayStatus = "online" | "stale" | "offline" | "disabled";

export type HardwareAgentDiagnostics = {
  configWarnings: string[];
  hasConfigWarnings: boolean;
  agentVersion: string | null;
  nodeVersion: string | null;
  platform: string | null;
  arch: string | null;
  hostname: string | null;
  requestTimeoutMs: number | null;
  printCommandTimeoutMs: number | null;
};

export type HardwareAgentSummary = {
  id: string;
  code: string;
  name: string;
  dbStatus: "online" | "offline" | "disabled";
  displayStatus: HardwareAgentDisplayStatus;
  isActive: boolean;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  register: {
    id: string;
    code: string;
    name: string;
  };
  capabilities: Record<string, unknown>;
  settings: Record<string, unknown>;
  diagnostics: HardwareAgentDiagnostics;
  lastSeenAt: Date | null;
  lastIpAddress: string | null;
  lastUserAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HardwareJobSummary = {
  id: string;
  jobType:
    | "print_label_sato"
    | "print_receipt_certificate"
    | "open_cash_drawer"
    | "test_label_printer"
    | "test_document_printer"
    | "test_cash_drawer";
  deviceType: "label_printer" | "document_printer" | "cash_drawer" | "other";
  status: "pending" | "claimed" | "printing" | "completed" | "failed" | "cancelled";
  targetDevice: string | null;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  errorCategory: string | null;
  errorCode: string | null;
  durationMs: number | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
  updatedAt: Date;
  claimedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  isStale: boolean;
  agent: {
    id: string;
    code: string;
    name: string;
  } | null;
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  register: {
    id: string;
    code: string;
    name: string;
  };
};

export type HardwareJobStatusSummary = {
  pending: number;
  claimed: number;
  printing: number;
  completed: number;
  failed: number;
  cancelled: number;
};

export type HardwareJobCleanupPreview = {
  completed: number;
  cancelled: number;
  failed: number;
  totalEligible: number;
  retentionDays: {
    completed: number;
    cancelled: number;
    failed: number;
  };
  cutoffs: {
    completed: Date;
    cancelled: Date;
    failed: Date;
  };
};

export type HardwareHubDashboard = {
  agents: HardwareAgentSummary[];
  recentJobs: HardwareJobSummary[];
  jobStatusSummary: HardwareJobStatusSummary;
  cleanupPreview: HardwareJobCleanupPreview;
  totals: {
    agents: number;
    onlineAgents: number;
    staleAgents: number;
    offlineAgents: number;
    disabledAgents: number;
    configurationWarningAgents: number;
    pendingJobs: number;
    failedJobs: number;
    staleJobs: number;
    cleanupEligibleJobs: number;
  };
};
