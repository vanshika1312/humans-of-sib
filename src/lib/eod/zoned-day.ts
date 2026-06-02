type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function findZonedUtcInstant(
  dateYmd: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const [wantY, wantM, wantD] = dateYmd.split("-").map(Number);
  let guess = Date.parse(`${dateYmd}T12:00:00.000Z`);

  for (let attempt = 0; attempt < 96; attempt++) {
    const parts = getZonedParts(new Date(guess), timeZone);
    if (
      parts.year === wantY &&
      parts.month === wantM &&
      parts.day === wantD &&
      parts.hour === hour &&
      parts.minute === minute &&
      parts.second === second
    ) {
      return new Date(guess);
    }
    guess +=
      (wantY - parts.year) * 31 * 86_400_000 +
      (wantM - parts.month) * 86_400_000 +
      (wantD - parts.day) * 86_400_000 +
      (hour - parts.hour) * 3_600_000 +
      (minute - parts.minute) * 60_000 +
      (second - parts.second) * 1000;
  }

  throw new Error(`Could not resolve ${dateYmd} ${hour}:${minute}:${second} in ${timeZone}`);
}

/** Calendar day `[start, end)` in `timeZone`, expressed as UTC instants. */
export function zonedDayBounds(
  dateYmd: string,
  timeZone: string,
): { startInclusive: Date; endExclusive: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const startInclusive = findZonedUtcInstant(dateYmd, 0, 0, 0, timeZone);
  const [y, m, d] = dateYmd.split("-").map(Number);
  const nextUtc = new Date(Date.UTC(y, m - 1, d + 1));
  const nextYmd = nextUtc.toISOString().slice(0, 10);
  const endExclusive = findZonedUtcInstant(nextYmd, 0, 0, 0, timeZone);
  return { startInclusive, endExclusive };
}

/** Parse HTML `datetime-local` value (YYYY-MM-DDTHH:mm) as an instant in `timeZone`. */
export function zonedLocalDateTimeToUtc(dateTimeLocal: string, timeZone: string): Date {
  const m = dateTimeLocal.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("Invalid local date/time");
  const [, dateYmd, hourStr, minuteStr] = m;
  return findZonedUtcInstant(dateYmd, Number(hourStr), Number(minuteStr), 0, timeZone);
}

/** Today as YYYY-MM-DD in the given IANA timezone. */
export function zonedTodayYmd(timeZone: string): string {
  const parts = getZonedParts(new Date(), timeZone);
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}
