export type MetalPriceRateActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialMetalPriceRateActionState: MetalPriceRateActionState = {
  status: "idle",
};
