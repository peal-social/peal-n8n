import { describe, expect, it } from "vitest";

import type { PostFields } from "../nodes/shared/post-body";
import {
  additionalFieldsOf,
  listOf,
  postBody,
  scheduleBody,
  timeZoneOf,
} from "../nodes/shared/post-body";

const channelId = "0193b1c2-0000-7000-8000-000000000001";

const fields = (overrides: Partial<PostFields> = {}): PostFields => ({
  additional: additionalFieldsOf({}),
  channelIds: [channelId],
  queueId: "",
  scheduledAt: "",
  text: "Hello from n8n",
  timeZone: "Europe/Paris",
  when: "now",
  ...overrides,
});

describe(postBody, () => {
  it("publishes now in the time zone given", () => {
    expect(postBody(fields())).toStrictEqual({
      body: {
        channelIds: [channelId],
        content: { media: [], overrides: [], text: "Hello from n8n" },
        when: { _tag: "now", timeZone: "Europe/Paris" },
      },
      ok: true,
    });
  });

  it("schedules a wall-clock time as an instant with its time zone", () => {
    const result = postBody(
      fields({ scheduledAt: "2026-12-01T09:30", when: "at" })
    );

    expect(result.ok && result.body.when).toStrictEqual({
      _tag: "at",
      at: "2026-12-01T08:30:00.000Z",
      timeZone: "Europe/Paris",
    });
  });

  it("queues on the default queue, or the one named", () => {
    const named = postBody(fields({ queueId: " queue-1 ", when: "queue" }));
    const unnamed = postBody(fields({ when: "queue" }));

    expect(named.ok && named.body.when).toStrictEqual({
      _tag: "queue",
      queueId: "queue-1",
    });
    expect(unnamed.ok && unnamed.body.when).toStrictEqual({ _tag: "queue" });
  });

  it("saves a draft without timing or duplicate check", () => {
    const result = postBody(
      fields({
        additional: additionalFieldsOf({ allowDuplicate: true }),
        when: "draft",
      })
    );

    expect(result).toStrictEqual({
      body: {
        channelIds: [channelId],
        content: { media: [], overrides: [], text: "Hello from n8n" },
      },
      ok: true,
    });
  });

  it("explains a time zone or a date it can't read", () => {
    expect(postBody(fields({ timeZone: "Mars/Olympus" }))).toStrictEqual({
      message: '"Mars/Olympus" is not a time zone, such as Europe/Paris',
      ok: false,
    });
    expect(
      postBody(fields({ scheduledAt: "next week", when: "at" }))
    ).toStrictEqual({
      message: '"next week" is not a date and time, such as 2026-12-01T09:30',
      ok: false,
    });
  });

  it("carries media, texts per channel, follow-ups and options", () => {
    const additional = additionalFieldsOf({
      allowDuplicate: false,
      channelSets: "Launch, , Team",
      defaultSignatures: true,
      followUps: {
        followUp: [
          { delaySeconds: 90.7, text: "Second post" },
          { delaySeconds: 99_999, text: "Third post" },
          { text: "" },
        ],
      },
      media: {
        item: [{ altText: "A cube", mediaId: " media-1 " }, { mediaId: "" }],
      },
      shortenLinks: false,
      signatureId: "signature-1",
      tagIds: "tag-1,tag-2",
      textPerChannel: {
        override: [
          { channelId, text: "Hello, Bluesky" },
          { channelId: "", text: "Dropped" },
        ],
      },
    });

    expect(postBody(fields({ additional }))).toStrictEqual({
      body: {
        allowDuplicate: false,
        channelIds: [channelId],
        channelSets: ["Launch", "Team"],
        content: {
          followUps: [
            { delaySeconds: 90, media: [], overrides: [], text: "Second post" },
            {
              delaySeconds: 86_400,
              media: [],
              overrides: [],
              text: "Third post",
            },
          ],
          media: [{ altText: "A cube", mediaId: "media-1" }],
          overrides: [{ channelId, text: "Hello, Bluesky" }],
          text: "Hello from n8n",
        },
        defaultSignatures: true,
        shortenLinks: false,
        signatureId: "signature-1",
        tagIds: ["tag-1", "tag-2"],
        when: { _tag: "now", timeZone: "Europe/Paris" },
      },
      ok: true,
    });
  });
});

describe(scheduleBody, () => {
  it("answers the instant and its time zone", () => {
    expect(scheduleBody("2026-07-01T18:00", "America/New_York")).toStrictEqual({
      body: { at: "2026-07-01T22:00:00.000Z", timeZone: "America/New_York" },
      ok: true,
    });
  });
});

describe(timeZoneOf, () => {
  it("prefers the field, then the workflow's time zone", () => {
    expect(timeZoneOf(" Asia/Tokyo ", "Europe/Paris")).toBe("Asia/Tokyo");
    expect(timeZoneOf("", "Europe/Paris")).toBe("Europe/Paris");
  });
});

describe(listOf, () => {
  it("splits on commas and drops empty values", () => {
    expect(listOf(" a, b,,c ")).toStrictEqual(["a", "b", "c"]);
    expect(listOf(undefined)).toStrictEqual([]);
  });
});
