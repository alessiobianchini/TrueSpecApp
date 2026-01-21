import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";

export async function loadSpec(specPath: string): Promise<Record<string, unknown>> {
  const absolutePath = path.resolve(specPath);
  const spec = await SwaggerParser.dereference(absolutePath);
  return spec as Record<string, unknown>;
}
