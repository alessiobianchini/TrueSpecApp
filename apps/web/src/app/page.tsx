import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-10 px-6 py-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">TrueSpec Enterprise</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
            Control center for <span className="accent-gradient">spec governance</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Manage orgs, projects, and drift reports in one place. Built for enterprise rollout
            with audit-ready history and API automation.
          </p>
        </div>
        <div className="panel grid gap-6 rounded-3xl p-6 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace</p>
            <p className="mt-3 text-xl font-semibold">Multi-org control</p>
            <p className="mt-2 text-sm text-slate-400">
              Centralize specs and ownership across teams.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Reports</p>
            <p className="mt-3 text-xl font-semibold">Audit-ready diffs</p>
            <p className="mt-2 text-sm text-slate-400">Track breaking changes with full history.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <p className="mt-3 text-xl font-semibold">API keys for CI</p>
            <p className="mt-2 text-sm text-slate-400">Push reports directly from pipelines.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950"
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className="rounded-full border border-slate-700 px-6 py-3 text-sm hover:border-slate-500"
            href="/register"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
