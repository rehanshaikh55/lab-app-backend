import AdminJS from "adminjs";
import { FastifyInstance } from "fastify";
import { AuthenticationOptions } from "../types.js";
export declare const withRefresh: (fastifyApp: FastifyInstance, admin: AdminJS, auth: AuthenticationOptions) => void;
