"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading, error } = useAuth();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const ok = await register({ name, orgName, email, password });
    setSubmitting(false);
    if (ok) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <div className="panel rounded-3xl p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Get started</p>
          <h1 className="mt-3 text-3xl font-semibold">Create your console</h1>
          <p className="mt-2 text-sm text-slate-400">
            Create an org and start tracking spec drift reports.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm text-slate-300">
              Name
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex B."
              />
            </label>
            <label className="text-sm text-slate-300">
              Org name
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm"
                type="text"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                placeholder="TrueSpec Labs"
              />
            </label>
            <label className="text-sm text-slate-300">
              Work email
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </label>
            <label className="text-sm text-slate-300">
              Password
              <input
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950"
              type="submit"
              disabled={loading || submitting}
            >
              {submitting ? "Creating..." : "Create account"}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-400">
            Already have access?{" "}
            <Link className="text-slate-100 underline-offset-4 hover:underline" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
