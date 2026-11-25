import type { IDataObject, JsonObject } from "n8n-workflow";

// The node's one boundary with untyped data: n8n's parameters, which it hands
// over as loose values, and Peal's JSON answers. n8n Cloud refuses nodes with
// runtime dependencies, so there is no schema library: each reader here checks
// the shape it needs and returns a typed value, or nothing.

/** Reads an API answer into a typed value, as every reader here does. */
export type Reader<Answer> = (answer: unknown) => Answer;

/** Whether `value` is a JSON object. */
export const isJsonObject = (value: unknown): value is IDataObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fieldOf = (value: unknown, key: string): unknown =>
  isJsonObject(value) ? value[key] : undefined;

/** A parameter read as text: empty when it isn't a string. */
export const asText = (value: unknown): string =>
  typeof value === "string" ? value : "";

// What a Luxon DateTime offers, which is what n8n's date expressions give.
const isDateTime = (
  value: unknown
): value is { readonly toISO: () => unknown } =>
  typeof value === "object" &&
  value !== null &&
  "toISO" in value &&
  typeof value.toISO === "function";

/**
 * A date parameter read as text: a string as it is, a Date or a Luxon DateTime
 * (what n8n's `$now` and its date expressions give) as ISO 8601.
 */
export const asDateText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  if (isDateTime(value)) {
    const iso = value.toISO();

    return typeof iso === "string" ? iso : "";
  }

  return "";
};

/** A parameter read as a list of strings, such as a multi-option field. */
export const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

/** A parameter read as an object, such as a collection: empty when it isn't one. */
export const asObject = (value: unknown): IDataObject =>
  isJsonObject(value) ? value : {};

/** A string field of an object. */
export const textIn = (value: unknown, key: string): string | undefined => {
  const field = fieldOf(value, key);

  return typeof field === "string" ? field : undefined;
};

/** A finite number field of an object. */
export const numberIn = (value: unknown, key: string): number | undefined => {
  const field = fieldOf(value, key);

  return typeof field === "number" && Number.isFinite(field)
    ? field
    : undefined;
};

/** A boolean field of an object. */
export const booleanIn = (value: unknown, key: string): boolean | undefined => {
  const field = fieldOf(value, key);

  return typeof field === "boolean" ? field : undefined;
};

/** The rows of a fixed collection, which n8n keeps under one key. */
export const rowsIn = (value: unknown, key: string): IDataObject[] => {
  const rows = fieldOf(value, key);

  return Array.isArray(rows) ? rows.filter(isJsonObject) : [];
};

/** One page of a Peal list: its items and the cursor of the next page. */
export interface Page {
  readonly items: readonly IDataObject[];
  readonly nextCursor: string | undefined;
}

export const readPage = (value: unknown): Page => {
  const items = fieldOf(value, "items");

  return {
    items: Array.isArray(items) ? items.filter(isJsonObject) : [],
    nextCursor: textIn(value, "nextCursor"),
  };
};

export type ChannelStatus = "active" | "disabled" | "refreshNeeded";

/** A connected channel, as the channel pickers show it. */
export interface Channel {
  readonly handle: string;
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  readonly status: ChannelStatus;
}

const statusOf = (value: unknown): ChannelStatus => {
  const tag = textIn(value, "_tag");

  return tag === "disabled" || tag === "refreshNeeded" ? tag : "active";
};

export const readChannels = (value: unknown): Channel[] =>
  readPage(value).items.flatMap((item) => {
    const id = textIn(item, "id");

    if (id === undefined) {
      return [];
    }

    const handle = textIn(item, "handle") ?? id;

    return [
      {
        handle,
        id,
        name: textIn(item, "label") ?? textIn(item, "displayName") ?? handle,
        platform: textIn(item, "platform") ?? "",
        status: statusOf(item.status),
      },
    ];
  });

/** A request Peal signed for the store: a PUT with the headers it must carry. */
export interface SignedPut {
  readonly headers: Readonly<Record<string, string>>;
  readonly url: string;
}

const readSignedPut = (value: unknown): SignedPut | undefined => {
  const url = textIn(value, "url");

  if (url === undefined) {
    return undefined;
  }

  const headers = Object.fromEntries(
    Object.entries(asObject(fieldOf(value, "headers"))).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );

  return { headers, url };
};

export interface UploadPart {
  readonly byteSize: number;
  readonly partNumber: number;
  readonly request: SignedPut;
}

/** Where to send a new file: one PUT, or one PUT per part, in part order. */
export interface PreparedUpload {
  readonly mediaId: string;
  readonly parts: readonly UploadPart[];
}

const readPart = (value: unknown): UploadPart | undefined => {
  const byteSize = numberIn(value, "byteSize");
  const partNumber = numberIn(value, "partNumber");
  const request = readSignedPut(fieldOf(value, "request"));

  return byteSize === undefined ||
    partNumber === undefined ||
    request === undefined
    ? undefined
    : { byteSize, partNumber, request };
};

/** Reads `POST /media`'s answer, with the file's size for a single PUT. */
export const readPreparedUpload =
  (byteSize: number) =>
  (value: unknown): PreparedUpload | undefined => {
    const mediaId = textIn(fieldOf(value, "media"), "id");
    const upload = fieldOf(value, "upload");

    if (mediaId === undefined) {
      return undefined;
    }

    if (textIn(upload, "_tag") === "single") {
      const request = readSignedPut(fieldOf(upload, "request"));

      return request === undefined
        ? undefined
        : { mediaId, parts: [{ byteSize, partNumber: 1, request }] };
    }

    const rows = fieldOf(upload, "parts");
    const parts = Array.isArray(rows) ? rows.map(readPart) : [];
    const read = parts.filter((part): part is UploadPart => part !== undefined);

    return read.length === 0 || read.length !== parts.length
      ? undefined
      : {
          mediaId,
          parts: read.toSorted(
            (left, right) => left.partNumber - right.partNumber
          ),
        };
  };

/** A webhook endpoint as the trigger keeps it: its id and its signing secret. */
export interface StoredEndpoint {
  readonly id: string;
  readonly secret: string;
}

/** Reads `POST /webhooks`'s answer, or what the node's static data holds. */
export const readCreatedEndpoint = (
  value: unknown
): StoredEndpoint | undefined => {
  const id = textIn(fieldOf(value, "endpoint"), "id");
  const secret = textIn(value, "secret");

  return id === undefined || secret === undefined ? undefined : { id, secret };
};

export const readStoredEndpoint = (
  value: unknown
): StoredEndpoint | undefined => {
  const id = textIn(value, "endpointId");
  const secret = textIn(value, "secret");

  return id === undefined || secret === undefined ? undefined : { id, secret };
};

/** What the trigger compares with its settings: the address and the events. */
export interface Endpoint {
  readonly eventTypes: readonly string[];
  readonly url: string;
}

export const readEndpoint = (value: unknown): Endpoint | undefined => {
  const url = textIn(value, "url");

  return url === undefined
    ? undefined
    : { eventTypes: asStrings(fieldOf(value, "eventTypes")), url };
};

/** The HTTP status of a failed request, as n8n's request helpers report it. */
export const readHttpStatus = (error: unknown): number | undefined => {
  const status = Number(
    fieldOf(error, "httpCode") ??
      fieldOf(error, "statusCode") ??
      fieldOf(fieldOf(error, "response"), "status")
  );

  return Number.isInteger(status) ? status : undefined;
};

/** A request header's value, or empty. */
export const headerIn = (headers: unknown, name: string): string =>
  textIn(headers, name) ?? "";

/** For answers the caller has no use for, such as a deletion's. */
export const ignoreAnswer = (): undefined => undefined;

const isErrorObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What n8n's NodeApiError reads from a failed request: the error itself, or its text. */
export const errorDetailsOf = (error: unknown): JsonObject =>
  isErrorObject(error) ? error : { message: String(error) };
