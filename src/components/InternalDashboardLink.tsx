import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getInternalAccess } from "@/lib/internal.functions";

export function InternalDashboardLink() {
  const access = useQuery({
    queryKey: ["internal-access"],
    queryFn: () => getInternalAccess(),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  return !access.isError && access.data?.authorized ? (
    <Link to="/internal" className="text-sm font-semibold text-brand hover:underline">
      Internal dashboard
    </Link>
  ) : null;
}
