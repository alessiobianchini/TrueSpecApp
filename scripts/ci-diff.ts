import fs from "node:fs";
import { diffSpecs, DiffResult } from "../src/lib/diff";
import { loadSpec } from "../src/lib/loadSpec";
import { formatJson, formatMarkdown, formatText } from "../src/lib/format";

type Options = {
  base: string;
  head: string;
  failOn: string;
  format: string;
};

function parseArgs(argv: string[]): Partial<Options> {
  const options: Partial<Options> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "base" || key === "head" || key === "fail-on" || key === "format") {
      options[key.replace("-", "") as keyof Options] = value;
      i += 1;
    }
  }
  return options;
}

function resolveOptions(): Options {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const parsed = parseArgs(argv);
  const base = parsed.base || process.env.TRUESPEC_BASE;
  const head = parsed.head || process.env.TRUESPEC_HEAD;
  if (!base || !head) {
    throw new Error("Missing required --base and --head paths.");
  }

  return {
    base,
    head,
    failOn: String(parsed.failOn || process.env.TRUESPEC_FAIL_ON || "breaking").toLowerCase(),
    format: String(parsed.format || process.env.TRUESPEC_FORMAT || "markdown").toLowerCase(),
  };
}

function toOutput(result: DiffResult, format: string): string {
  if (format === "json") {
    return JSON.stringify(formatJson(result), null, 2);
  }
  if (format === "markdown") {
    return formatMarkdown(result);
  }
  if (format === "text") {
    return formatText(result);
  }
  throw new Error(`Unsupported format: ${format}`);
}

function applyExitCode(result: DiffResult, failOn: string) {
  const hasBreaking = result.summary.breaking > 0;
  const hasWarning = result.summary.warning > 0;

  if (failOn === "warning" && (hasBreaking || hasWarning)) {
    process.exitCode = 1;
  } else if (failOn === "breaking" && hasBreaking) {
    process.exitCode = 1;
  } else if (failOn === "none") {
    process.exitCode = 0;
  } else if (!["none", "breaking", "warning"].includes(failOn)) {
    throw new Error(`Unsupported fail-on level: ${failOn}`);
  } else {
    process.exitCode = 0;
  }
}

async function run() {
  try {
    const options = resolveOptions();
    const baseSpec = await loadSpec(options.base);
    const headSpec = await loadSpec(options.head);
    const result = diffSpecs(baseSpec, headSpec);

    const output = toOutput(result, options.format);
    process.stdout.write(`${output}\n`);

    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      const summary = formatMarkdown(result);
      fs.appendFileSync(summaryPath, `${summary}\n`);
    }

    applyExitCode(result, options.failOn);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(2);
  }
}

run();
