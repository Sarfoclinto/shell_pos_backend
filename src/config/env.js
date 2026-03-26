import "dotenv/config";

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  API_VERSION: process.env.API_VERSION || "v1",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",

  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME || "pos_db",
    user: process.env.DB_USER || "postgres",
    password: requireEnv("DB_PASSWORD"),
    poolMin: parseInt(process.env.DB_POOL_MIN || "2", 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || "10", 10),
    ssl: process.env.DB_SSL === "true",
  },

  jwt: {
    secret: requireEnv("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  cors: {
    allowedOrigins: (
      process.env.ALLOWED_ORIGINS || "http://localhost:3000"
    ).split(","),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || "debug",
    dir: process.env.LOG_DIR || "logs",
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || "",
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || "",
    baseUrl: "https://api.paystack.co",
  },
};
