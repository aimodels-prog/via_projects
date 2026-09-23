import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminAccess } from "@/lib/project-access.functions";
import viaLogo from "@/assets/via-official-logo.png";

export function SiteHeader() {
  const staffAccess = useQuery({
    queryKey: ["staff-navigation-access"],
    queryFn: () => getAdminAccess(),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <Link to="/" className="shrink-0">
          <img
            src={viaLogo}
            alt="VIA International"
            width={2048}
            height={766}
            className="h-auto w-28 object-contain md:w-32"
          />
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium sm:gap-x-6"
        >
          <Link
            to="/"
            className="flex min-h-11 items-center text-brand hover:underline"
            activeProps={{ className: "font-semibold underline underline-offset-4" }}
          >
            Projects
          </Link>
          <a
            href="https://via-int.com"
            className="flex min-h-11 items-center text-muted-foreground hover:text-brand hover:underline"
          >
            Company website
          </a>
          {!staffAccess.isError && staffAccess.data?.authorized === true && (
            <Link
              to="/admin-projects"
              className="flex min-h-11 items-center rounded-md border border-brand/25 px-3 text-brand hover:bg-brand/5"
            >
              Back to administration
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
