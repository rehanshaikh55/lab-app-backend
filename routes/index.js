import { authRoutes } from "./authRoutes.js";
import { profileRoutes } from "./profileRoutes.js";
import { partnerRoutes } from "./partnerRoutes.js";
import { reportRoutes } from "./reportRoutes.js";
import { bookingRoutes } from "./bookingRoutes.js";
import { labRoutes } from "./labRoutes.js";
import { subscriptionRoutes } from "./subscriptionRoutes.js";

const prefix = "/api";
export const registerRoutes = async (fastify) => {
  fastify.register(authRoutes, { prefix });
  fastify.register(profileRoutes, { prefix });
  fastify.register(partnerRoutes, { prefix });
  fastify.register(reportRoutes, { prefix });
  fastify.register(bookingRoutes, { prefix });
  fastify.register(labRoutes, { prefix });
  fastify.register(subscriptionRoutes, { prefix });
};