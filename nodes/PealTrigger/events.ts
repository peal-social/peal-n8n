import type { INodePropertyOptions } from "n8n-workflow";

// The events a Peal webhook endpoint subscribes to, as the API names them
// (`SubscribableWebhookEventType`), with what each one means.
const events: readonly (readonly [string, string])[] = [
  ["article.failed", "An article could not be published on its site"],
  ["article.published", "An article went live on its site"],
  ["boost.budget_reached", "A boost spent its whole budget"],
  ["boost.ended", "A boost reached its end date"],
  ["boost.failed", "A boost could not be started or kept running"],
  ["boost.paused", "A boost was paused"],
  ["boost.resumed", "A paused boost runs again"],
  ["boost.started", "A boost started spending"],
  ["boost.stopped", "A boost was stopped for good"],
  [
    "boost.unconfirmed",
    "Peal could not confirm what the ad network did with a boost",
  ],
  ["channel.connected", "A channel was connected to the workspace"],
  ["channel.disabled", "A channel was turned off"],
  ["channel.disconnected", "A channel was disconnected"],
  ["channel.enabled", "A channel was turned back on"],
  ["channel.expiring", "A channel's sign-in expires soon"],
  [
    "channel.reconnect_needed",
    "A channel must be connected again before it can post",
  ],
  ["comment.received", "Someone commented on a post"],
  ["comment.replied", "A comment got a reply from the workspace"],
  ["media.failed", "A file could not be stored or read"],
  ["media.ready", "A file is ready to go in posts"],
  ["message.received", "Someone sent the workspace a direct message"],
  ["message.sent", "The workspace sent a direct message"],
  ["post.approval_requested", "A post waits for someone to approve it"],
  ["post.approved", "A post was approved"],
  ["post.cancelled", "A post was cancelled"],
  ["post.changes_requested", "A reviewer asked for changes to a post"],
  ["post.edit_failed", "A published post could not be edited on a channel"],
  ["post.edited", "A published post was edited on a channel"],
  ["post.failed", "A post could not be published on a channel"],
  ["post.finished", "A post has a result on every one of its channels"],
  ["post.published", "A post went live on a channel"],
  ["post.scheduled", "A post was scheduled"],
  ["post.unconfirmed", "Peal could not confirm whether a channel took a post"],
  ["post.unpublish_failed", "A post could not be taken down from a channel"],
  ["post.unpublished", "A post was taken down from a channel"],
  ["post.unscheduled", "A scheduled post went back to draft"],
  ["review.received", "Someone left a review"],
  ["review.replied", "A review got a reply from the workspace"],
];

const nameOf = (type: string): string =>
  type
    .split(/[._]/u)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

/** The events as options of the trigger's Events field. */
export const eventOptions: INodePropertyOptions[] = events.map(
  ([value, description]) => ({
    description,
    name: nameOf(value),
    value,
  })
);

/** Every event type the trigger offers. */
export const eventTypes: readonly string[] = events.map(([value]) => value);
