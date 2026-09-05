/** Typed accessors over process.env with sane dev defaults. */

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'eduvisa',
    password: process.env.DB_PASSWORD ?? 'eduvisa',
    name: process.env.DB_NAME ?? 'eduvisa',
    synchronize: process.env.DB_SYNC === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
  },

  piiEncKey: process.env.PII_ENC_KEY ?? '0'.repeat(64),

  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.S3_PORT ?? '9000', 10),
    useSSL: process.env.S3_USE_SSL === 'true',
    accessKey: process.env.S3_ACCESS_KEY ?? 'eduvisa',
    secretKey: process.env.S3_SECRET_KEY ?? 'eduvisa-secret',
    bucket: process.env.S3_BUCKET ?? 'eduvisa-docs',
  },

  engineVersion: process.env.ENGINE_VERSION ?? 'v1.0.0',

  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  openRouterChatModel: process.env.OPENROUTER_CHAT_MODEL ?? 'google/gemma-4-26b-a4b-it',
  openRouterChatModelFallback: process.env.OPENROUTER_CHAT_MODEL_FALLBACK ?? 'google/gemma-4-26b-a4b-it:free',
  // Cheap/fast model for the orchestrator's routing decision (which KB topics,
  // whether the question names courses/universities) — a classification task,
  // not the final answer, so a small model is the right tool, not the 26B one.
  openRouterRouterModel: process.env.OPENROUTER_ROUTER_MODEL ?? 'google/gemma-3-4b-it',
  openRouterEmbedModel: process.env.OPENROUTER_EMBED_MODEL ?? 'openai/text-embedding-3-small',
  openRouterMinBalanceUsd: parseFloat(process.env.OPENROUTER_MIN_BALANCE_USD ?? '0.5'),

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
    authLimit: parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '10', 10),
  },
  activeCountries: (process.env.ACTIVE_COUNTRIES ?? 'AU')
    .split(',')
    .map((s) => s.trim()),
};

export type Env = typeof env;
