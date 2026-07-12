"use client";

import { useState } from "react";

function formatIdrAmount(value: string | number) {
  const digits = String(value)
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 15);

  if (!digits) return "";

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type IdrCurrencyInputProps = {
  name: string;
  defaultValue: string | number;
  className?: string;
  required?: boolean;
  ariaLabel?: string;
};

export function IdrCurrencyInput({
  name,
  defaultValue,
  className,
  required = false,
  ariaLabel,
}: IdrCurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    formatIdrAmount(defaultValue),
  );
  const numericValue = displayValue.replace(/\D/g, "");

  return (
    <>
      <input type="hidden" name={name} value={numericValue} />
      <input
        type="text"
        value={displayValue}
        onChange={(event) =>
          setDisplayValue(formatIdrAmount(event.target.value))
        }
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        required={required}
        aria-label={ariaLabel}
        placeholder="0"
        className={className}
      />
    </>
  );
}
