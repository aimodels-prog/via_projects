import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUpRight, LockKeyhole, Search, ShieldCheck } from "lucide-react";
import { portalProjectsQuery } from "@/lib/portal-projects";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PortalProjectCard } from "./PortalProjectCard";
import hero from "@/assets/via-portal-hero.jpg";
import "./portal.css";

export function ProjectDirectory() {
  const { data: projects } = useSuspenseQuery(portalProjectsQuery);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const statuses = [
    ...new Set(projects.map((p) => p.status.trim().toLowerCase()).filter(Boolean)),
  ].sort();
  const regions = [
    ...new Set(projects.map((p) => p.region?.trim()).filter((r): r is string => !!r)),
  ].sort();
  const query = search.trim().toLowerCase();
  const filtered = projects.filter(
    (p) =>
      (!query || [p.name, p.region ?? "", p.slug].some((v) => v.toLowerCase().includes(query))) &&
      (!status || p.status.trim().toLowerCase() === status) &&
      (!region || p.region?.trim() === region),
  );
  const clear = () => {
    setSearch("");
    setStatus("");
    setRegion("");
  };

  return (
    <div className="via-portal">
      <SiteHeader />
      <main>
        <section className="portal-hero" aria-labelledby="portal-title">
          <div
            className="portal-hero-photo"
            style={{ backgroundImage: `url(${hero})` }}
            aria-hidden="true"
          />
          <div className="portal-shell portal-hero-content">
            <p className="portal-kicker">VIA Project Portal</p>
            <h1 id="portal-title">
              Every project.
              <br />
              <span>A clearer perspective.</span>
            </h1>
            <p className="portal-hero-description">
              Connected to your project. Informed at every stage.
              <br />
              Your progress reports and project updates, in one place.
            </p>
            <div className="portal-hero-bottom">
              <a className="portal-cta" href="#project-directory">
                Explore our projects <ArrowDown size={17} aria-hidden="true" />
              </a>
              <p className="portal-hero-note">
                Engineering consultancy
                <br />
                VIA International
              </p>
            </div>
          </div>
        </section>
        <div className="portal-intro-strip">
          <div className="portal-shell portal-intro-inner">
            <span>
              <ShieldCheck size={17} aria-hidden="true" /> A dedicated space for our clients
            </span>
            <span>
              <LockKeyhole size={15} aria-hidden="true" /> Project reports are password-protected
            </span>
          </div>
        </div>
        <section
          id="project-directory"
          className="portal-shell portal-directory"
          aria-labelledby="project-directory-heading"
        >
          <div className="portal-section-heading">
            <div>
              <p className="portal-kicker">OUR PROJECTS</p>
              <h2 id="project-directory-heading">Explore the work. Follow the progress.</h2>
            </div>
            <p>
              Find your project below. Use the password shared by your VIA contact to access its
              dashboard.
            </p>
          </div>
          <div className="portal-filterbar">
            <label>
              Search projects
              <div className="portal-search">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  disabled={!ready}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Project name or location"
                />
              </div>
            </label>
            <label>
              Status
              <select
                aria-label="Status"
                disabled={!ready}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select
                aria-label="Location"
                disabled={!ready}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">All locations</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="portal-result-line">
            <p role="status">
              {filtered.length} of {projects.length} projects
            </p>
            {!!(search || status || region) && (
              <button type="button" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
          {filtered.length ? (
            <div className="portal-project-grid">
              {filtered.map((p, i) => (
                <PortalProjectCard key={p.id} project={p} index={i} />
              ))}
            </div>
          ) : (
            <div className="portal-empty">
              <h3>{projects.length ? "No matching projects" : "No projects available yet"}</h3>
              <p>
                {projects.length
                  ? "Try another name or location, or clear your filters."
                  : "Projects will appear here once they have been added by your VIA team."}
              </p>
            </div>
          )}
        </section>
        <section className="portal-help">
          <div className="portal-shell portal-help-inner">
            <div>
              <h2>Your project. Your dedicated VIA team.</h2>
              <p>Need access to a report? Contact the VIA team managing your project.</p>
            </div>
            <a href="https://www.via-int.com/">
              Visit our company website <ArrowUpRight size={20} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
