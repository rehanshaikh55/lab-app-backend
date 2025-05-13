import AdminJS from 'adminjs';
import { FastifyInstance } from 'fastify';
import { AuthenticationOptions } from '../types.js';
export declare const withLogin: (fastifyInstance: FastifyInstance, admin: AdminJS, auth: AuthenticationOptions) => void;
