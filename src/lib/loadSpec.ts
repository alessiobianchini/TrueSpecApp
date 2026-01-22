import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { fileURLToPath } from "node:url";

const DEFAULT_CACHE_TTL_SECONDS = 300;
const TRUTHY = new Set(["1", "true", "yes"]);

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

function shouldBustCache(): boolean {
  const raw = (process.env.TRUESPEC_CACHE_BUST || "").toLowerCase();
  return TRUTHY.has(raw);
}

function parseHeaderEnv(): Record<string, string> {
  const raw = process.env.TRUESPEC_HTTP_HEADERS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("TRUESPEC_HTTP_HEADERS must be a JSON object.");
    }
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = String(value);
      return acc;
    }, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Invalid TRUESPEC_HTTP_HEADERS: ${message}`);
  }
}

function applyAuthHeader(headers: Record<string, string>) {
  const token = process.env.TRUESPEC_AUTH_TOKEN;
  if (!token) return;
  const hasAuth = Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
  if (hasAuth) return;
  const scheme = process.env.TRUESPEC_AUTH_SCHEME || "Bearer";
  headers.Authorization = `${scheme} ${token}`;
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
  const bypassCache = shouldBustCache() || !isCacheEnabled();

  if (!bypassCache && (await isFresh(cachePath, ttlMs))) {
    return cachePath;
  }

  if (typeof fetch !== "function") {
    throw new Error("Fetch is not available in this runtime.");
  }

  const headers = parseHeaderEnv();
  applyAuthHeader(headers);
  if (shouldBustCache() && !Object.keys(headers).some((key) => key.toLowerCase() === "cache-control")) {
    headers["Cache-Control"] = "no-cache";
  }

  const response = await fetch(specUrl, {
    headers,
    cache: shouldBustCache() ? "no-store" : "default",
  });
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
