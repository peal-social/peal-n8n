import { describe, expect, it } from "vitest";

import { isTimeZone, toInstant } from "../nodes/shared/time";

describe(isTimeZone, () => {
  it("knows IANA time zones", () => {
    expect(isTimeZone("Europe/Paris")).toBeTruthy();
    expect(isTimeZone("UTC")).toBeTruthy();
  });

  it("refuses empty and unknown names", () => {
    expect(isTimeZone("")).toBeFalsy();
    expect(isTimeZone("Europe/Atlantis")).toBeFalsy();
  });
});

describe(toInstant, () => {
  it("keeps a time that carries its offset", () => {
    expect(toInstant("2026-12-01T09:30:00+01:00", "America/New_York")).toBe(
      "2026-12-01T08:30:00.000Z"
    );
    expect(toInstant("2026-12-01T09:30:00Z", "Asia/Tokyo")).toBe(
      "2026-12-01T09:30:00.000Z"
    );
  });

  it("reads a wall-clock time in the time zone, in winter and in summer", () => {
    expect(toInstant("2026-12-01T09:30", "Europe/Paris")).toBe(
      "2026-12-01T08:30:00.000Z"
    );
    expect(toInstant("2026-07-01T09:30:00", "Europe/Paris")).toBe(
      "2026-07-01T07:30:00.000Z"
    );
    expect(toInstant("2026-07-01 09:30:00", "America/New_York")).toBe(
      "2026-07-01T13:30:00.000Z"
    );
  });

  it("reads a date alone as its midnight", () => {
    expect(toInstant("2026-12-01", "Europe/Paris")).toBe(
      "2026-11-30T23:00:00.000Z"
    );
  });

  it("keeps milliseconds", () => {
    expect(toInstant("2026-12-01T09:30:00.250", "UTC")).toBe(
      "2026-12-01T09:30:00.250Z"
    );
  });

  it("settles the hour a daylight saving change skips", () => {
    // Paris skips 02:00 to 03:00 on 29 March 2026: 02:30 doesn't exist there,
    // and becomes 03:30, the time an hour later.
    expect(toInstant("2026-03-29T02:30", "Europe/Paris")).toBe(
      "2026-03-29T01:30:00.000Z"
    );
    expect(toInstant("2026-03-29T03:30", "Europe/Paris")).toBe(
      "2026-03-29T01:30:00.000Z"
    );
    expect(toInstant("2026-03-29T01:30", "Europe/Paris")).toBe(
      "2026-03-29T00:30:00.000Z"
    );
  });

  it("refuses what isn't a date, or a wall-clock time without a known zone", () => {
    expect(toInstant("tomorrow", "Europe/Paris")).toBeUndefined();
    expect(toInstant("2026-12-01T09:30", "Nowhere/Land")).toBeUndefined();
    expect(toInstant("2026-13-45T99:99Z", "UTC")).toBeUndefined();
  });
});
