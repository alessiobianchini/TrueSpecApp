import { createHash, randomBytes } from "crypto";

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const generateApiKey = () => {
  const token = `ts_${randomBytes(24).toString("base64url")}`;
  return { token, hash: hashToken(token) };
};
