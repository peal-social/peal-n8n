// Peal schedules an instant and keeps the time zone it was chosen in. n8n's date
// pickers give a wall-clock time without an offset, read in the workflow's time
// zone, while expressions may give a full ISO 8601 string. Both become an
// instant here, with no library: n8n Cloud refuses nodes that bring their own.

const offsetSuffix = /(?:[zZ]|[+-]\d{2}:?\d{2})$/u;

const wallClock =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?:[T ](?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:\.(?<fraction>\d{1,9}))?)?)?$/u;

/** Whether the runtime knows `timeZone` as an IANA time zone. */
export const isTimeZone = (timeZone: string): boolean => {
  if (timeZone.trim().length === 0) {
    return false;
  }

  try {
    return (
      Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone
        .length > 0
    );
  } catch {
    return false;
  }
};

const partsFormat = (timeZone: string): Intl.DateTimeFormat =>
  Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });

// The offset of `timeZone` from UTC at `instant`, in milliseconds.
const offsetAt = (instant: number, timeZone: string): number => {
  const parts = partsFormat(timeZone).formatToParts(new Date(instant));

  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour"),
    field("minute"),
    field("second")
  );

  const wholeSeconds = Math.floor(instant / 1000) * 1000;

  return asUtc - wholeSeconds;
};

interface WallClock {
  readonly day: string;
  readonly fraction: string | undefined;
  readonly hour: string | undefined;
  readonly minute: string | undefined;
  readonly month: string;
  readonly second: string | undefined;
  readonly year: string;
}

const readWallClock = (text: string): WallClock | undefined => {
  const groups = wallClock.exec(text)?.groups;
  const { year, month, day } = groups ?? {};

  return groups === undefined ||
    year === undefined ||
    month === undefined ||
    day === undefined
    ? undefined
    : {
        day,
        fraction: groups.fraction,
        hour: groups.hour,
        minute: groups.minute,
        month,
        second: groups.second,
        year,
      };
};

const fromWallClock = (time: WallClock, timeZone: string): string => {
  const milliseconds = Number(
    (time.fraction ?? "0").padEnd(3, "0").slice(0, 3)
  );

  const guess = Date.UTC(
    Number(time.year),
    Number(time.month) - 1,
    Number(time.day),
    Number(time.hour ?? "0"),
    Number(time.minute ?? "0"),
    Number(time.second ?? "0"),
    milliseconds
  );

  // The offset at the wall-clock time read as UTC is a first guess; reading it
  // again at the instant that guess gives settles it, daylight saving included.
  const first = guess - offsetAt(guess, timeZone);

  return new Date(guess - offsetAt(first, timeZone)).toISOString();
};

/**
 * Turns what a date field holds into an ISO 8601 instant in UTC. A string with
 * an offset (`Z`, `+02:00`) is that instant. A wall-clock time without one is
 * read in `timeZone`. Returns undefined for anything else.
 */
export const toInstant = (
  value: string,
  timeZone: string
): string | undefined => {
  const text = value.trim();

  if (offsetSuffix.test(text)) {
    const instant = Date.parse(text);

    return Number.isNaN(instant) ? undefined : new Date(instant).toISOString();
  }

  const time = readWallClock(text);

  return time === undefined || !isTimeZone(timeZone)
    ? undefined
    : fromWallClock(time, timeZone);
};
