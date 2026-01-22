import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { fileURLToPath } from "node:url";

const DEFAULT_CACHE_TTL_SECONDS = 300;

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function getCacheTtlMs(): number {
  const raw = process.env.TRUESPEC_CACHE_TTL_SECONDS;
  if (!raw) {
    return DEFAULT_CACHE_TTL_SECONDS * 1000;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed * 1000;
}

function isCacheEnabled(): boolean {
  const raw = (process.env.TRUESPEC_CACHE || "").toLowerCase();
  return raw !== "0" && raw !== "false";
}

async function isFresh(pathname: string, ttlMs: number): Promise<boolean> {
  if (ttlMs <= 0) return false;
  try {
    const stats = await fs.stat(pathname);
    return Date.now() - stats.mtimeMs <= ttlMs;
  } catch {
    return false;
  }
}

async function loadRemoteSpec(specUrl: string): Promise<string> {
  const url = new URL(specUrl);
  if (url.protocol === "file:") {
    return fileURLToPath(url);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }

  const extension = path.extname(url.pathname) || ".yaml";
  const cacheDir = path.join(os.tmpdir(), "truespec-cache");
  const cacheKey = crypto.createHash("sha256").update(specUrl).digest("hex").slice(0, 16);
  const cachePath = path.join(cacheDir, `${cacheKey}${extension}`);
  const ttlMs = getCacheTtlMs();

  if (isCacheEnabled() && (await isFresh(cachePath, ttlMs))) {
    return cachePath;
  }

  if (typeof fetch !== "function") {
    throw new Error("Fetch is not available in this runtime.");
  }

  const response = await fetch(specUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec (${response.status}) ${specUrl}`);
  }
  const body = await response.text();
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cachePath, body, "utf8");
  return cachePath;
}

export async function loadSpec(specPath: string): Promise<Record<string, unknown>> {
  let resolvedPath = specPath;
  if (isUrl(specPath)) {
    resolvedPath = await loadRemoteSpec(specPath);
  } else {
    resolvedPath = path.resolve(specPath);
  }
  const spec = await SwaggerParser.dereference(resolvedPath);
  return spec as Record<string, unknown>;
}
