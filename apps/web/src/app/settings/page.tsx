"use client";

import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen" />;
  }

  if (!token) {
    return (
      <div className="min-h-screen px-6 py-16">
        <EmptyState
          title="Settings are locked"
          description="Sign in to manage org settings and access controls."
        />
      </div>
    );
  }

  return (
    <AppShell title="Settings" subtitle="Manage members, API keys, and security preferences.">
      <div className="panel rounded-3xl p-6">
        <h2 className="text-xl font-semibold">Org settings</h2>
        <p className="mt-2 text-sm text-slate-400">
          Org roles, SSO configuration, and retention policies will appear here.
        </p>
      </div>
    </AppShell>
  );
}
