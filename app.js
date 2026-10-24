import "dotenv/config";
import Fastify from 'fastify';
import mongoose from 'mongoose';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { connectDB } from "./config/connect.js";
import { PORT, NODE_ENV, FRONTEND_URL } from "./config/env.js";
import { assertRequiredEnv } from "./config/env.js";
import { admin, buildAdminRouter } from "./config/setup.js";
import { registerRoutes } from "./routes/index.js";
import { initScheduler } from "./scheduler/index.js";
import { DomainError } from "./common/errors.js";

export const buildApp = async ({ withAdmin = true } = {}) => {
  const app = Fastify({
    logger: { level: NODE_ENV === 'production' ? 'info' : 'debug' },
  });

  await app.register(cors, {
    origin: NODE_ENV === 'production' ? FRONTEND_URL : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.register(websocket);

  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  }));

  await registerRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send(error.toRFC7807());
    }
    if (error.validation) {
      return reply.code(400).send({
        type: 'https://labzy.in/errors/VALIDATION_ERROR',
        title: 'Validation Error',
        status: 400,
        detail: error.message,
      });
    }
    const status = error.statusCode || 500;
    reply.code(status).send({
      type: 'https://labzy.in/errors/INTERNAL_ERROR',
      title: 'Internal Server Error',
      status,
      detail: NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });

  if (withAdmin) {
    await buildAdminRouter(app);
  }

  return app;
};

export const start = async () => {
  assertRequiredEnv();
  await connectDB(process.env.MONGO_URI);
  const app = await buildApp();
  initScheduler(app);
  app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    } else {
      app.log.info(`Lab app started on Port: ${PORT}${admin.options.rootPath}`);
    }
  });
};

// Run only when executed directly (not when imported by tests)
if (process.argv[1] && process.argv[1].endsWith('app.js')) {
  start();
}
