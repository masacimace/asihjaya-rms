export type QuickProductColorPresetActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  createdPreset?: {
    id: string;
    name: string;
    description: string | null;
  };
};

export const initialQuickProductColorPresetActionState: QuickProductColorPresetActionState = {
  status: "idle",
};
