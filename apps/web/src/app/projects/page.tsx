"use client";

import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/auth";

export default function ProjectsPage() {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen" />;
  }

  if (!token) {
    return (
      <div className="min-h-screen px-6 py-16">
        <EmptyState
          title="Projects are locked"
          description="Sign in to manage projects and API integrations."
        />
      </div>
    );
  }

  return (
    <AppShell title="Projects" subtitle="Organize services and connect spec sources.">
      <div className="panel rounded-3xl p-6">
        <h2 className="text-xl font-semibold">Project management</h2>
        <p className="mt-2 text-sm text-slate-400">
          Use the dashboard to create new projects. This view will soon include ownership,
          environment tags, and report history.
        </p>
      </div>
    </AppShell>
  );
}
