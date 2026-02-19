export const ENV = {
  isProduction: process.env.NODE_ENV === "production",

  // Security / session
  jwtSecret: process.env.JWT_SECRET ?? "default-unsafe-secret-for-dev",
  cookieSecret: process.env.JWT_SECRET ?? "default-unsafe-secret-for-dev",

  // Database
  databaseUrl: process.env.DATABASE_URL ?? "",

  // LLM configuration
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai",
  llmModel: process.env.LLM_MODEL ?? "gemini-2.5-flash",
  // Compatibility for modules still using legacy proxy naming
  forgeApiUrl: process.env.FORGE_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // S3-compatible storage (AWS S3 / Cloudflare R2 / MinIO)
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  s3Bucket: process.env.AWS_S3_BUCKET ?? "",
  s3Region: process.env.AWS_REGION ?? "auto",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",

  // Auth configuration
  authProviders: (process.env.AUTH_PROVIDERS ?? "local,github")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean),
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",

  // Optional bootstrap admin list (comma-separated emails)
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean),
};
