"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AppShell({ title, subtitle, children }: AppShellProps) {
  const { user, orgs, activeOrgId, setActiveOrgId, logout } = useAuth();

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">TrueSpec Console</p>
            <h1 className="mt-2 text-3xl font-semibold">
              {title} <span className="accent-gradient">control center</span>
            </h1>
            {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="panel flex items-center gap-3 rounded-full px-4 py-2 text-sm">
              <span className="text-slate-400">Org</span>
              <select
                className="bg-transparent text-sm text-slate-100 focus:outline-none"
                value={activeOrgId ?? ""}
                onChange={(event) => setActiveOrgId(event.target.value)}
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id} className="text-slate-950">
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="panel flex items-center gap-3 rounded-full px-4 py-2 text-sm">
              <span className="text-slate-400">{user?.email ?? "Guest"}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-slate-700 px-3 py-1 text-xs hover:border-slate-500"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="panel flex flex-col gap-3 rounded-3xl p-5">
            <nav className="flex flex-col gap-2 text-sm">
              <Link className="rounded-xl px-3 py-2 hover:bg-slate-800/70" href="/dashboard">
                Overview
              </Link>
              <Link className="rounded-xl px-3 py-2 hover:bg-slate-800/70" href="/projects">
                Projects
              </Link>
              <Link className="rounded-xl px-3 py-2 hover:bg-slate-800/70" href="/audit">
                Audit log
              </Link>
              <Link className="rounded-xl px-3 py-2 hover:bg-slate-800/70" href="/settings">
                Settings
              </Link>
            </nav>
            <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-200">Enterprise rollout</p>
              <p className="mt-2">
                Share your CI configuration and we will deliver a tailored onboarding plan.
              </p>
              <a
                className="mt-3 inline-flex text-slate-200 underline-offset-4 hover:underline"
                href="mailto:enterprise@truespec-app.com"
              >
                Contact sales
              </a>
            </div>
          </aside>
          <main className="min-h-[60vh]">{children}</main>
        </div>
      </div>
    </div>
  );
}
