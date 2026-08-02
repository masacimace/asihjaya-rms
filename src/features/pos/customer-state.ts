import type {
  PosCustomerOption,
  PosQuickCustomerPayload,
} from "@/features/pos/contracts";

export type QuickCustomerFormState = {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
};

export function getCustomerCode(customer: PosCustomerOption) {
  return customer.customerCode?.trim() || "Tanpa kode";
}

export function getCustomerContactLabel(customer: PosCustomerOption) {
  return customer.phone || customer.email || "Kontak belum dilengkapi";
}

export function getCustomerSearchText(customer: PosCustomerOption) {
  return [
    customer.customerCode,
    customer.fullName,
    customer.phone,
    customer.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function createQuickCustomerFormState(
  query: string,
): QuickCustomerFormState {
  const normalizedQuery = query.trim();
  const phoneMatch = normalizedQuery.match(/(?:\+?62|0|8)[0-9\s().-]{7,}$/);
  const matchedPhone = phoneMatch?.[0]?.trim() ?? "";
  const fullName = matchedPhone
    ? normalizedQuery.slice(0, phoneMatch?.index ?? 0).trim()
    : /[a-zA-Z]/.test(normalizedQuery)
      ? normalizedQuery
      : "";
  const phone = matchedPhone || (!fullName ? normalizedQuery : "");

  return {
    fullName,
    phone,
    email: "",
    notes: "",
  };
}

export function createQuickCustomerPayload(
  form: QuickCustomerFormState,
): PosQuickCustomerPayload {
  return {
    fullName: form.fullName,
    phone: form.phone,
    email: form.email || null,
    notes: form.notes || null,
  };
}

export function mergeCustomerOptions({
  customers,
  createdCustomers,
}: {
  customers: PosCustomerOption[];
  createdCustomers: PosCustomerOption[];
}) {
  const customerById = new Map<string, PosCustomerOption>();

  for (const customer of [...createdCustomers, ...customers]) {
    if (!customerById.has(customer.id)) {
      customerById.set(customer.id, customer);
    }
  }

  return Array.from(customerById.values());
}

export function rememberCustomerOption(
  currentCustomers: PosCustomerOption[],
  customer: PosCustomerOption,
) {
  return [
    customer,
    ...currentCustomers.filter(
      (currentCustomer) => currentCustomer.id !== customer.id,
    ),
  ];
}

export function searchCustomerOptions({
  customers,
  query,
  limit = 8,
}: {
  customers: PosCustomerOption[];
  query: string;
  limit?: number;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const matchedCustomers = normalizedQuery
    ? customers.filter((customer) =>
        getCustomerSearchText(customer).includes(normalizedQuery),
      )
    : customers;

  return matchedCustomers.slice(0, limit);
}
