import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const provided = Buffer.from(hash, "hex");
  return provided.length === computed.length && timingSafeEqual(provided, computed);
}

async function issueSession(req: Request, res: Response, openId: string, name = "") {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });

  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

function buildGitHubAuthorizeUrl(req: Request) {
  const callbackUrl = `${req.protocol}://${req.get("host")}/api/oauth/callback`;
  const state = Buffer.from(callbackUrl).toString("base64url");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", ENV.githubClientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

async function handleGithubCallback(req: Request, res: Response) {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    res.status(400).json({ error: "Missing OAuth code/state" });
    return;
  }

  const callbackUrl = Buffer.from(state, "base64url").toString("utf-8");

  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: ENV.githubClientId,
      client_secret: ENV.githubClientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!tokenResp.ok) {
    const details = await tokenResp.text();
    throw new Error(`GitHub token exchange failed: ${details}`);
  }

  const tokenJson = (await tokenResp.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("Missing GitHub access_token");

  const userResp = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "k12-ai-teaching-platform",
    },
  });

  if (!userResp.ok) throw new Error(`GitHub user info failed: ${await userResp.text()}`);
  const ghUser = (await userResp.json()) as { id: number; login?: string; name?: string; email?: string };

  const email = ghUser.email ? normalizeEmail(ghUser.email) : null;
  const openId = `github:${ghUser.id}`;
  const role = email && ENV.adminEmails.includes(email) ? "admin" : undefined;

  await db.upsertUser({
    openId,
    name: ghUser.name ?? ghUser.login ?? null,
    email,
    loginMethod: "github",
    ...(role ? { role } : {}),
    lastSignedIn: new Date(),
  });

  await issueSession(req, res, openId, ghUser.name ?? ghUser.login ?? "");
  res.redirect(302, "/");
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "email and password are required" });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: "password must be at least 8 characters" });
        return;
      }

      const normalizedEmail = normalizeEmail(email);
      const openId = `local:${normalizedEmail}`;
      const existing = await db.getUserByOpenId(openId);
      if (existing) {
        res.status(409).json({ error: "user already exists" });
        return;
      }

      const role = ENV.adminEmails.includes(normalizedEmail) ? "admin" : undefined;
      await db.upsertUser({
        openId,
        email: normalizedEmail,
        name: typeof name === "string" ? name : null,
        loginMethod: "password",
        passwordHash: hashPassword(password),
        ...(role ? { role } : {}),
        lastSignedIn: new Date(),
      });

      await issueSession(req, res, openId, typeof name === "string" ? name : "");
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] register failed", error);
      res.status(500).json({ error: "register failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "email and password are required" });
        return;
      }

      const openId = `local:${normalizeEmail(email)}`;
      const user = await db.getUserByOpenId(openId);
      if (!user || !verifyPassword(password, (user as any).passwordHash)) {
        res.status(401).json({ error: "invalid credentials" });
        return;
      }

      await db.upsertUser({ openId, lastSignedIn: new Date() });
      await issueSession(req, res, openId, user.name ?? "");
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] login failed", error);
      res.status(500).json({ error: "login failed" });
    }
  });

  app.get("/api/auth/login", (req: Request, res: Response) => {
    if (ENV.authProviders.includes("github") && ENV.githubClientId && ENV.githubClientSecret) {
      res.redirect(302, buildGitHubAuthorizeUrl(req));
      return;
    }

    res.status(400).json({
      error: "No OAuth provider configured. Use POST /api/auth/register and POST /api/auth/login for local auth.",
    });
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    if (!(ENV.authProviders.includes("github") && ENV.githubClientId && ENV.githubClientSecret)) {
      res.status(400).json({ error: "GitHub OAuth is not configured" });
      return;
    }

    try {
      await handleGithubCallback(req, res);
    } catch (error) {
      console.error("[OAuth] callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
