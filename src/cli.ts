import { Command } from "commander";
import { diffSpecs, DiffResult } from "./lib/diff";
import { loadSpec } from "./lib/loadSpec";
import { formatJson, formatMarkdown, formatText } from "./lib/format";

const program = new Command();

program
  .name("truespec")
  .description("OpenAPI spec drift checks for CI and local use.")
  .version("0.0.1");

program
  .command("diff")
  .description("Compare two OpenAPI specs")
  .requiredOption("--base <file>", "Path to the base OpenAPI spec")
  .requiredOption("--head <file>", "Path to the head OpenAPI spec")
  .option("--fail-on <level>", "none | breaking | warning", "none")
  .option("--format <format>", "text | markdown | json", "text")
  .option("--json", "Output JSON (deprecated)")
  .action(async (options) => {
    try {
      const baseSpec = await loadSpec(options.base);
      const headSpec = await loadSpec(options.head);
      const result: DiffResult = diffSpecs(baseSpec, headSpec);
      const failOn = String(options.failOn || "none").toLowerCase();
      const format = String(options.json ? "json" : options.format || "text").toLowerCase();

      if (!["text", "markdown", "json"].includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }
      if (!["none", "breaking", "warning"].includes(failOn)) {
        throw new Error(`Unsupported fail-on level: ${failOn}`);
      }

      if (format === "json") {
        process.stdout.write(`${JSON.stringify(formatJson(result), null, 2)}\n`);
      } else if (format === "markdown") {
        process.stdout.write(`${formatMarkdown(result)}\n`);
      } else {
        process.stdout.write(`${formatText(result)}\n`);
      }

      const hasBreaking = result.summary.breaking > 0;
      const hasWarning = result.summary.warning > 0;

      if (failOn === "warning" && (hasBreaking || hasWarning)) {
        process.exitCode = 1;
      } else if (failOn === "breaking" && hasBreaking) {
        process.exitCode = 1;
      } else {
        process.exitCode = 0;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(2);
    }
  });

const argv = process.argv.slice(2);
if (argv[0] === "--") {
  argv.shift();
}

program.parseAsync(["node", "truespec", ...argv]);
