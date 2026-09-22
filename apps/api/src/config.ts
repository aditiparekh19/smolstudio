import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),

  DATABASE_HOST: z.string().default("localhost"),
  DATABASE_PORT: z.coerce.number().int().default(1433),
  DATABASE_NAME: z.string().default("smolstudio"),
  DATABASE_USER: z.string().default("sa"),
  DATABASE_PASSWORD: z.string().min(8).default("SmolStudioDev2026_Xy9"),

  DATABASE_ENCRYPT: z.coerce.boolean().default(false),
  DATABASE_TRUST_SERVER_CERT: z.coerce.boolean().default(true),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  GST_RATE_PERCENT: z.coerce.number().min(0).max(100).default(0),
  SHIPPING_FLAT_INR: z.coerce.number().min(0).default(0),
  FREE_SHIPPING_THRESHOLD_INR: z.coerce.number().min(0).default(0),
  PAYMENT_RESERVATION_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(120)
    .default(15),

  RETURN_FEE_INR: z.coerce.number().min(0).default(100),
  RETURN_FEE_THRESHOLD: z.coerce.number().int().min(0).default(2),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
  STORE_SUPPORT_EMAIL: z.string().email().default("support@smolstudio.local"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("SmolStudio <onboarding@resend.dev>"),
  PUBLIC_WEB_URL: z.string().default("http://localhost:3000"),
  SHIPROCKET_EMAIL: z.string().default(""),
  SHIPROCKET_PASSWORD: z.string().default(""),
});

export const env = envSchema.parse(process.env);
