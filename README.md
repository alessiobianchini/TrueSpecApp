# TrueSpec CLI (MVP)

Detect OpenAPI spec drift by comparing two OpenAPI files.

## Install (npm)

Quick run:

```bash
npx truespec diff --base openapi-base.yaml --head openapi-head.yaml
```

Global install:

```bash
npm install -g truespec
truespec diff --base openapi-base.yaml --head openapi-head.yaml
```

## Local development

```bash
pnpm install
```

## Usage

```bash
pnpm dev -- diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml
```

Remote specs (URLs) are supported:

```bash
npx truespec diff --base https://example.com/openapi-base.yaml --head https://example.com/openapi-head.yaml
```

Caching for remote specs:

- `TRUESPEC_CACHE=0` disables caching
- `TRUESPEC_CACHE_TTL_SECONDS=300` sets the cache TTL (default 300s)

Fail on breaking changes (CI):

```bash
pnpm dev -- diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml --fail-on breaking
```

Do not fail the command (default):

```bash
pnpm dev -- diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml --fail-on none
```

Build and run:

```bash
pnpm build
node dist/cli.js diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml
```

## Output

- `breaking`: removed operations, removed response status codes, removed schema fields, enum/type changes
- `warning`: newly required params, request bodies, or request fields
- `info`: added operations, response status codes, or response fields

Example output:

```text
Summary
Breaking: 5 | Warning: 3 | Info: 3

BREAKING (5)
- Removed operation DELETE /v1/users/{id}
- Removed response 404 for GET /v1/users
- Enum changed at response.200.body.status (removed: "disabled"; added: "pending")
- Removed field response.200.body.email
- Type changed at request.body.price (number -> string)

WARNING (3)
- New required parameter query:dryRun for PUT /v1/plans
- Request body is now required for PUT /v1/plans
- New required field request.body.name

INFO (3)
- Added operation GET /v1/billing
- Added response 422 for GET /v1/users
- Added field response.200.body.tier
```

## JSON output

```bash
pnpm dev -- diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml --json
```

## Output formats

```bash
pnpm dev -- diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml --format markdown
```

Supported formats:

- `text` (default)
- `markdown`
- `json` (or `--json`)

## Exit codes

- `0`: completed, policy passed
- `1`: policy failed (`--fail-on`)
- `2`: runtime error (invalid spec, parse error, etc.)

## GitHub Actions (PR summary)

Write the Markdown report into the PR summary:

```yaml
name: TrueSpec Diff
on:
  pull_request:
    paths:
      - "specs/openapi.yaml"

jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Prepare base spec
        run: |
          git show origin/${{ github.base_ref }}:specs/openapi.yaml > /tmp/openapi-base.yaml
      - name: TrueSpec diff
        run: |
          set -euo pipefail
          npx truespec diff \
            --base /tmp/openapi-base.yaml \
            --head specs/openapi.yaml \
            --fail-on breaking \
            --format markdown | tee -a "$GITHUB_STEP_SUMMARY"
```

See `examples/github-action.yml` for the ready-to-copy workflow file.

The script also supports env vars: `TRUESPEC_BASE`, `TRUESPEC_HEAD`, `TRUESPEC_FAIL_ON`, `TRUESPEC_FORMAT`.
