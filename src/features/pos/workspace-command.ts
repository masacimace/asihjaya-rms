export const POS_WORKSPACE_COMMAND_EVENT =
  "asihjaya:pos-workspace-command";
export const POS_PENDING_COMMAND_STORAGE_KEY =
  "asihjaya:pos-workspace-pending-command";

export type PosWorkspaceCommand = {
  type: "search" | "scan";
  value: string;
};

export function normalizePosWorkspaceCommand(
  value: unknown,
): PosWorkspaceCommand | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const command = value as Partial<PosWorkspaceCommand>;

  if (command.type !== "search" && command.type !== "scan") {
    return null;
  }

  if (typeof command.value !== "string") {
    return null;
  }

  const normalizedValue = command.value.trim();

  if (command.type === "scan" && !normalizedValue) {
    return null;
  }

  return {
    type: command.type,
    value: normalizedValue,
  };
}

export type PosWorkspaceCommandIntent =
  | { type: "clear_search" }
  | { type: "filter"; value: string }
  | { type: "scan"; value: string };

export function getPosWorkspaceCommandIntent(
  command: PosWorkspaceCommand,
): PosWorkspaceCommandIntent {
  const normalizedValue = command.value.trim();

  if (!normalizedValue) {
    return { type: "clear_search" };
  }

  if (command.type === "scan") {
    return { type: "scan", value: normalizedValue };
  }

  return { type: "filter", value: normalizedValue };
}
