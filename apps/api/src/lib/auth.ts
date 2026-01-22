import type { FastifyReply, FastifyRequest } from "fastify";
import { OrgRole } from "@prisma/client";
import prisma from "./prisma.js";
import { hashToken } from "./crypto.js";
import { hashPassword } from "./password.js";

export type AuthContext =
  | { mode: "user"; userId: string; role: OrgRole; orgId?: string }
  | { mode: "api_key"; orgId: string; apiKeyId: string };

const devEmail = process.env.DEV_USER_EMAIL || "dev@truespec.local";

const ensureDevUser = async () => {
  const existing = await prisma.user.findUnique({ where: { email: devEmail } });
  if (existing) return existing;
  const password = await hashPassword(`dev-${Date.now()}`);
  return prisma.user.create({
    data: {
      email: devEmail,
      name: "Dev User",
      password,
    },
  });
};

export const resolveApiKey = async (request: FastifyRequest) => {
  const apiKey = request.headers["x-api-key"];
  if (typeof apiKey !== "string" || apiKey.length === 0) return null;
  const keyHash = hashToken(apiKey);
  const record = await prisma.apiKey.findFirst({
    where: { keyHash, revokedAt: null },
  });
  if (!record) return null;
  await prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { orgId: record.orgId, apiKeyId: record.id };
};

export const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
  if (process.env.DEV_AUTH_BYPASS === "1") {
    return ensureDevUser();
  }

  try {
    const payload = await request.jwtVerify<{ sub: string }>();
    const userId = payload.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      reply.code(401).send({ error: "Invalid user." });
      return null;
    }
    return user;
  } catch {
    reply.code(401).send({ error: "Unauthorized." });
    return null;
  }
};

export const requireOrgMember = async (
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const member = await prisma.organizationMember.findFirst({
    where: { orgId, userId: user.id },
  });
  if (!member) {
    reply.code(403).send({ error: "Forbidden." });
    return null;
  }
  return { user, member };
};

export const requireOrgAccess = async (
  request: FastifyRequest,
  reply: FastifyReply,
  orgId: string
) => {
  const apiKeyAuth = await resolveApiKey(request);
  if (apiKeyAuth && apiKeyAuth.orgId === orgId) {
    return { mode: "api_key", orgId, apiKeyId: apiKeyAuth.apiKeyId } as AuthContext;
  }

  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return null;
  return {
    mode: "user",
    userId: membership.user.id,
    role: membership.member.role,
    orgId,
  } satisfies AuthContext;
};
