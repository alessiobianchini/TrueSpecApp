"use client";

import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/auth";

export default function AuditPage() {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen" />;
  }

  if (!token) {
    return (
      <div className="min-h-screen px-6 py-16">
        <EmptyState
          title="Audit log requires access"
          description="Sign in to review org activity and security events."
        />
      </div>
    );
  }

  return (
    <AppShell title="Audit log" subtitle="Track every report, token, and org action.">
      <div className="panel rounded-3xl p-6">
        <h2 className="text-xl font-semibold">Audit visibility</h2>
        <p className="mt-2 text-sm text-slate-400">
          Audit export and filters will land next. The API already stores audit events for orgs,
          reports, and API keys.
        </p>
      </div>
    </AppShell>
  );
}
