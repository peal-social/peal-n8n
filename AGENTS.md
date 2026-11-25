# peal-n8n

`n8n-nodes-peal`: Peal's community nodes for n8n. **Peal** (declarative, usable
as an AI agent's tool) creates and manages posts, media and channels through
Peal's API; **Peal Trigger** (programmatic) creates a webhook endpoint in the
workspace and starts workflows on its events. Peal's API lives in the
[Peal repository](https://github.com/peal-social/peal) (`peal-contract`);
read its OpenAPI document before using an endpoint.

## Rules n8n sets

n8n verifies community nodes for its nodes panel and n8n Cloud only when they
follow its [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines).
Keep every one:

- MIT licence, English only (labels, descriptions, errors, README).
- No runtime dependencies: `dependencies` stays empty, `n8n-workflow` is a
  peer. Only `n8n-workflow` and Node's built-ins n8n allows (`node:crypto`)
  are imported at runtime.
- No environment variables, no file system, no `setTimeout` or other
  restricted globals in `nodes/` and `credentials/`.
- Requests go through `httpRequestWithAuthentication` with the `pealApi`
  credential. The one plain `httpRequest` sends a file to the store's address
  Peal signed, and lives in a function that never reads credentials.
- Published from GitHub Actions with a provenance statement
  (`.github/workflows/publish.yml`), never from a machine.
- `n8n-node lint` (ESLint with n8n's plugins) passes. `eslint.config.mjs` is
  the file `@n8n/node-cli` generates, byte for byte: strict mode
  (`n8n.strict` in `package.json`) checks it, so oxfmt leaves it alone.
- In every parameter object, `displayName` comes first (n8n's lint). Options
  are sorted by name.

## Tooling

- pnpm, as `packageManager` pins it. `@n8n/node-cli` knows npm, yarn and pnpm
  only, so not Bun.
- TypeScript stays on 6.0: n8n's lint runs typescript-eslint, which refuses
  TypeScript 7. Type-aware oxlint uses tsgolint's own compiler.
- `pnpm run check` runs oxfmt, oxlint (Ultracite's core, anti-slop and Vitest
  presets) and `n8n-node lint`. Fix findings without inline suppressions; an
  override in `oxlint.config.mts` says why it exists.
- The configs are `.mts`: marking the package `"type": "module"` would make
  `tsc` emit ES modules, and n8n loads nodes with `require()`.
- Tests run under Vitest, from `test/` (its own `tsconfig.json`), on plain
  functions: the request bodies, time zones, signatures, parsers and pages.
- Pin every dependency to its exact latest release and commit
  `pnpm-lock.yaml`. pnpm's supply-chain policy (`pnpm-workspace.yaml`) denies
  the install scripts no build needs.

## Code

- `nodes/shared/parse.ts` is the one boundary with untyped data: n8n's
  parameters and Peal's JSON answers. Its readers check each shape and return
  typed values; the rest of the code takes those. It alone relaxes the
  anti-slop rules about `typeof` and `unknown`, since there is no schema
  library to use.
- `nodes/shared/post-body.ts` turns the Create fields into Peal's request
  body, `time.ts` turns n8n's dates into instants with `Intl`, `signature.ts`
  checks deliveries as Standard Webhooks sign them.
- Lists page with `nextCursor`. `paginateByCursor` reads every page when
  Return All is on; otherwise the Limit field's `rootProperty` splits one page
  into items. n8n applies an operation's own `postReceive` inside pagination
  too, which would hide the cursor, so it stays on the Limit field.
- Never name a competitor or another product in code, comments, docs, commits
  or pull requests. Describe the behaviour instead.
- Tests use synthetic data only; a made-up secret says `synthetic`.

## Check it in n8n

Unit tests don't run n8n. Before a release, load the packed package into n8n
and run a workflow against a Peal server you own (a local one, never a
customer's workspace):

1. `pnpm run build && pnpm pack`, and unpack the tarball into
   `<n8n home>/.n8n/nodes/node_modules/n8n-nodes-peal`.
2. Start `n8nio/n8n` with that home mounted and `--network host`, so it reaches
   the Peal server and the store's signed upload addresses.
3. `n8n import:credentials` and `n8n import:workflow`, then
   `n8n execute --id <workflow> --rawOutput`, and read each node's result.

The trigger needs a public HTTPS address for Peal to call, so check it on an
n8n that has one.
