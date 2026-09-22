import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_SECONDS = 12 * 60 * 60;
export function equalSecrets(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function sessionSecret() {
  const secret = process.env["PROJECT_ACCESS_SECRET"];
  if (secret && secret.length >= 32) return secret;
  if (process.env["NODE_ENV"] !== "production")
    return secret || "development-only-change-before-deploy";
  throw new Error("PROJECT_ACCESS_SECRET must contain at least 32 characters.");
}
export function credentialVersion(credential: string) {
  return createHmac("sha256", sessionSecret()).update(`credential:${credential}`).digest("hex");
}
export function issueToken(audience: string, version: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ audience, version, expires: now + SESSION_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", sessionSecret()).update(payload).digest("base64url")}`;
}
export function verifyToken(
  token: string | undefined,
  audience: string,
  version: string,
  now = Date.now(),
) {
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (!equalSecrets(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      data.audience === audience &&
      data.version === version &&
      Number.isFinite(data.expires) &&
      data.expires > now &&
      data.expires <= now + SESSION_SECONDS * 1000
    );
  } catch {
    return false;
  }
}
