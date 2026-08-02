import assert from "node:assert/strict";

import {
  getPosWorkspaceCommandIntent,
  normalizePosWorkspaceCommand,
  POS_PENDING_COMMAND_STORAGE_KEY,
  POS_WORKSPACE_COMMAND_EVENT,
} from "@/features/pos/workspace-command";

assert.equal(POS_WORKSPACE_COMMAND_EVENT, "asihjaya:pos-workspace-command");
assert.equal(
  POS_PENDING_COMMAND_STORAGE_KEY,
  "asihjaya:pos-workspace-pending-command",
);

assert.equal(normalizePosWorkspaceCommand(null), null);
assert.equal(normalizePosWorkspaceCommand("scan"), null);
assert.equal(
  normalizePosWorkspaceCommand({ type: "unknown", value: "SKU-001" }),
  null,
);
assert.equal(
  normalizePosWorkspaceCommand({ type: "scan", value: "   " }),
  null,
);
assert.deepEqual(
  normalizePosWorkspaceCommand({ type: "scan", value: "  SKU-001  " }),
  { type: "scan", value: "SKU-001" },
);
assert.deepEqual(
  normalizePosWorkspaceCommand({ type: "search", value: "   " }),
  { type: "search", value: "" },
);
assert.deepEqual(
  normalizePosWorkspaceCommand({ type: "search", value: "  cincin  " }),
  { type: "search", value: "cincin" },
);

assert.deepEqual(
  getPosWorkspaceCommandIntent({ type: "search", value: "" }),
  { type: "clear_search" },
);
assert.deepEqual(
  getPosWorkspaceCommandIntent({ type: "search", value: " gelang " }),
  { type: "filter", value: "gelang" },
);
assert.deepEqual(
  getPosWorkspaceCommandIntent({ type: "scan", value: " QR-001 " }),
  { type: "scan", value: "QR-001" },
);

console.log("POS workspace command checks passed.");
