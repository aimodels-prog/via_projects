import { queryOptions } from "@tanstack/react-query";
import { listProjects } from "./projects.functions";

export const portalProjectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: () => listProjects(),
});
