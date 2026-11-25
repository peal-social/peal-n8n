import type {
  DeclarativeRestApiSettings,
  IDataObject,
  IExecutePaginationFunctions,
  IExecuteSingleFunctions,
  IHttpRequestOptions,
  INodeExecutionData,
} from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

import { pealRequest } from "../shared/api";
import type { Page, UploadPart } from "../shared/parse";
import {
  asDateText,
  asObject,
  asStrings,
  asText,
  numberIn,
  readPage,
  readPreparedUpload,
  textIn,
} from "../shared/parse";
import type { PostFields, When } from "../shared/post-body";
import {
  additionalFieldsOf,
  postBody,
  scheduleBody,
  timeZoneOf,
} from "../shared/post-body";
import { toInstant } from "../shared/time";

// The request hooks of the Peal node: what the declarative routing can't say
// alone, such as a post's body, an upload's several requests and cursor pages.
// n8n calls each one with its execution context as `this`.

const whens: ReadonlySet<string> = new Set(["at", "draft", "now", "queue"]);

const isWhen = (value: string): value is When => whens.has(value);

const fail = (
  functions: IExecuteSingleFunctions,
  message: string
): NodeOperationError =>
  new NodeOperationError(functions.getNode(), message, {
    itemIndex: functions.getItemIndex(),
  });

const parameterText = (
  functions: IExecuteSingleFunctions,
  name: string
): string => asText(functions.getNodeParameter(name, ""));

const additionalOf = (functions: IExecuteSingleFunctions): IDataObject =>
  asObject(functions.getNodeParameter("additionalFields", {}));

/** Reads the Create operation's fields from the node. */
const postFieldsOf = (functions: IExecuteSingleFunctions): PostFields => {
  const when = parameterText(functions, "when");

  return {
    additional: additionalFieldsOf(additionalOf(functions)),
    channelIds: asStrings(functions.getNodeParameter("channelIds", [])),
    queueId: parameterText(functions, "queueId"),
    scheduledAt: asDateText(functions.getNodeParameter("scheduledAt", "")),
    text: parameterText(functions, "text"),
    timeZone: timeZoneOf(
      parameterText(functions, "timeZone"),
      functions.getTimezone()
    ),
    when: isWhen(when) ? when : "now",
  };
};

const longestWait = 60;

/** Builds the body of a new post or draft, and its optional headers and query. */
export const createPost = async function createPost(
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions
): Promise<IHttpRequestOptions> {
  const fields = postFieldsOf(this);
  const result = postBody(fields);

  if (!result.ok) {
    throw fail(this, result.message);
  }

  const additional = additionalOf(this);
  const idempotencyKey = (textIn(additional, "idempotencyKey") ?? "").trim();
  const wait = numberIn(additional, "waitSeconds") ?? 0;
  const headers: IDataObject = { ...requestOptions.headers };
  const qs: IDataObject = { ...requestOptions.qs };

  if (idempotencyKey.length > 0) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  if (fields.when === "now" && wait > 0) {
    qs.wait = String(Math.min(longestWait, Math.trunc(wait)));
  }

  return { ...requestOptions, body: result.body, headers, qs };
};

/** Builds the body of a reschedule from the date and time zone fields. */
export const reschedulePost = async function reschedulePost(
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions
): Promise<IHttpRequestOptions> {
  const timeZone = timeZoneOf(
    parameterText(this, "timeZone"),
    this.getTimezone()
  );

  const result = scheduleBody(
    asDateText(this.getNodeParameter("scheduledAt", "")),
    timeZone
  );

  if (!result.ok) {
    throw fail(this, result.message);
  }

  return { ...requestOptions, body: result.body };
};

/** Turns the post list's date filters into instants, in the workflow's time zone. */
export const listPostsQuery = async function listPostsQuery(
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions
): Promise<IHttpRequestOptions> {
  const filters = asObject(this.getNodeParameter("filters", {}));
  const qs: IDataObject = { ...requestOptions.qs };

  for (const bound of ["from", "to"]) {
    const value = asDateText(filters[bound]);

    if (value.length > 0) {
      const instant = toInstant(value, this.getTimezone());

      if (instant === undefined) {
        throw fail(
          this,
          `"${value}" is not a date and time, such as 2026-12-01T09:30`
        );
      }

      qs[bound] = instant;
    }
  }

  return { ...requestOptions, qs };
};

/** Where each part of a file starts and ends, or nothing when the sizes don't add up. */
export const slicesOf = (
  sizes: readonly number[],
  fileLength: number
): { readonly end: number; readonly start: number }[] | undefined => {
  const slices: { end: number; start: number }[] = [];
  let start = 0;

  for (const size of sizes) {
    slices.push({ end: start + size, start });
    start += size;
  }

  return start === fileLength ? slices : undefined;
};

/** Sends the parts of a file one after the other, with the requests Peal signed. */
const sendParts = async (
  functions: IExecuteSingleFunctions,
  parts: readonly UploadPart[],
  file: Buffer
): Promise<boolean> => {
  const slices = slicesOf(
    parts.map((part) => part.byteSize),
    file.length
  );

  if (slices === undefined) {
    return false;
  }

  // One part at a time, so a large video never sits in memory twice.
  const sendFrom = async (index: number): Promise<void> => {
    const part = parts[index];
    const slice = slices[index];

    if (part === undefined || slice === undefined) {
      return;
    }

    await functions.helpers.httpRequest({
      body: file.subarray(slice.start, slice.end),
      headers: { ...part.request.headers },
      json: false,
      method: "PUT",
      url: part.request.url,
    });
    await sendFrom(index + 1);
  };

  await sendFrom(0);

  return true;
};

/**
 * Uploads the item's binary file: starts the upload, sends the bytes to the
 * addresses Peal signs, then lets the routing complete it.
 */
export const uploadMedia = async function uploadMedia(
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions
): Promise<IHttpRequestOptions> {
  const property = parameterText(this, "binaryPropertyName");
  const binary = this.helpers.assertBinaryData(property);
  const file = await this.helpers.getBinaryDataBuffer(property);
  const altText = textIn(additionalOf(this), "altText") ?? "";

  const start: IDataObject = {
    byteSize: file.length,
    contentType: binary.mimeType,
  };

  if (binary.fileName !== undefined) {
    start.fileName = binary.fileName;
  }

  if (altText.length > 0) {
    start.altText = altText;
  }

  const upload = await pealRequest(
    this,
    { body: start, method: "POST", path: "/media" },
    readPreparedUpload(file.length)
  );

  if (upload === undefined) {
    throw fail(this, "Peal did not answer with an upload to send the file to");
  }

  if (!(await sendParts(this, upload.parts, file))) {
    throw fail(this, "Peal's upload did not match the file's size: try again");
  }

  // Completing takes no body: the alt text went with the upload's start.
  return {
    ...requestOptions,
    body: undefined,
    method: "POST",
    url: `/media/${encodeURIComponent(upload.mediaId)}/complete`,
  };
};

const pageSize = "100";

/** Fetches one page of a list, for the query given. */
export type FetchPage = (qs: IDataObject) => Promise<Page>;

/**
 * Reads every page of a list: Peal answers `items` and a `nextCursor`, null on
 * the last page. The filters stay the same from page to page.
 */
export const readAllPages = async (
  fetchPage: FetchPage,
  filters: IDataObject
): Promise<INodeExecutionData[]> => {
  const readFrom = async (
    cursor: string | undefined
  ): Promise<INodeExecutionData[]> => {
    const qs: IDataObject = { ...filters, limit: pageSize };

    if (cursor !== undefined) {
      qs.cursor = cursor;
    }

    const page = await fetchPage(qs);
    const rows = page.items.map((json) => ({ json }));

    // Each page needs the cursor of the one before it.
    return page.nextCursor === undefined
      ? rows
      : [...rows, ...(await readFrom(page.nextCursor))];
  };

  return await readFrom(undefined);
};

/** The pagination of every Get Many operation: all of a list's pages. */
export const paginateByCursor = async function paginateByCursor(
  this: IExecutePaginationFunctions,
  requestData: DeclarativeRestApiSettings.ResultOptions
): Promise<INodeExecutionData[]> {
  const fetchPage: FetchPage = async (qs) => {
    const [response] = await this.makeRoutingRequest({
      ...requestData,
      options: { ...requestData.options, qs },
    });

    return readPage(response?.json);
  };

  return await readAllPages(fetchPage, requestData.options.qs ?? {});
};
