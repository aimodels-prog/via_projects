import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const portalMiddleware = createMiddleware().server(async ({ request, next }) => {
  const { handlePortalRequest } = await import("./lib/portal-sso.server");
  return (await handlePortalRequest(request)) ?? next();
});

export const startInstance = createStart(() => ({
  // Internal/client authentication is enforced by signed, HttpOnly server cookies.
  // Do not initialise a Supabase browser session on the standalone PostgreSQL deployment.
  requestMiddleware: [errorMiddleware, csrfMiddleware, portalMiddleware],
}));
