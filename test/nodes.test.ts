import type { IDataObject, INodeProperties } from "n8n-workflow";
import { describe, expect, it } from "vitest";

import { PealApi } from "../credentials/PealApi.credentials";
import { readAllPages, slicesOf } from "../nodes/Peal/hooks";
import { Peal } from "../nodes/Peal/Peal.node";
import { eventTypes } from "../nodes/PealTrigger/events";
import { PealTrigger } from "../nodes/PealTrigger/PealTrigger.node";
import type { Page } from "../nodes/shared/parse";
import { textIn } from "../nodes/shared/parse";
import manifest from "../package.json";

// The event types a Peal webhook endpoint accepts, as the API's contract lists
// them (`SubscribableWebhookEventType`).
const subscribable = [
  "post.scheduled",
  "post.unscheduled",
  "post.published",
  "post.failed",
  "post.unconfirmed",
  "post.cancelled",
  "post.finished",
  "post.unpublished",
  "post.unpublish_failed",
  "post.edited",
  "post.edit_failed",
  "post.approval_requested",
  "post.approved",
  "post.changes_requested",
  "channel.connected",
  "channel.disconnected",
  "channel.reconnect_needed",
  "channel.disabled",
  "channel.enabled",
  "channel.expiring",
  "media.ready",
  "media.failed",
  "comment.received",
  "comment.replied",
  "review.received",
  "review.replied",
  "message.received",
  "message.sent",
  "boost.started",
  "boost.paused",
  "boost.resumed",
  "boost.stopped",
  "boost.ended",
  "boost.failed",
  "boost.unconfirmed",
  "boost.budget_reached",
  "article.published",
  "article.failed",
];

const operationsOf = (
  properties: INodeProperties[],
  resource: string
): string[] =>
  properties
    .filter(
      (property) =>
        property.name === "operation" &&
        property.displayOptions?.show?.resource?.includes(resource) === true
    )
    .flatMap((property) => property.options ?? [])
    .flatMap((option) => ("value" in option ? [String(option.value)] : []));

describe("the Peal node", () => {
  const { description } = new Peal();

  it("offers each resource's operations, and AI agents may use it", () => {
    expect(description.usableAsTool).toBeTruthy();
    expect(operationsOf(description.properties, "post")).toStrictEqual([
      "cancel",
      "create",
      "get",
      "getAnalytics",
      "getAll",
      "getOutcome",
      "reschedule",
      "unschedule",
    ]);
    expect(operationsOf(description.properties, "media")).toStrictEqual([
      "delete",
      "get",
      "getAll",
      "import",
      "upload",
    ]);
    expect(operationsOf(description.properties, "channel")).toStrictEqual([
      "getAll",
    ]);
  });

  it("sends every operation somewhere", () => {
    const options = description.properties
      .filter((property) => property.name === "operation")
      .flatMap((property) => property.options ?? []);

    for (const option of options) {
      expect("routing" in option && option.routing?.request?.url).toBeTruthy();
    }
  });
});

describe("the Peal Trigger node", () => {
  const { description } = new PealTrigger();

  it("offers exactly the events a Peal endpoint accepts", () => {
    expect(eventTypes.toSorted()).toStrictEqual(subscribable.toSorted());
  });

  it("takes no input and listens on one webhook", () => {
    expect(description.inputs).toStrictEqual([]);
    expect(
      description.webhooks?.map((webhook) => webhook.httpMethod)
    ).toStrictEqual(["POST"]);
  });
});

describe("the credential", () => {
  it("sends the key as a bearer token and checks it against /credential", () => {
    const credential = new PealApi();

    expect(credential.authenticate).toStrictEqual({
      properties: {
        headers: { Authorization: "=Bearer {{$credentials.apiKey}}" },
      },
      type: "generic",
    });
    expect(credential.test.request.url).toBe("/credential");
  });
});

describe("the package", () => {
  it("registers each node and credential n8n loads", () => {
    expect(manifest).toMatchObject({
      n8n: {
        credentials: ["dist/credentials/PealApi.credentials.js"],
        nodes: [
          "dist/nodes/Peal/Peal.node.js",
          "dist/nodes/PealTrigger/PealTrigger.node.js",
        ],
      },
    });
  });
});

describe(slicesOf, () => {
  it("cuts a file into its parts, end to end", () => {
    expect(slicesOf([4, 4, 2], 10)).toStrictEqual([
      { end: 4, start: 0 },
      { end: 8, start: 4 },
      { end: 10, start: 8 },
    ]);
  });

  it("refuses parts that don't add up to the file", () => {
    expect(slicesOf([4, 4], 10)).toBeUndefined();
  });
});

describe(readAllPages, () => {
  it("follows nextCursor until the last page, keeping the filters", async () => {
    const pages = new Map<string, Page>([
      ["", { items: [{ id: "a" }, { id: "b" }], nextCursor: "page-2" }],
      ["page-2", { items: [{ id: "c" }], nextCursor: "page-3" }],
      ["page-3", { items: [], nextCursor: undefined }],
    ]);

    const requested: IDataObject[] = [];
    const empty: Page = { items: [], nextCursor: undefined };

    const fetchPage = async (qs: IDataObject): Promise<Page> => {
      requested.push(qs);

      return await Promise.resolve(
        pages.get(textIn(qs, "cursor") ?? "") ?? empty
      );
    };

    const items = await readAllPages(fetchPage, { status: "draft" });

    expect(items).toStrictEqual([
      { json: { id: "a" } },
      { json: { id: "b" } },
      { json: { id: "c" } },
    ]);
    expect(requested).toStrictEqual([
      { limit: "100", status: "draft" },
      { cursor: "page-2", limit: "100", status: "draft" },
      { cursor: "page-3", limit: "100", status: "draft" },
    ]);
  });
});
