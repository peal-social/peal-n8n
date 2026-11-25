import { createHmac, timingSafeEqual } from "node:crypto";

// Peal signs each webhook delivery as Standard Webhooks do: an HMAC-SHA256 of
// `<webhook-id>.<webhook-timestamp>.<body>`, keyed with the bytes the secret
// holds in base64 after `whsec_`, written as `v1,<base64>`. During a rotation
// the header holds two signatures separated by a space.

/** How far a delivery's timestamp may be from now, in seconds. */
export const signatureTolerance = 300;

export interface SignedDelivery {
  readonly body: Buffer | string;
  readonly id: string;
  readonly signature: string;
  readonly timestamp: string;
}

export type SignatureCheck =
  | { readonly valid: true }
  | {
      readonly reason: "malformed" | "mismatch" | "stale";
      readonly valid: false;
    };

const secretPrefix = "whsec_";

const keyOf = (secret: string): Buffer =>
  Buffer.from(
    secret.startsWith(secretPrefix)
      ? secret.slice(secretPrefix.length)
      : secret,
    "base64"
  );

/** The signature Peal sends for a delivery, as `v1,<base64>`. */
export const sign = (
  secret: string,
  delivery: Omit<SignedDelivery, "signature">
): string => {
  const hmac = createHmac("sha256", keyOf(secret));
  hmac.update(`${delivery.id}.${delivery.timestamp}.`);
  hmac.update(delivery.body);

  return `v1,${hmac.digest("base64")}`;
};

const sameText = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return a.length === b.length && timingSafeEqual(a, b);
};

/** Checks a delivery's signature and timestamp against the endpoint's secret. */
export const verify = (
  secret: string,
  delivery: SignedDelivery,
  nowSeconds: number
): SignatureCheck => {
  const timestamp = Number(delivery.timestamp);

  if (
    delivery.id.length === 0 ||
    delivery.signature.length === 0 ||
    !/^\d+$/u.test(delivery.timestamp) ||
    !Number.isSafeInteger(timestamp)
  ) {
    return { reason: "malformed", valid: false };
  }

  if (Math.abs(nowSeconds - timestamp) > signatureTolerance) {
    return { reason: "stale", valid: false };
  }

  const expected = sign(secret, delivery);

  const matches = delivery.signature
    .split(" ")
    .filter((candidate) => candidate.length > 0)
    .some((candidate) => sameText(candidate, expected));

  return matches ? { valid: true } : { reason: "mismatch", valid: false };
};
