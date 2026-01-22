import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { z } from "zod";
import prisma from "./lib/prisma.js";
import { generateApiKey } from "./lib/crypto.js";
import { hashPassword, verifyPassword } from "./lib/password.js";
import { toSlug } from "./lib/slug.js";
import { logAudit } from "./lib/audit.js";
import { requireOrgAccess, requireOrgMember, requireUser } from "./lib/auth.js";

const app = Fastify({ logger: true });

const jwtSecret = process.env.JWT_SECRET || "dev_secret";

await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",").map((value) => value.trim()) ?? true,
  credentials: true,
});

await app.register(jwt, { secret: jwtSecret });

app.get("/health", async () => ({ ok: true }));

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
  orgName: z.string().min(2).optional(),
});

app.post("/v1/auth/register", async (request, reply) => {
  const body = registerSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: "Invalid payload." });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (existing) {
    return reply.code(409).send({ error: "Account already exists." });
  }

  const password = await hashPassword(body.data.password);
  const user = await prisma.user.create({
    data: {
      email: body.data.email,
      name: body.data.name ?? null,
      password,
    },
  });

  const orgName = body.data.orgName ?? `${body.data.name ?? "Team"} Org`;
  const baseSlug = toSlug(orgName) || "org";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });

  await logAudit({
    orgId: org.id,
    actorId: user.id,
    action: "org.created",
    targetType: "org",
    targetId: org.id,
  });

  const token = await reply.jwtSign({}, { sign: { subject: user.id } });

  return reply.code(201).send({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    org: { id: org.id, name: org.name, slug: org.slug },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

app.post("/v1/auth/login", async (request, reply) => {
  const body = loginSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: "Invalid payload." });
  }

  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user) {
    return reply.code(401).send({ error: "Invalid credentials." });
  }

  const isValid = await verifyPassword(body.data.password, user.password);
  if (!isValid) {
    return reply.code(401).send({ error: "Invalid credentials." });
  }

  const token = await reply.jwtSign({}, { sign: { subject: user.id } });
  return reply.send({ token });
});

app.get("/v1/auth/me", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { org: true },
  });

  return reply.send({
    user: { id: user.id, email: user.email, name: user.name },
    orgs: memberships.map((membership) => ({
      id: membership.orgId,
      name: membership.org.name,
      slug: membership.org.slug,
      role: membership.role,
    })),
  });
});

const orgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
});

app.post("/v1/orgs", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;

  const body = orgSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: "Invalid payload." });
  }

  const baseSlug = toSlug(body.data.slug ?? body.data.name) || "org";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const org = await prisma.organization.create({
    data: {
      name: body.data.name,
      slug,
      members: {
        create: { userId: user.id, role: "owner" },
      },
    },
  });

  await logAudit({
    orgId: org.id,
    actorId: user.id,
    action: "org.created",
    targetType: "org",
    targetId: org.id,
  });

  return reply.code(201).send({ id: org.id, name: org.name, slug: org.slug });
});

app.get("/v1/orgs", async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { org: true },
  });
  return reply.send(
    memberships.map((membership) => ({
      id: membership.orgId,
      name: membership.org.name,
      slug: membership.org.slug,
      role: membership.role,
    }))
  );
});

const projectSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
});

app.post("/v1/orgs/:orgId/projects", async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  const body = projectSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: "Invalid payload." });
  }

  const slug = toSlug(body.data.slug ?? body.data.name) || "project";
  const project = await prisma.project.create({
    data: {
      orgId,
      name: body.data.name,
      slug,
    },
  });

  await logAudit({
    orgId,
    actorId: membership.user.id,
    action: "project.created",
    targetType: "project",
    targetId: project.id,
  });

  return reply.code(201).send({ id: project.id, name: project.name, slug: project.slug });
});

app.get("/v1/orgs/:orgId/projects", async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  const projects = await prisma.project.findMany({ where: { orgId } });
  return reply.send(projects);
});

const reportSchema = z.object({
  baseRef: z.string().optional(),
  headRef: z.string().optional(),
  summary: z.record(z.unknown()).default({}),
  breakingCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  infoCount: z.number().int().nonnegative(),
});

app.post("/v1/orgs/:orgId/projects/:projectId/reports", async (request, reply) => {
  const { orgId, projectId } = request.params as { orgId: string; projectId: string };
  const auth = await requireOrgAccess(request, reply, orgId);
  if (!auth) return;

  const body = reportSchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: "Invalid payload." });
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, orgId } });
  if (!project) {
    return reply.code(404).send({ error: "Project not found." });
  }

  const report = await prisma.report.create({
    data: {
      projectId,
      baseRef: body.data.baseRef,
      headRef: body.data.headRef,
      summary: body.data.summary,
      breakingCount: body.data.breakingCount,
      warningCount: body.data.warningCount,
      infoCount: body.data.infoCount,
    },
  });

  await logAudit({
    orgId,
    actorId: auth.mode === "user" ? auth.userId : null,
    action: "report.created",
    targetType: "report",
    targetId: report.id,
    metadata: {
      projectId,
      breakingCount: report.breakingCount,
      warningCount: report.warningCount,
      infoCount: report.infoCount,
    },
  });

  return reply.code(201).send({ id: report.id });
});

app.get("/v1/orgs/:orgId/projects/:projectId/reports", async (request, reply) => {
  const { orgId, projectId } = request.params as { orgId: string; projectId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  const reports = await prisma.report.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return reply.send(reports);
});

const apiKeySchema = z.object({
  name: z.string().min(2),
});

app.post("/v1/orgs/:orgId/api-keys", async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  const body = apiKeySchema.safeParse(request.body);
  if (!body.success) {
    return reply.code(400).send({ error: "Invalid payload." });
  }

  const { token, hash } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: {
      orgId,
      name: body.data.name,
      keyHash: hash,
    },
  });

  await logAudit({
    orgId,
    actorId: membership.user.id,
    action: "api_key.created",
    targetType: "api_key",
    targetId: apiKey.id,
  });

  return reply.code(201).send({
    id: apiKey.id,
    name: apiKey.name,
    token,
  });
});

app.get("/v1/orgs/:orgId/api-keys", async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  const keys = await prisma.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
  return reply.send(
    keys.map((key) => ({
      id: key.id,
      name: key.name,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    }))
  );
});

app.delete("/v1/orgs/:orgId/api-keys/:keyId", async (request, reply) => {
  const { orgId, keyId } = request.params as { orgId: string; keyId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  await logAudit({
    orgId,
    actorId: membership.user.id,
    action: "api_key.revoked",
    targetType: "api_key",
    targetId: keyId,
  });

  return reply.code(204).send();
});

app.get("/v1/orgs/:orgId/audit-log", async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const membership = await requireOrgMember(request, reply, orgId);
  if (!membership) return;

  const logs = await prisma.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return reply.send(logs);
});

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
