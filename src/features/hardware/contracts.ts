export type HardwareAgentDisplayStatus =
  "online" | "stale" | "offline" | "disabled";

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

export type HardwareJobManualResolution = {
  resolutionType: "confirmed_completed" | "retry_authorized" | "cancelled";
  reason: string;
  duplicateRiskAcknowledged: boolean;
  resolvedByUserId: string;
  resolvedByName: string | null;
  createdAt: Date;
};

export type HardwareJobSummary = {
  id: string;
  protocolVersion: number;
  jobType:
    | "print_label_sato"
    | "print_receipt_certificate"
    | "open_cash_drawer"
    | "test_label_printer"
    | "test_document_printer"
    | "test_cash_drawer";
  deviceType: "label_printer" | "document_printer" | "cash_drawer" | "other";
  status:
    | "pending"
    | "claimed"
    | "processing"
    | "printing"
    | "submitted"
    | "completed"
    | "failed"
    | "unknown_outcome"
    | "expired"
    | "cancelled";
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
  manualResolution: HardwareJobManualResolution | null;
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

export type HardwareJobAttemptDetail = {
  id: string;
  attemptNumber: number;
  status:
    | "claimed"
    | "processing"
    | "dispatching"
    | "submitted"
    | "acknowledged"
    | "failed_before_dispatch"
    | "unknown_after_dispatch"
    | "lease_expired"
    | "cancelled";
  eventSequence: number;
  dispatchStartedAt: Date | null;
  submittedAt: Date | null;
  serverAcknowledgedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  retrySafe: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  agent: {
    id: string;
    code: string;
    name: string;
  };
};

export type HardwareJobResolutionDetail = HardwareJobManualResolution & {
  id: string;
  attemptId: string | null;
  previousStatus: HardwareJobSummary["status"];
  nextStatus: HardwareJobSummary["status"];
};

export type HardwareJobOperationalDetail = {
  job: HardwareJobSummary & {
    payloadHash: string | null;
    requiredCapability: string | null;
    currentAttemptId: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    unknownAt: Date | null;
    submittedAt: Date | null;
    expiresAt: Date | null;
  };
  attempts: HardwareJobAttemptDetail[];
  resolutions: HardwareJobResolutionDetail[];
};

export type HardwareJobStatusSummary = {
  pending: number;
  claimed: number;
  processing: number;
  printing: number;
  submitted: number;
  completed: number;
  failed: number;
  unknown_outcome: number;
  expired: number;
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

export type HardwareOperationalAlert = {
  code:
    | "UNKNOWN_OUTCOME"
    | "STALE_SUBMITTED"
    | "AGENT_OFFLINE"
    | "AGENT_STALE"
    | "PENDING_TOO_OLD"
    | "FAILURE_RATE_HIGH";
  severity: "warning" | "critical";
  message: string;
};

export type HardwareOperationalObservability = {
  status: "healthy" | "warning" | "critical";
  generatedAt: Date;
  thresholds: {
    pendingWarningSeconds: number;
    submittedWarningSeconds: number;
    failureRateWarningPercent: number;
  };
  metrics: {
    unknownOutcomeJobs: number;
    staleSubmittedJobs: number;
    oldestPendingAgeSeconds: number | null;
    oldestSubmittedAgeSeconds: number | null;
    completedLast24Hours: number;
    failedLast24Hours: number;
    expiredLast24Hours: number;
    successRateLast24Hours: number | null;
    failureRateLast24Hours: number | null;
  };
  alerts: HardwareOperationalAlert[];
};

export type HardwareHubDashboard = {
  agents: HardwareAgentSummary[];
  recentJobs: HardwareJobSummary[];
  jobStatusSummary: HardwareJobStatusSummary;
  cleanupPreview: HardwareJobCleanupPreview;
  observability: HardwareOperationalObservability;
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
