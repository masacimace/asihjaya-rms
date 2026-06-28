export type StaffActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialStaffActionState: StaffActionState = {
  status: "idle",
};
