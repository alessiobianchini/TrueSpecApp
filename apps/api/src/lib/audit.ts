import prisma from "./prisma.js";

type AuditInput = {
  orgId: string;
  actorId?: string | null;
  action: string;
  targetType: "org" | "project" | "report" | "api_key" | "member";
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export const logAudit = async (input: AuditInput) =>
  prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
