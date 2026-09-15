import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { Readable } from "node:stream";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { createYoga } from "graphql-yoga";
import { env } from "./config.js";
import { processRazorpayWebhook, schema } from "./graphql/schema.js";
import { releaseExpiredReservations } from "./orders/service.js";
import { closeDb } from "./db.js";
import { getAnonymousCartToken, getAuthUser } from "./auth/service.js";
import type { GraphQLContext } from "./graphql/schema.js";

export function buildApp() {
  const app = Fastify({
    bodyLimit: 12 * 1024 * 1024,
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });

  app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  });

  app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((x) => x.trim()),
    credentials: true,
  });

  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  // Preserve the exact Razorpay webhook payload for HMAC verification.
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url !== "/webhooks/razorpay") return payload;
    const chunks: Buffer[] = [];
    for await (const chunk of payload as any) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    (request as any).rawBody = raw;
    return Readable.from(raw);
  });

  app.post("/webhooks/razorpay", async (request, reply) => {
    try {
      const rawBody = (request as any).rawBody as Buffer;
      const signature = String(request.headers["x-razorpay-signature"] ?? "");
      const eventId = request.headers["x-razorpay-event-id"]?.toString();
      const payload = JSON.parse(rawBody.toString("utf8"));
      await processRazorpayWebhook(rawBody, signature, eventId, payload);
      return reply.code(200).send({ ok: true });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : "Webhook failed" });
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "smolstudio-api" }));
  app.get("/media/products/*", async (req, reply) => {
    const wildcard = (req.params as { "*": string })["*"] || "";
    const root = join(process.cwd(), "uploads", "products");
    const file = normalize(join(root, wildcard));
    if (!file.startsWith(root))
      return reply.code(400).send({ error: "Invalid path" });
    try {
      const data = await readFile(file);
      const ext = file.toLowerCase().split(".").pop();
      const contentType =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/gif";
      return reply
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .type(contentType)
        .send(data);
    } catch {
      return reply.code(404).send({ error: "Media not found" });
    }
  });

  app.get("/ready", async (_req, reply) => {
    try {
      const { getDb } = await import("./db.js");
      await (await getDb()).request().query("SELECT 1 AS ok");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });

  const yoga = createYoga<GraphQLContext>({
    schema,
    graphqlEndpoint: "/graphql",
    logging: {
      debug: (...args) => args.forEach((arg) => app.log.debug(arg)),
      info: (...args) => args.forEach((arg) => app.log.info(arg)),
      warn: (...args) => args.forEach((arg) => app.log.warn(arg)),
      error: (...args) => args.forEach((arg) => app.log.error(arg)),
    },
  });

  app.route({
    url: yoga.graphqlEndpoint,
    method: ["GET", "POST", "OPTIONS"],
    handler: async (req, reply) =>
      yoga.handleNodeRequestAndResponse(req, reply, {
        request: req,
        reply,
        user: await getAuthUser(req),
        anonymousToken: getAnonymousCartToken(req),
      }),
  });

  app.addHook("onClose", async () => {
    await closeDb();
  });

  return app;
}

const app = buildApp();

const reservationCleanup = setInterval(() => { void releaseExpiredReservations().catch((error) => app.log.error(error)); }, 5 * 60 * 1000);
reservationCleanup.unref?.();

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`API listening on ${env.API_PORT}`))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
