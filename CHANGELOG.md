# Changelog

## 0.2.1

- **Channel → Get Many** returns one item per channel, and the channel pickers
  list the workspace's channels. Peal lists channels as a plain array, which
  0.2.0 read as a page: it returned one empty item and empty pickers.
- A handle that already starts with `@` shows once in the pickers'
  descriptions.

## 0.2.0

- Published as `@peal-social/n8n-nodes-peal`, under Peal's npm organisation.
  `n8n-nodes-peal` 0.1.0 is deprecated: install the new name instead.

## 0.1.0

The first release.

- **Peal** node: create posts (publish now, at a time, in the next queue slot,
  or as a draft), get, list, reschedule, unschedule and cancel them, wait for
  their outcome and read their analytics; upload media from binary data or
  import it from a URL, then get, list and delete it; list channels. Usable as
  a tool by AI agents.
- **Peal Trigger** node: starts a workflow on any of Peal's webhook events, and
  checks each delivery's signature.
