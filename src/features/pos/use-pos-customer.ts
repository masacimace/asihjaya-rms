"use client";

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

import type {
  PosCustomerOption,
  PosQuickCustomerActionResult,
  PosQuickCustomerPayload,
} from "@/features/pos/contracts";
import {
  createQuickCustomerFormState,
  createQuickCustomerPayload,
  mergeCustomerOptions,
  rememberCustomerOption,
  searchCustomerOptions,
  type QuickCustomerFormState,
} from "@/features/pos/customer-state";

type CreateQuickCustomer = (
  payload: PosQuickCustomerPayload,
) => Promise<PosQuickCustomerActionResult>;

export type UsePosCustomerResult = {
  selectedCustomer: PosCustomerOption | null;
  customerQuery: string;
  customerOptions: PosCustomerOption[];
  customerSearchResults: PosCustomerOption[];
  isCustomerSelectorOpen: boolean;
  isQuickCustomerDialogOpen: boolean;
  quickCustomerForm: QuickCustomerFormState;
  quickCustomerResult: PosQuickCustomerActionResult | null;
  isQuickCustomerPending: boolean;
  restoreCustomer: (customer: PosCustomerOption | null) => void;
  selectCustomerState: (customer: PosCustomerOption) => void;
  clearCustomerState: () => void;
  changeCustomerQuery: (value: string) => boolean;
  openCustomerSelector: () => void;
  closeCustomerSelectorAfterDelay: () => void;
  openQuickCustomerDialog: () => void;
  closeQuickCustomerDialog: () => void;
  updateQuickCustomerForm: (
    field: keyof QuickCustomerFormState,
    value: string,
  ) => void;
  submitQuickCustomer: (
    onSuccess: (customer: PosCustomerOption, message: string) => void,
  ) => void;
  useExistingQuickCustomer: (
    customer: PosCustomerOption,
    onSelected: (customer: PosCustomerOption) => void,
  ) => void;
};

export function usePosCustomer({
  customers,
  createQuickCustomer,
}: {
  customers: PosCustomerOption[];
  createQuickCustomer: CreateQuickCustomer;
}): UsePosCustomerResult {
  const [selectedCustomer, setSelectedCustomer] =
    useState<PosCustomerOption | null>(null);
  const [createdCustomerOptions, setCreatedCustomerOptions] = useState<
    PosCustomerOption[]
  >([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [isQuickCustomerDialogOpen, setIsQuickCustomerDialogOpen] =
    useState(false);
  const [quickCustomerForm, setQuickCustomerForm] =
    useState<QuickCustomerFormState>(() => createQuickCustomerFormState(""));
  const [quickCustomerResult, setQuickCustomerResult] =
    useState<PosQuickCustomerActionResult | null>(null);
  const [isQuickCustomerPending, startQuickCustomerTransition] =
    useTransition();

  const customerOptions = useMemo(
    () => mergeCustomerOptions({ customers, createdCustomers: createdCustomerOptions }),
    [createdCustomerOptions, customers],
  );
  const customerSearchResults = useMemo(
    () => searchCustomerOptions({ customers: customerOptions, query: customerQuery }),
    [customerOptions, customerQuery],
  );

  const rememberCustomer = useCallback((customer: PosCustomerOption) => {
    setCreatedCustomerOptions((currentCustomers) =>
      rememberCustomerOption(currentCustomers, customer),
    );
  }, []);

  const restoreCustomer = useCallback((customer: PosCustomerOption | null) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer?.fullName ?? "");
    setIsCustomerSelectorOpen(false);
  }, []);

  const selectCustomerState = useCallback((customer: PosCustomerOption) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.fullName);
    setIsCustomerSelectorOpen(false);
  }, []);

  const clearCustomerState = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setIsCustomerSelectorOpen(false);
  }, []);

  const changeCustomerQuery = useCallback(
    (value: string) => {
      const clearedSelectedCustomer = Boolean(selectedCustomer);
      setCustomerQuery(value);
      setIsCustomerSelectorOpen(true);

      if (clearedSelectedCustomer) {
        setSelectedCustomer(null);
      }

      return clearedSelectedCustomer;
    },
    [selectedCustomer],
  );

  const openCustomerSelector = useCallback(() => {
    setIsCustomerSelectorOpen(true);
  }, []);

  const closeCustomerSelectorAfterDelay = useCallback(() => {
    window.setTimeout(() => setIsCustomerSelectorOpen(false), 120);
  }, []);

  const openQuickCustomerDialog = useCallback(() => {
    setQuickCustomerForm(createQuickCustomerFormState(customerQuery));
    setQuickCustomerResult(null);
    setIsCustomerSelectorOpen(false);
    setIsQuickCustomerDialogOpen(true);
  }, [customerQuery]);

  const closeQuickCustomerDialog = useCallback(() => {
    if (isQuickCustomerPending) {
      return;
    }

    setIsQuickCustomerDialogOpen(false);
    setQuickCustomerResult(null);
  }, [isQuickCustomerPending]);

  const updateQuickCustomerForm = useCallback(
    (field: keyof QuickCustomerFormState, value: string) => {
      setQuickCustomerForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }));
      setQuickCustomerResult(null);
    },
    [],
  );

  const submitQuickCustomer = useCallback(
    (onSuccess: (customer: PosCustomerOption, message: string) => void) => {
      const payload = createQuickCustomerPayload(quickCustomerForm);
      setQuickCustomerResult(null);

      startQuickCustomerTransition(async () => {
        try {
          const result = await createQuickCustomer(payload);

          if (result.status !== "success") {
            setQuickCustomerResult(result);
            return;
          }

          rememberCustomer(result.customer);
          setIsQuickCustomerDialogOpen(false);
          setQuickCustomerResult(null);
          onSuccess(result.customer, result.message);
        } catch {
          setQuickCustomerResult({
            status: "error",
            message:
              "Customer belum bisa disimpan. Periksa koneksi lalu coba kembali.",
          });
        }
      });
    },
    [createQuickCustomer, quickCustomerForm, rememberCustomer],
  );

  const useExistingQuickCustomer = useCallback(
    (
      customer: PosCustomerOption,
      onSelected: (customer: PosCustomerOption) => void,
    ) => {
      rememberCustomer(customer);
      setIsQuickCustomerDialogOpen(false);
      setQuickCustomerResult(null);
      onSelected(customer);
    },
    [rememberCustomer],
  );

  return {
    selectedCustomer,
    customerQuery,
    customerOptions,
    customerSearchResults,
    isCustomerSelectorOpen,
    isQuickCustomerDialogOpen,
    quickCustomerForm,
    quickCustomerResult,
    isQuickCustomerPending,
    restoreCustomer,
    selectCustomerState,
    clearCustomerState,
    changeCustomerQuery,
    openCustomerSelector,
    closeCustomerSelectorAfterDelay,
    openQuickCustomerDialog,
    closeQuickCustomerDialog,
    updateQuickCustomerForm,
    submitQuickCustomer,
    useExistingQuickCustomer,
  };
}
