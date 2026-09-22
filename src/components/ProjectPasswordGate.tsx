import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Eye,
  EyeOff,
  FileText,
  BarChart3,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { unlockProject } from "@/lib/project-access.functions";

import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/lib/projects.functions";
import { PortalProjectCard } from "./PortalProjectCard";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import "./portal.css";

export function ProjectPasswordGate({ slug, projectName }: { slug: string; projectName: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { data: projects = [], isError: directoryError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });
  const related = projects.filter((p) => p.slug !== slug).slice(0, 3);
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
      const result = await unlockProject({ data: { slug, password } });
      if (!result.authorized) {
        setError("That password is not correct. Please try again.");
        return;
      }
      await router.invalidate();
    } catch {
      setError("We couldn't verify the password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="via-portal">
      <SiteHeader />
      <main>
        <section className="portal-shell portal-access">
          <Link to="/" className="portal-back">
            <ArrowLeft size={15} aria-hidden="true" /> All projects
          </Link>
          <div className="portal-access-grid">
            <div className="portal-access-intro">
              <span className="portal-kicker">VIA INTERNATIONAL / CLIENT ACCESS</span>
              <h1>{projectName}</h1>
              <p>
                A dedicated window into your project. Access the latest progress, reports and
                updates from your VIA team.
              </p>
              <div className="portal-access-features">
                <span>
                  <BarChart3 size={16} aria-hidden="true" /> Progress dashboards
                </span>
                <span>
                  <FileText size={16} aria-hidden="true" /> Monthly reports
                </span>
              </div>
            </div>
            <form onSubmit={submit} className="portal-access-form">
              <div className="inline-flex bg-blue-50 p-3 text-brand">
                <LockKeyhole size={22} aria-hidden="true" />
              </div>
              <h2>Welcome to your project.</h2>
              <p>Enter the password supplied by your VIA project contact to open your dashboard.</p>
              <label htmlFor="project-password">Project password</label>
              <div className="portal-password-wrap">
                <input
                  disabled={!ready || loading}
                  id="project-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? "project-password-error" : undefined}
                />
                <button
                  type="button"
                  className="portal-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <p id="project-password-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading || !ready} className="portal-unlock">
                <span>{loading ? "Checking…" : "Open dashboard"}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <p>
                <LockKeyhole size={12} className="mr-1 inline" aria-hidden="true" /> Your project
                information stays private.
              </p>
              <p>Need a password? Please contact your VIA project team.</p>
            </form>
          </div>
        </section>
        {(related.length > 0 || directoryError) && (
          <section className="portal-shell portal-related" aria-labelledby="other-projects-heading">
            <div className="portal-section-heading">
              <div>
                <p className="portal-kicker">DISCOVER MORE</p>
                <h2 id="other-projects-heading">Other VIA projects</h2>
              </div>
              <Link to="/" className="inline-flex items-center gap-3 text-sm text-brand">
                View all projects <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              Explore our project directory. Each dashboard requires its own project password.
            </p>
            {directoryError ? (
              <p className="text-sm text-muted-foreground">
                The project directory is temporarily unavailable. You can still sign in above.
              </p>
            ) : (
              <div className="portal-project-grid">
                {related.map((p, i) => (
                  <PortalProjectCard key={p.id} project={p} index={i} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
