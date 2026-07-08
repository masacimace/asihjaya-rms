import { and, eq } from "drizzle-orm";

import { registers } from "@/db/schema";

export const DEFAULT_POS_REGISTER_MISSING_MESSAGE =
  "Register Hardware Hub aktif belum dikonfigurasi untuk outlet ini. Aktifkan satu register sebagai Hardware Hub sebelum memakai POS.";

export const DEFAULT_POS_REGISTER_SHIFT_MESSAGE =
  "Register Hardware Hub aktif belum tersedia. Hubungi manager/admin untuk cek konfigurasi outlet dan Mini PC Hardware Hub.";

export function getDefaultPosRegisterCondition(outletId: string) {
  return and(
    eq(registers.outletId, outletId),
    eq(registers.isActive, true),
    eq(registers.isHardwareHub, true),
  );
}
