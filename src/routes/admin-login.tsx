import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { getAdminAccess, loginAdmin } from "@/lib/project-access.functions";

export const Route = createFileRoute("/admin-login")({
  loader: async () => {
    const access = await getAdminAccess();
    if (access.authorized) throw redirect({ to: "/upload" });
    if (access.portal) throw redirect({ href: "/auth/portal/start" });
    return {};
  },
  head: () => ({
    meta: [
      { title: "Admin Login · VIA International" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await loginAdmin({ data: { password } });
      if (!result.authorized) {
        setError("Incorrect admin password. Please try again.");
        return;
      }
      await router.navigate({ to: "/upload" });
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#eef1f4] p-5 md:p-8 lg:grid-cols-[1.1fr_.9fr]">
      <section className="flex min-h-[45vh] flex-col justify-between bg-brand p-8 text-white md:p-12 lg:min-h-0">
        <div className="font-mono text-[10px] uppercase tracking-[.2em] text-white/70">
          VIA International
        </div>
        <div className="max-w-xl py-16">
          <div className="font-mono text-[10px] uppercase tracking-[.24em] text-white/60">
            Internal system
          </div>
          <h1 className="mt-5 text-5xl font-black uppercase leading-[.9] tracking-tighter md:text-7xl">
            Admin
            <br />
            access.
          </h1>
          <p className="mt-7 max-w-md text-sm leading-relaxed text-white/65">
            Restricted area. Authorised VIA International staff only.
          </p>
        </div>
        <div className="h-0.5 w-full bg-signal-alert" />
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-16">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="grid size-12 place-items-center border border-border bg-[#eef1f4] text-brand">
            <LockKeyhole size={20} />
          </div>
          <div className="dashboard-eyebrow mt-8 text-signal-alert">Admin portal</div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-brand">
            Enter admin password
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Use the administrator password to access report upload and project management.
          </p>
          <label htmlFor="admin-password" className="dashboard-eyebrow mt-8 block">
            Admin password
          </label>
          <input
            disabled={!ready}
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            className="mt-2 h-12 w-full border border-input bg-white px-4 font-mono text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
          {error && (
            <p role="alert" className="mt-3 text-xs text-signal-alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !ready}
            className="mt-5 flex h-12 w-full items-center justify-between bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-[.18em] text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            <span>{loading ? "Checking…" : "Sign in"}</span>
            <ArrowRight size={15} />
          </button>
        </form>
      </section>
    </main>
  );
}
