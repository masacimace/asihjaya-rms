export const DEFAULT_BUSINESS_TIME_ZONE = "Asia/Jakarta";

type BusinessDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timeZone: string) {
  const cached = dateTimeFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  dateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
}

export function normalizeBusinessTimeZone(
  value: string | null | undefined,
): string {
  const candidate = value?.trim() || DEFAULT_BUSINESS_TIME_ZONE;

  try {
    getDateTimeFormatter(candidate).format(new Date(0));
    return candidate;
  } catch {
    return DEFAULT_BUSINESS_TIME_ZONE;
  }
}

export function getBusinessDateTimeParts(
  date: Date,
  timeZone: string,
): BusinessDateTimeParts {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid business date.");
  }

  const normalizedTimeZone = normalizeBusinessTimeZone(timeZone);
  const values = new Map(
    getDateTimeFormatter(normalizedTimeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  const hour = values.get("hour");
  const minute = values.get("minute");
  const second = values.get("second");

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new RangeError(`Unable to resolve date parts for ${normalizedTimeZone}.`);
  }

  return { year, month, day, hour, minute, second };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getBusinessDateTimeParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const dateWithoutMilliseconds = Math.trunc(date.getTime() / 1000) * 1000;

  return representedAsUtc - dateWithoutMilliseconds;
}

function businessDateTimeToUtc(
  parts: BusinessDateTimeParts,
  timeZone: string,
): Date {
  const normalizedTimeZone = normalizeBusinessTimeZone(timeZone);
  const wallClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  let candidate = new Date(wallClockAsUtc);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const nextCandidate = new Date(
      wallClockAsUtc - getTimeZoneOffsetMs(candidate, normalizedTimeZone),
    );

    if (nextCandidate.getTime() === candidate.getTime()) {
      return candidate;
    }

    candidate = nextCandidate;
  }

  return candidate;
}

function shiftCalendarParts(
  parts: BusinessDateTimeParts,
  { days = 0, months = 0 }: { days?: number; months?: number },
): BusinessDateTimeParts {
  const calendar = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1 + months,
      parts.day + days,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );

  return {
    year: calendar.getUTCFullYear(),
    month: calendar.getUTCMonth() + 1,
    day: calendar.getUTCDate(),
    hour: calendar.getUTCHours(),
    minute: calendar.getUTCMinutes(),
    second: calendar.getUTCSeconds(),
  };
}


export function getStartOfBusinessDateKey(
  value: string,
  timeZone: string,
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const validationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() + 1 !== month ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  return businessDateTimeToUtc(
    { year, month, day, hour: 0, minute: 0, second: 0 },
    timeZone,
  );
}

export function getStartOfBusinessDay(
  date: Date,
  timeZone: string,
  dayOffset = 0,
): Date {
  const parts = shiftCalendarParts(
    {
      ...getBusinessDateTimeParts(date, timeZone),
      hour: 0,
      minute: 0,
      second: 0,
    },
    { days: dayOffset },
  );

  return businessDateTimeToUtc(parts, timeZone);
}

export function getStartOfBusinessMonth(
  date: Date,
  timeZone: string,
  monthOffset = 0,
): Date {
  const current = getBusinessDateTimeParts(date, timeZone);
  const shifted = shiftCalendarParts(
    {
      ...current,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    },
    { months: monthOffset },
  );

  return businessDateTimeToUtc({ ...shifted, day: 1 }, timeZone);
}

export function getStartOfBusinessHour(
  date: Date,
  timeZone: string,
): Date {
  const parts = getBusinessDateTimeParts(date, timeZone);

  return businessDateTimeToUtc(
    {
      ...parts,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}

export function addBusinessDays(
  date: Date,
  days: number,
  timeZone: string,
): Date {
  return businessDateTimeToUtc(
    shiftCalendarParts(getBusinessDateTimeParts(date, timeZone), { days }),
    timeZone,
  );
}

export function addBusinessHours(
  date: Date,
  hours: number,
  timeZone: string,
): Date {
  const parts = getBusinessDateTimeParts(date, timeZone);
  const calendar = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour + hours,
      parts.minute,
      parts.second,
    ),
  );

  return businessDateTimeToUtc(
    {
      year: calendar.getUTCFullYear(),
      month: calendar.getUTCMonth() + 1,
      day: calendar.getUTCDate(),
      hour: calendar.getUTCHours(),
      minute: calendar.getUTCMinutes(),
      second: calendar.getUTCSeconds(),
    },
    timeZone,
  );
}

export function getBusinessDateKey(
  date: Date,
  timeZone: string,
  separator = "-",
): string {
  const parts = getBusinessDateTimeParts(date, timeZone);

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join(separator);
}

export function getBusinessCompactDate(date: Date, timeZone: string): string {
  return getBusinessDateKey(date, timeZone, "");
}
