import type { IDataObject } from "n8n-workflow";

import { booleanIn, numberIn, rowsIn, textIn } from "./parse";
import { isTimeZone, toInstant } from "./time";

// The Create operation's fields, turned into the bodies of `POST /api/v1/posts`
// and `POST /api/v1/posts/drafts`. Plain data in, plain data out, so tests
// check it without n8n.

export type When = "at" | "draft" | "now" | "queue";

export interface MediaAttachment {
  altText: string;
  mediaId: string;
}

export interface TextOverride {
  channelId: string;
  text: string;
}

export interface FollowUp {
  delaySeconds: number;
  media: MediaAttachment[];
  overrides: TextOverride[];
  text: string;
}

export type Timing =
  | { _tag: "at"; at: string; timeZone: string }
  | { _tag: "now"; timeZone: string }
  | { _tag: "queue"; queueId?: string };

export interface PostContent {
  followUps?: FollowUp[];
  media: MediaAttachment[];
  overrides: TextOverride[];
  text: string;
}

export interface PostBody {
  allowDuplicate?: boolean;
  channelIds: string[];
  channelSets?: string[];
  content: PostContent;
  defaultSignatures?: boolean;
  shortenLinks?: boolean;
  signatureId?: string;
  tagIds?: string[];
  when?: Timing;
}

/** What the Additional Fields collection holds, read from n8n's values. */
export interface AdditionalFields {
  readonly allowDuplicate: boolean | undefined;
  readonly channelSets: readonly string[];
  readonly defaultSignatures: boolean | undefined;
  readonly followUps: readonly FollowUp[];
  readonly media: readonly MediaAttachment[];
  readonly overrides: readonly TextOverride[];
  readonly shortenLinks: boolean | undefined;
  readonly signatureId: string;
  readonly tagIds: readonly string[];
}

export interface PostFields {
  readonly additional: AdditionalFields;
  readonly channelIds: readonly string[];
  readonly queueId: string;
  readonly scheduledAt: string;
  readonly text: string;
  readonly timeZone: string;
  readonly when: When;
}

export type BodyResult<Body> =
  | { readonly body: Body; readonly ok: true }
  | { readonly message: string; readonly ok: false };

/** Splits a comma-separated field into its trimmed, non-empty values. */
export const listOf = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const longestDelay = 86_400;

const delayOf = (seconds: number | undefined): number =>
  Math.max(0, Math.min(longestDelay, Math.trunc(seconds ?? 0)));

/** Reads the Additional Fields collection of the Create operation. */
export const additionalFieldsOf = (fields: IDataObject): AdditionalFields => ({
  allowDuplicate: booleanIn(fields, "allowDuplicate"),
  channelSets: listOf(textIn(fields, "channelSets")),
  defaultSignatures: booleanIn(fields, "defaultSignatures"),
  followUps: rowsIn(fields.followUps, "followUp").flatMap((row) => {
    const text = textIn(row, "text") ?? "";

    return text.length === 0
      ? []
      : [
          {
            delaySeconds: delayOf(numberIn(row, "delaySeconds")),
            media: [],
            overrides: [],
            text,
          },
        ];
  }),
  media: rowsIn(fields.media, "item").flatMap((row) => {
    const mediaId = (textIn(row, "mediaId") ?? "").trim();

    return mediaId.length === 0
      ? []
      : [{ altText: textIn(row, "altText") ?? "", mediaId }];
  }),
  overrides: rowsIn(fields.textPerChannel, "override").flatMap((row) => {
    const channelId = textIn(row, "channelId") ?? "";
    const text = textIn(row, "text") ?? "";

    return channelId.length === 0 || text.length === 0
      ? []
      : [{ channelId, text }];
  }),
  shortenLinks: booleanIn(fields, "shortenLinks"),
  signatureId: (textIn(fields, "signatureId") ?? "").trim(),
  tagIds: listOf(textIn(fields, "tagIds")),
});

/** The time zone a post is scheduled in: the field's, else the workflow's. */
export const timeZoneOf = (field: string, workflowTimeZone: string): string => {
  const chosen = field.trim();

  return chosen.length > 0 ? chosen : workflowTimeZone;
};

const notTimeZone = (timeZone: string): string =>
  `"${timeZone}" is not a time zone, such as Europe/Paris`;

const notDateTime = (value: string): string =>
  `"${value}" is not a date and time, such as 2026-12-01T09:30`;

/** The body of `POST /posts/{postId}/reschedule`, also the timing of `at`. */
export const scheduleBody = (
  scheduledAt: string,
  timeZone: string
): BodyResult<{ at: string; timeZone: string }> => {
  if (!isTimeZone(timeZone)) {
    return { message: notTimeZone(timeZone), ok: false };
  }

  const at = toInstant(scheduledAt, timeZone);

  return at === undefined
    ? { message: notDateTime(scheduledAt), ok: false }
    : { body: { at, timeZone }, ok: true };
};

const timingOf = (fields: PostFields): BodyResult<Timing | undefined> => {
  if (fields.when === "draft") {
    return { body: undefined, ok: true };
  }

  if (fields.when === "queue") {
    const queueId = fields.queueId.trim();

    return {
      body: queueId.length > 0 ? { _tag: "queue", queueId } : { _tag: "queue" },
      ok: true,
    };
  }

  if (fields.when === "now") {
    return isTimeZone(fields.timeZone)
      ? { body: { _tag: "now", timeZone: fields.timeZone }, ok: true }
      : { message: notTimeZone(fields.timeZone), ok: false };
  }

  const schedule = scheduleBody(fields.scheduledAt, fields.timeZone);

  return schedule.ok
    ? { body: { _tag: "at", ...schedule.body }, ok: true }
    : schedule;
};

/** The request body for the post or draft the fields describe. */
export const postBody = (fields: PostFields): BodyResult<PostBody> => {
  const timing = timingOf(fields);

  if (!timing.ok) {
    return timing;
  }

  const { additional } = fields;

  const content: PostContent = {
    media: [...additional.media],
    overrides: [...additional.overrides],
    text: fields.text,
  };

  if (additional.followUps.length > 0) {
    content.followUps = [...additional.followUps];
  }

  const body: PostBody = { channelIds: [...fields.channelIds], content };

  if (additional.channelSets.length > 0) {
    body.channelSets = [...additional.channelSets];
  }

  if (additional.tagIds.length > 0) {
    body.tagIds = [...additional.tagIds];
  }

  if (additional.signatureId.length > 0) {
    body.signatureId = additional.signatureId;
  }

  if (additional.defaultSignatures !== undefined) {
    body.defaultSignatures = additional.defaultSignatures;
  }

  if (additional.shortenLinks !== undefined) {
    body.shortenLinks = additional.shortenLinks;
  }

  // A draft has no timing, and Peal only checks duplicates when a post goes out.
  if (timing.body !== undefined) {
    body.when = timing.body;

    if (additional.allowDuplicate !== undefined) {
      body.allowDuplicate = additional.allowDuplicate;
    }
  }

  return { body, ok: true };
};
