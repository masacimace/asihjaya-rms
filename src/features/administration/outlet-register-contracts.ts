export type OperationsActionState = {
  status: "idle" | "success" | "error";

  message?: string;

  fieldErrors?: Record<string, string>;
};

export const initialOperationsActionState: OperationsActionState = {
  status: "idle",
};
