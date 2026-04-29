import "dotenv/config";
import Fastify from "fastify";
import { connectDB } from "../config/connect.js";
import { registerRoutes } from "../routes/index.js";
import { DomainError } from "../common/errors.js";
import { JWT_SECRET } from "../config/env.js";

let appPromise;

const buildApp = async () => {
  if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set");
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI environment variable is not set");

  await connectDB(process.env.MONGO_URI);

  const app = Fastify({
    logger: { level: process.env.NODE_ENV === "production" ? "info" : "debug" },
  });

  app.addHook("onRequest", (request, reply, done) => {
    reply.header(
      "Access-Control-Allow-Origin",
      process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL || "*" : "*"
    );
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (request.method === "OPTIONS") return reply.code(204).send();
    done();
  });

  await registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send(error.toRFC7807());
    }
    const status = error.statusCode || 500;
    reply.code(status).send({
      type: "https://labzy.in/errors/INTERNAL_ERROR",
      title: "Internal Server Error",
      status,
      detail:
        process.env.NODE_ENV === "production" ? "An unexpected error occurred" : error.message,
    });
  });

  await app.ready();
  return app;
};

const getApp = () => {
  if (!appPromise) {
    appPromise = buildApp().catch((err) => {
      appPromise = undefined;
      throw err;
    });
  }
  return appPromise;
};

export default async function handler(req, res) {
  try {
    const app = await getApp();
    app.server.emit("request", req, res);
  } catch (err) {
    console.error("Vercel handler bootstrap failed:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        type: "https://labzy.in/errors/BOOTSTRAP_ERROR",
        title: "Server bootstrap failed",
        status: 500,
        detail: err?.message || "Unknown error",
      })
    );
  }
}
