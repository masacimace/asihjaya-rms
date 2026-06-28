export type RoleActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialRoleActionState: RoleActionState = {
  status: "idle",
};
