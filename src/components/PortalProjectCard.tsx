import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, LockKeyhole } from "lucide-react";
import { StatusSignal } from "./StatusSignal";
import type { ProjectRow } from "@/lib/projects.functions";

export function PortalProjectCard({ project, index = 0 }: { project: ProjectRow; index?: number }) {
  return (
    <article className="portal-project-card">
      <div className="portal-card-top">
        <span className="portal-project-number">{String(index + 1).padStart(2, "0")}</span>
        <StatusSignal status={project.status} />
      </div>
      <div className="portal-card-body">
        <p className="portal-kicker">VIA INTERNATIONAL / PROJECT</p>
        <h3>{project.name}</h3>
        <p className="portal-location">
          <MapPin size={15} aria-hidden="true" />
          {project.region?.trim() || "Location not provided"}
        </p>
      </div>
      <Link
        to="/$slug"
        params={{ slug: project.slug }}
        aria-label={`View project: ${project.name}`}
        className="portal-card-link"
      >
        <span>
          View project <LockKeyhole size={13} aria-hidden="true" />
        </span>
        <span className="portal-arrow">
          <ArrowUpRight size={22} aria-hidden="true" />
        </span>
      </Link>
    </article>
  );
}
