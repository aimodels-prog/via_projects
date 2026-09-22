import { createFileRoute } from "@tanstack/react-router";
import { ProjectDirectory } from "@/components/ProjectDirectory";
import { portalProjectsQuery } from "@/lib/portal-projects";

export const Route = createFileRoute("/projects/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(portalProjectsQuery),
  head: () => ({ meta: [{ title: "Projects — VIA International" }] }),
  component: ProjectDirectory,
});
