import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { sign, signatureTolerance, verify } from "../nodes/shared/signature";

// A made-up secret in Peal's format: whsec_ and 32 bytes in base64.
const secret = `whsec_${Buffer.from("synthetic-secret-for-tests-32-by").toString("base64")}`;
const otherSecret = `whsec_${Buffer.from("another-synthetic-secret-32-byte").toString("base64")}`;

const body = '{"id":"evt_1","type":"post.published","version":1}';
const id = "019a6f40-2f6b-7a1c-9d2e-5b4c3a2f1e03";
const timestamp = "1794301203";
const now = Number(timestamp);

describe(sign, () => {
  it("signs id, timestamp and body as Standard Webhooks do", () => {
    const key = Buffer.from(secret.slice("whsec_".length), "base64");

    const expected = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");

    expect(sign(secret, { body, id, timestamp })).toBe(`v1,${expected}`);
  });

  it("signs a body given as bytes the same as its text", () => {
    expect(sign(secret, { body: Buffer.from(body), id, timestamp })).toBe(
      sign(secret, { body, id, timestamp })
    );
  });
});

describe(verify, () => {
  const signature = sign(secret, { body, id, timestamp });

  it("accepts a delivery signed with the secret", () => {
    expect(
      verify(secret, { body, id, signature, timestamp }, now)
    ).toStrictEqual({
      valid: true,
    });
  });

  it("accepts either signature during a rotation", () => {
    const old = sign(otherSecret, { body, id, timestamp });

    expect(
      verify(
        secret,
        { body, id, signature: `${old} ${signature}`, timestamp },
        now
      )
    ).toStrictEqual({
      valid: true,
    });
  });

  it("refuses a body that changed after it was signed", () => {
    expect(
      verify(secret, { body: `${body} `, id, signature, timestamp }, now)
    ).toStrictEqual({
      reason: "mismatch",
      valid: false,
    });
  });

  it("refuses a signature made with another secret", () => {
    const forged = sign(otherSecret, { body, id, timestamp });

    expect(
      verify(secret, { body, id, signature: forged, timestamp }, now)
    ).toStrictEqual({
      reason: "mismatch",
      valid: false,
    });
  });

  it("refuses a delivery older or newer than the tolerance", () => {
    expect(
      verify(
        secret,
        { body, id, signature, timestamp },
        now + signatureTolerance + 1
      )
    ).toStrictEqual({ reason: "stale", valid: false });
    expect(
      verify(
        secret,
        { body, id, signature, timestamp },
        now - signatureTolerance - 1
      )
    ).toStrictEqual({ reason: "stale", valid: false });
  });

  it("refuses missing headers and a timestamp that isn't a number", () => {
    expect(
      verify(secret, { body, id: "", signature, timestamp }, now)
    ).toStrictEqual({
      reason: "malformed",
      valid: false,
    });
    expect(
      verify(secret, { body, id, signature, timestamp: "soon" }, now)
    ).toStrictEqual({
      reason: "malformed",
      valid: false,
    });
  });
});
