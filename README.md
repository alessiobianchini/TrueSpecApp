# TrueSpec CLI (MVP)

Detect OpenAPI spec drift by comparing two OpenAPI files.

## Install

```bash
pnpm install
```

## Usage

```bash
pnpm dev -- diff --base examples/openapi-base.yaml --head examples/openapi-head.yaml
```

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

- `breaking`: removed operations, removed response status codes, removed schema fields, enum changes
- `warning`: newly required params or request bodies
- `info`: added operations or response status codes

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

Use the CI helper script to write a Markdown report into the PR summary:

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
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Prepare base spec
        run: |
          git show origin/${{ github.base_ref }}:specs/openapi.yaml > /tmp/openapi-base.yaml
      - name: TrueSpec diff
        run: |
          pnpm tsx scripts/ci-diff.ts \
            --base /tmp/openapi-base.yaml \
            --head specs/openapi.yaml \
            --fail-on breaking \
            --format markdown
```

See `examples/github-action.yml` for the ready-to-copy workflow file.

The script also supports env vars: `TRUESPEC_BASE`, `TRUESPEC_HEAD`, `TRUESPEC_FAIL_ON`, `TRUESPEC_FORMAT`.
