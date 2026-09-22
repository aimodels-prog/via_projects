import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$slug", params: { slug: params.slug }, replace: true });
  },
});
