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

- `breaking`: removed operations or removed response status codes
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
