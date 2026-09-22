import { createFileRoute } from "@tanstack/react-router";
import { ProjectDirectory } from "@/components/ProjectDirectory";
import { portalProjectsQuery } from "@/lib/portal-projects";

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(portalProjectsQuery);
  },
  head: () => ({
    meta: [
      { title: "VIA International — Project Portal" },
      {
        name: "description",
        content:
          "Access VIA International project dashboards and monthly progress reports in one place.",
      },
      { property: "og:title", content: "VIA International — Project Portal" },
      {
        property: "og:description",
        content:
          "Access VIA International project dashboards and monthly progress reports in one place.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: ProjectDirectory,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-12 text-sm text-signal-alert">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-12">Nothing here.</div>,
});
