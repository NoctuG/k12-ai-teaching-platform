export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Self-hosted login endpoint (server may redirect to configured OAuth provider).
export const getLoginUrl = () => "/api/auth/login";
