import { Link } from "@tanstack/react-router";
import viaLogo from "@/assets/via-official-logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand/40 bg-card px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 md:flex-row md:items-end md:justify-between">
        <div>
          <Link to="/" className="inline-block">
            <img
              src={viaLogo}
              alt="VIA International"
              width={2048}
              height={766}
              className="h-auto w-44 max-w-full object-contain"
            />
          </Link>
          <p className="mt-5 max-w-xs text-xs leading-relaxed text-muted-foreground">
            &copy; {new Date().getFullYear()} VIA International. All rights reserved.
          </p>
        </div>
        <div className="flex flex-wrap gap-10 text-sm text-brand">
          <div className="flex flex-col gap-2">
            <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Project portal
            </span>
            <Link to="/projects" className="hover:underline">
              View projects
            </Link>
            <Link to="/admin-login" className="hover:underline">
              Staff sign in
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Company
            </span>
            <span>VIA International</span>
            <a href="https://via-int.com" className="hover:underline">
              Company website
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
