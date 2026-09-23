import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAdminAccess } from "@/lib/project-access.functions";
import { InternalDashboard } from "@/components/InternalDashboard";

export const Route = createFileRoute("/internal")({
  loader: async () => {
    if (!(await getAdminAccess()).authorized) throw redirect({ to: "/admin-login" });
  },
  head: () => ({
    meta: [
      { title: "Internal dashboard · VIA International" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InternalDashboard,
});
