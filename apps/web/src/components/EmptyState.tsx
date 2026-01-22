import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="panel mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-3xl px-8 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">TrueSpec Console</p>
      <h2 className="text-3xl font-semibold">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          className="rounded-full border border-slate-700 px-5 py-2 text-sm hover:border-slate-500"
          href="/sign-in"
        >
          Sign in
        </Link>
        <Link
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950"
          href="/register"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
