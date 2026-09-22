import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  getProjectAccess,
  getProtectedDashboardHtml,
  getProjectReportHistory,
  getProtectedReportDetails,
} from "@/lib/project-access.functions";
import { ReportDetails } from "@/components/ReportDetails";
import { useEffect, useState } from "react";
import { getProject } from "@/lib/projects.functions";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { ProjectPasswordGate } from "@/components/ProjectPasswordGate";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    const [project, access] = await Promise.all([
      getProject({ data: { slug: params.slug } }),
      getProjectAccess({ data: { slug: params.slug } }),
    ]);
    if (!project) throw notFound();
    const dashboardHtml = access.authorized
      ? await getProtectedDashboardHtml({ data: { slug: params.slug } })
      : null;
    const history = access.authorized
      ? await getProjectReportHistory({ data: { slug: params.slug } })
      : [];
    const details = access.authorized
      ? await getProtectedReportDetails({ data: { slug: params.slug } })
      : { details: [], attachments: [] };
    return { project, authorized: access.authorized, dashboardHtml, history, details };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.project.name} · Client Dashboard` : "Project unavailable",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { project, authorized, dashboardHtml, history, details } = Route.useLoaderData();
  const [extra, setExtra] = useState(details);
  const [html, setHtml] = useState(dashboardHtml);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setHtml(dashboardHtml);
    setExtra(details);
  }, [dashboardHtml, details]);
  if (authorized && dashboardHtml) {
    return (
      <div>
        {history.length > 1 && (
          <div className="flex items-center gap-3 bg-white p-2 text-sm">
            <label>
              Report history{" "}
              <select
                disabled={loading}
                defaultValue=""
                onChange={async (e) => {
                  const revision = e.target.value;
                  setLoading(true);
                  setError("");
                  try {
                    const data = { slug: project.slug, ...(revision ? { revision } : {}) };
                    const [html, extra] = await Promise.all([
                      getProtectedDashboardHtml({ data }),
                      getProtectedReportDetails({ data }),
                    ]);
                    setHtml(html);
                    setExtra(extra);
                  } catch (error) {
                    setError(error instanceof Error ? error.message : "Unable to load report.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <option value="">Latest approved report</option>
                {history.map((item) => (
                  <option key={item.revision} value={item.revision}>
                    {item.period} — approved {item.approvedAt}
                  </option>
                ))}
              </select>
            </label>
            {error && <span role="alert">{error}</span>}
          </div>
        )}
        <ReportDetails details={extra.details} attachments={extra.attachments} />
        <iframe
          srcDoc={html ?? ""}
          title={`${project.name} dashboard`}
          className="block h-screen w-full border-0 bg-black"
          sandbox="allow-scripts"
        />
      </div>
    );
  }
  return authorized ? (
    <main className="p-10">
      <h1>{project.name}</h1>
      <p>No approved dashboard has been published yet.</p>
    </main>
  ) : (
    <ProjectPasswordGate slug={project.slug} projectName={project.name} />
  );
}
