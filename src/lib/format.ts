import { DiffItem, DiffResult } from "./diff";

const ORDER = ["breaking", "warning", "info"] as const;

export type JsonOutput = {
  schemaVersion: "1";
  generatedAt: string;
  summary: DiffResult["summary"];
  items: DiffItem[];
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatText(result: DiffResult): string {
  const lines: string[] = [];
  lines.push("Summary");
  lines.push(
    `Breaking: ${result.summary.breaking} | Warning: ${result.summary.warning} | Info: ${result.summary.info}`
  );

  if (result.items.length === 0) {
    lines.push("");
    lines.push("No differences found.");
    return lines.join("\n");
  }

  ORDER.forEach((severity) => {
    const items = result.items.filter((item) => item.severity === severity);
    if (items.length === 0) return;
    lines.push("");
    lines.push(`${severity.toUpperCase()} (${items.length})`);
    items.forEach((item) => {
      lines.push(`- ${item.message}`);
    });
  });

  return lines.join("\n");
}

export function formatMarkdown(result: DiffResult): string {
  const lines: string[] = [];
  lines.push("## TrueSpec Summary");
  lines.push("");
  lines.push(`- Breaking: ${result.summary.breaking}`);
  lines.push(`- Warning: ${result.summary.warning}`);
  lines.push(`- Info: ${result.summary.info}`);

  if (result.items.length === 0) {
    lines.push("");
    lines.push("No differences found.");
    return lines.join("\n");
  }

  ORDER.forEach((severity) => {
    const items = result.items.filter((item) => item.severity === severity);
    if (items.length === 0) return;
    lines.push("");
    lines.push(`### ${titleCase(severity)} (${items.length})`);
    items.forEach((item) => {
      lines.push(`- ${item.message}`);
    });
  });

  return lines.join("\n");
}

export function formatJson(result: DiffResult): JsonOutput {
  return {
    schemaVersion: "1",
    generatedAt: new Date().toISOString(),
    summary: result.summary,
    items: result.items,
  };
}
