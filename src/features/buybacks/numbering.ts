import { randomUUID } from "node:crypto";

import { getBusinessCompactDate } from "@/lib/time/business-time";

export function generateBuybackNumber({
  outletCode,
  date,
  timeZone,
}: {
  outletCode: string;
  date: Date;
  timeZone: string;
}) {
  const dateKey = getBusinessCompactDate(date, timeZone);
  const randomSuffix = randomUUID().slice(0, 8).toUpperCase();
  return `AJ-BB-${outletCode}-${dateKey}-${randomSuffix}`.slice(0, 80);
}
