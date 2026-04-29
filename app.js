import "dotenv/config";
import Fastify from 'fastify';
import { connectDB } from "./config/connect.js";
import { PORT } from "./config/config.js";
import { admin, buildAdminRouter } from "./config/setup.js";
import { registerRoutes } from "./routes/index.js";
import { initSubscriptionsJobRunner } from './jobs/subscriptions.js';
import websocket from '@fastify/websocket';
import { DomainError } from './common/errors.js';
import { JWT_SECRET } from './config/env.js';

const start = async () => {
  if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set');
    throw new Error('JWT_SECRET environment variable is not set');
  }
  await connectDB(process.env.MONGO_URI);
  const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' } });

  // CORS — allow all origins in dev, restrict in production
  app.addHook('onRequest', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
    done();
  });

 await app.register(websocket)

  await registerRoutes(app);
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");
    if (error instanceof DomainError) {
      return reply.code(error.statusCode).send(error.toRFC7807());
    }
    const status = error.statusCode || 500;
    reply.code(status).send({
      type: 'https://labzy.in/errors/INTERNAL_ERROR',
      title: 'Internal Server Error',
      status,
      detail: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });
  await buildAdminRouter(app);

  initSubscriptionsJobRunner(app);

  app.listen({ port: PORT, host: "0.0.0.0" }, (err, addr) => {
    if (err) {
      app.log.error(err);
    } else {
      app.log.info(`Lab app started on Port: ${PORT}${admin.options.rootPath}`);
    }
  });
 


};
start();