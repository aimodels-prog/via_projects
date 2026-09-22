import { createFileRoute, redirect } from "@tanstack/react-router";
import { ReportUploadWorkflow } from "@/components/ReportUploadWorkflow";
import { getAdminAccess } from "@/lib/project-access.functions";

export const Route = createFileRoute("/upload")({
  loader: async () => {
    const access = await getAdminAccess();
    if (!access.authorized) throw redirect({ to: "/admin-login" });
    return {};
  },
  head: () => ({
    meta: [
      { title: "Upload Project Report · VIA International" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReportUploadWorkflow,
});
