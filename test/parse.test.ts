import { describe, expect, it } from "vitest";

import { apiRoot, channelOptions } from "../nodes/shared/api";
import {
  asDateText,
  errorDetailsOf,
  readChannels,
  readCreatedEndpoint,
  readEndpoint,
  readHttpStatus,
  readPage,
  readPreparedUpload,
} from "../nodes/shared/parse";

const signed = (url: string) => ({
  headers: { "content-type": "video/mp4" },
  method: "PUT",
  url,
});

describe(readPreparedUpload, () => {
  it("reads one PUT for a small file", () => {
    const answer = {
      media: { id: "media-1" },
      upload: {
        _tag: "single",
        expiresAt: "2026-12-01T10:00:00Z",
        request: signed("https://store.example/one"),
      },
    };

    expect(readPreparedUpload(10)(answer)).toStrictEqual({
      mediaId: "media-1",
      parts: [
        {
          byteSize: 10,
          partNumber: 1,
          request: {
            headers: { "content-type": "video/mp4" },
            url: "https://store.example/one",
          },
        },
      ],
    });
  });

  it("reads the parts of a large video in part order", () => {
    const answer = {
      media: { id: "media-2" },
      upload: {
        _tag: "multipart",
        parts: [
          {
            byteSize: 4,
            partNumber: 2,
            request: signed("https://store.example/2"),
          },
          {
            byteSize: 6,
            partNumber: 1,
            request: signed("https://store.example/1"),
          },
        ],
      },
    };

    expect(
      readPreparedUpload(10)(answer)?.parts.map((part) => part.request.url)
    ).toStrictEqual(["https://store.example/1", "https://store.example/2"]);
  });

  it("refuses an answer with a part it can't read", () => {
    const answer = {
      media: { id: "media-3" },
      upload: { _tag: "multipart", parts: [{ byteSize: 4, partNumber: 1 }] },
    };

    expect(readPreparedUpload(4)(answer)).toBeUndefined();
    expect(readPreparedUpload(4)({ upload: {} })).toBeUndefined();
  });
});

describe("readChannels and channelOptions", () => {
  it("lists channels by name, with platform, handle and status", () => {
    const page = {
      items: [
        {
          displayName: "Peal",
          handle: "peal.social",
          id: "c-2",
          platform: "bluesky",
          status: { _tag: "active" },
        },
        {
          handle: "pealsocial",
          id: "c-1",
          label: "Brand",
          platform: "googleBusiness",
          status: { _tag: "refreshNeeded" },
        },
        { handle: "no-id" },
      ],
      nextCursor: null,
    };

    expect(channelOptions(readChannels(page))).toStrictEqual([
      {
        description:
          "Google Business Profile, @pealsocial. Needs reconnecting.",
        name: "Brand (Google Business Profile)",
        value: "c-1",
      },
      {
        description: "Bluesky, @peal.social. Connected.",
        name: "Peal (Bluesky)",
        value: "c-2",
      },
    ]);
  });
});

describe(readPage, () => {
  it("reads items and the next cursor, null on the last page", () => {
    expect(
      readPage({ items: [{ id: "a" }, 3], nextCursor: "next" })
    ).toStrictEqual({
      items: [{ id: "a" }],
      nextCursor: "next",
    });
    expect(
      readPage({ items: [], nextCursor: null }).nextCursor
    ).toBeUndefined();
  });
});

describe("webhook endpoints", () => {
  it("reads the endpoint and the secret Peal answers once", () => {
    expect(
      readCreatedEndpoint({
        endpoint: { id: "e-1", url: "https://n8n.example/webhook" },
        secret: "whsec_synthetic",
      })
    ).toStrictEqual({ id: "e-1", secret: "whsec_synthetic" });
    expect(readCreatedEndpoint({ endpoint: { id: "e-1" } })).toBeUndefined();
  });

  it("reads an endpoint's address and events", () => {
    expect(
      readEndpoint({
        eventTypes: ["post.published", 2],
        url: "https://n8n.example/webhook",
      })
    ).toStrictEqual({
      eventTypes: ["post.published"],
      url: "https://n8n.example/webhook",
    });
  });
});

describe("errors", () => {
  it("reads the status n8n's errors carry", () => {
    expect(readHttpStatus({ httpCode: "404" })).toBe(404);
    expect(readHttpStatus({ response: { status: 409 } })).toBe(409);
    expect(readHttpStatus(new Error("offline"))).toBeUndefined();
  });

  it("keeps an error's details, or its text", () => {
    expect(errorDetailsOf({ message: "Not found" })).toStrictEqual({
      message: "Not found",
    });
    expect(errorDetailsOf("refused")).toStrictEqual({ message: "refused" });
  });
});

describe(apiRoot, () => {
  it("adds the API's path to the server, without a double slash", () => {
    expect(apiRoot("https://peal.example.com/")).toBe(
      "https://peal.example.com/api/v1"
    );
    expect(apiRoot("")).toBe("https://app.peal.social/api/v1");
  });
});

describe(asDateText, () => {
  it("reads strings, dates and Luxon-like date times as text", () => {
    expect(asDateText("2026-12-01T09:30")).toBe("2026-12-01T09:30");
    expect(asDateText(new Date("2026-12-01T08:30:00Z"))).toBe(
      "2026-12-01T08:30:00.000Z"
    );
    expect(asDateText({ toISO: () => "2026-12-01T09:30:00.000+01:00" })).toBe(
      "2026-12-01T09:30:00.000+01:00"
    );
  });

  it("reads anything else as nothing", () => {
    expect(asDateText(42)).toBe("");
    expect(asDateText(new Date(Number.NaN))).toBe("");
  });
});
