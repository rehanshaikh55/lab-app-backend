import { authRoutes } from "./authRoutes.js";
import { profileRoutes } from "./profileRoutes.js";
import { partnerRoutes } from "./partnerRoutes.js";
import { reportRoutes } from "./reportRoutes.js";
import { bookingRoutes } from "./bookingRoutes.js";
import { assistantRoutes } from "./assistantRoutes.js";
import { labRoutes } from "./labRoutes.js";
import { subscriptionRoutes } from "./subscriptionRoutes.js";
import { notificationRoutes } from "./notificationRoutes.js";
import { packageRoutes } from "./packageRoutes.js";
import { paymentRoutes } from "./paymentRoutes.js";
import { contentRoutes } from "./contentRoutes.js";
import { ticketRoutes } from "./ticketRoutes.js";
import { wsRoutes } from "./wsRoutes.js";

const prefix = "/api";

export const registerRoutes = async (fastify) => {
  fastify.register(authRoutes,         { prefix });
  fastify.register(profileRoutes,      { prefix });
  fastify.register(partnerRoutes,      { prefix });
  fastify.register(reportRoutes,       { prefix });
  fastify.register(bookingRoutes,      { prefix });
  fastify.register(assistantRoutes,    { prefix });
  fastify.register(labRoutes,          { prefix });
  fastify.register(subscriptionRoutes, { prefix });
  fastify.register(notificationRoutes, { prefix });
  fastify.register(packageRoutes,      { prefix });
  fastify.register(paymentRoutes,      { prefix });
  fastify.register(contentRoutes,      { prefix });
  fastify.register(ticketRoutes,       { prefix });
  // wsRoutes intentionally registered at the root (no /api prefix)
  fastify.register(wsRoutes);
};
