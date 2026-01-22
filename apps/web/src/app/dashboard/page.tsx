"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Project = {
  id: string;
  name: string;
  slug: string;
};

type Report = {
  id: string;
  breakingCount: number;
  warningCount: number;
  infoCount: number;
  createdAt: string;
};

export default function DashboardPage() {
  const { token, activeOrgId, loading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (reports.length === 0) {
      return { breaking: 0, warning: 0, info: 0 };
    }
    return reports.reduce(
      (acc, report) => {
        acc.breaking += report.breakingCount;
        acc.warning += report.warningCount;
        acc.info += report.infoCount;
        return acc;
      },
      { breaking: 0, warning: 0, info: 0 }
    );
  }, [reports]);

  const loadProjects = async () => {
    if (!token || !activeOrgId) return;
    const data = await apiRequest<Project[]>(`/v1/orgs/${activeOrgId}/projects`, {
      token,
    });
    setProjects(data);
    if (data[0]) {
      const reportData = await apiRequest<Report[]>(
        `/v1/orgs/${activeOrgId}/projects/${data[0].id}/reports`,
        { token }
      );
      setReports(reportData.slice(0, 6));
    }
  };

  useEffect(() => {
    if (!token || !activeOrgId) return;
    loadProjects().catch((err) => setError(err.message));
  }, [token, activeOrgId]);

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !activeOrgId) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/v1/orgs/${activeOrgId}/projects`, {
        method: "POST",
        token,
        body: {
          name: projectName,
          slug: projectSlug || undefined,
        },
      });
      setProjectName("");
      setProjectSlug("");
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen" />;
  }

  if (!token) {
    return (
      <div className="min-h-screen px-6 py-16">
        <EmptyState
          title="Sign in to access the console"
          description="Track orgs, projects, and spec drift reports once you are logged in."
        />
      </div>
    );
  }

  return (
    <AppShell
      title="Enterprise"
      subtitle="Monitor spec drift, automate reporting, and share insights with stakeholders."
    >
      <div className="grid gap-6">
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Breaking</p>
            <p className="mt-3 text-3xl font-semibold text-red-400">{summary.breaking}</p>
            <p className="mt-2 text-sm text-slate-400">Critical issues detected.</p>
          </div>
          <div className="panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Warnings</p>
            <p className="mt-3 text-3xl font-semibold text-amber-300">{summary.warning}</p>
            <p className="mt-2 text-sm text-slate-400">Drift warnings in review.</p>
          </div>
          <div className="panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Info</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-300">{summary.info}</p>
            <p className="mt-2 text-sm text-slate-400">Low risk changes logged.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Projects</h2>
              <span className="text-xs text-slate-400">{projects.length} total</span>
            </div>
            <div className="mt-4 space-y-3">
              {projects.length === 0 && (
                <p className="text-sm text-slate-400">No projects yet. Create one below.</p>
              )}
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{project.name}</p>
                    <p className="text-xs text-slate-400">{project.slug}</p>
                  </div>
                  <span className="text-xs text-slate-400">Active</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel rounded-3xl p-6">
            <h2 className="text-xl font-semibold">Create project</h2>
            <p className="mt-2 text-sm text-slate-400">
              Add a service or API to start ingesting drift reports.
            </p>
            <form className="mt-4 flex flex-col gap-3" onSubmit={handleCreateProject}>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm"
                placeholder="Project name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                required
              />
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm"
                placeholder="Slug (optional)"
                value={projectSlug}
                onChange={(event) => setProjectSlug(event.target.value)}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950"
                type="submit"
                disabled={busy}
              >
                {busy ? "Creating..." : "Create project"}
              </button>
            </form>
          </div>
        </section>

        <section className="panel rounded-3xl p-6">
          <h2 className="text-xl font-semibold">Recent reports</h2>
          <p className="mt-2 text-sm text-slate-400">
            Latest drift checks from your primary project.
          </p>
          <div className="mt-4 space-y-3">
            {reports.length === 0 && (
              <p className="text-sm text-slate-400">No reports yet.</p>
            )}
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">Report {report.id.slice(0, 6)}</p>
                  <p className="text-xs text-slate-400">{new Date(report.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <span className="text-red-400">{report.breakingCount} breaking</span>
                  <span className="text-amber-300">{report.warningCount} warnings</span>
                  <span className="text-emerald-300">{report.infoCount} info</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
