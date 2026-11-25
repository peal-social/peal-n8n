# n8n-nodes-peal

This package adds [Peal](https://peal.social) to [n8n](https://n8n.io). Your
workflows can publish, schedule and queue social media posts on every channel
your Peal workspace connects, upload the images and videos that go with them,
and start when something happens in Peal, such as a post going live or failing.

It has two nodes:

- **Peal**, for posts, media and channels. AI agents in n8n can use it as a
  tool.
- **Peal Trigger**, which starts a workflow on a Peal webhook event.

[Installation](#installation) · [Credentials](#credentials) ·
[Operations](#operations) · [Trigger](#trigger) · [Time zones](#time-zones) ·
[Compatibility](#compatibility) · [Development](#development)

## Installation

In n8n, open **Settings**, then **Community nodes**, choose **Install**, and
enter `n8n-nodes-peal`. n8n's guide to
[installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/)
covers self-hosted instances and the command line.

## Credentials

The nodes sign in with an API key of your Peal workspace:

1. In Peal, open the workspace's **Settings**, then **API keys**, and create a
   key. It starts with `peal_`, and Peal shows it once.
2. In n8n, create a **Peal API** credential and paste the key.
3. Leave **Server** as `https://app.peal.social`, unless you run Peal yourself:
   then enter your server's address.

A key holds some of the permissions of the member who created it. Give it the
ones your workflows use:

| To                                                                     | The key needs                    |
| ---------------------------------------------------------------------- | -------------------------------- |
| Pick or list channels                                                  | `channel:read`                   |
| Save drafts                                                            | `post:create`, `channel:read`    |
| Publish, schedule or queue a post, reschedule, unschedule or cancel it | `post:schedule`, `channel:read`  |
| Get and list posts, and wait for their outcome                         | `post:read`                      |
| Read a post's analytics                                                | `analytics:read`                 |
| Upload or import media, and show it in posts                           | `media:upload`, `media:read`     |
| Delete media                                                           | `media:delete`                   |
| Use the trigger                                                        | `webhook:manage`, `webhook:read` |

n8n checks the credential by asking Peal who the key is (`GET /api/v1/credential`).

## Operations

### Post

| Operation     | What it does                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Create        | Publishes a post now, schedules it at a time, puts it in a queue's next free slot, or saves a draft |
| Get           | Gets a post and the state of each of its channels                                                   |
| Get Many      | Lists the workspace's posts, filtered by status, outcome, channel or scheduled time                 |
| Get Outcome   | Waits up to 60 seconds for a post to go out on every channel, then gets how it went                 |
| Get Analytics | Gets a post's counts on each channel it went live on                                                |
| Reschedule    | Moves a scheduled post to another time, or schedules a draft                                        |
| Unschedule    | Takes a scheduled post back to draft                                                                |
| Cancel        | Cancels a draft or a scheduled post                                                                 |

**Create** takes the channels, the text and when it goes out. Its additional
fields add media, another text for some channels, follow-ups such as the next
posts of a thread, tags, channel sets, signatures, and an idempotency key that
makes sending the same request twice safe. For a post published now, **Wait for
Result** keeps the request open up to 60 seconds, so the node answers with each
channel's result.

Peal checks every post against each platform's limits before it accepts it. When
it refuses one, the node's error carries Peal's explanation.

### Media

| Operation       | What it does                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| Upload          | Uploads an image, video or document from the item's binary data              |
| Import From URL | Has Peal fetch a public image or video and add it to the workspace's library |
| Get             | Gets a file of the library                                                   |
| Get Many        | Lists the library, by kind or by name                                        |
| Delete          | Deletes a file                                                               |

An uploaded file's `id` goes into a post's **Media** field. Peal takes JPEG,
PNG, GIF and WebP images, MP4 and QuickTime videos, and PDF documents. Large
videos go up in parts, one after the other.

### Channel

| Operation | What it does                                                     |
| --------- | ---------------------------------------------------------------- |
| Get Many  | Lists the channels connected to the workspace, with their status |

You connect channels in Peal. The nodes pick from those already connected.

## Trigger

**Peal Trigger** starts a workflow on the events you choose: a post published,
failed or finished, a channel that must be reconnected, a file ready, a comment
or a message received, and the rest of [Peal's webhook events](https://docs.peal.social/developers/webhooks).
Choose channels to hear only their events.

When you activate the workflow, the trigger creates a webhook endpoint in the
workspace, and deletes it when you deactivate it. It checks each delivery's
signature with the endpoint's secret and refuses those it can't verify, so only
Peal starts the workflow.

Two limits come from Peal:

- Peal sends events to public HTTPS addresses only, so your n8n must be
  reachable from the internet. n8n Cloud is. A self-hosted n8n needs
  `WEBHOOK_URL` set to its public address.
- A workspace has 10 webhook endpoints at most. Each active workflow with a
  Peal Trigger takes one, and n8n's test listening takes one while it runs.

An event carries ids, states and links, never a post's text. Use the Peal node's
**Get** operation to read the post an event names.

## Time zones

Peal schedules a post at an instant and keeps the time zone it was chosen in, so
a post scheduled for 09:00 in Paris stays at 09:00 when the clocks change.

A date from n8n's date picker has no offset: the node reads it in the **Time
Zone** field, or in the workflow's time zone when that field is empty. A date
from an expression that carries an offset, such as `2026-12-01T09:30:00+01:00`
or `{{ $now.plus({ days: 1 }) }}`, is that instant.

## Compatibility

Built and tested with n8n 2.49.6. The nodes use n8n's node API version 1 and
need no runtime dependencies, as n8n Cloud requires.

## Development

The package is built with n8n's [`@n8n/node-cli`](https://www.npmjs.com/package/@n8n/node-cli)
and pnpm, on Node.js 22 or later.

```sh
pnpm install
pnpm run check      # oxfmt, oxlint with Ultracite's presets, then n8n's lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run dev        # n8n with the nodes loaded, rebuilt on each change
```

[AGENTS.md](AGENTS.md) lists the rules the code follows.

## Resources

- [Peal's API reference](https://docs.peal.social/reference)
- [Peal's webhooks](https://docs.peal.social/developers/webhooks)
- [n8n's community nodes](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
