// routes/auth.js
import express from 'express';
import { verifyFirebaseToken,revokeTokens} from '../middlewares/firebaseAuth.js';
import { register, login, forgotPassword, resetPassword,firebaseLogin } from '../controllers/authController.js';

 
export const authRoutes = async (fastify,options) => {
  fastify.post('/auth/register', register);
  fastify.post('/auth/login', login);
  fastify.post('/auth/forgot-password', forgotPassword);
  fastify.post('/auth/reset-password/:token', resetPassword);
   fastify.post('/auth/verify', verifyFirebaseToken);

fastify.post(
    '/auth/revoke',
    { preHandler: [verifyFirebaseToken] },
    revokeTokens
  );
}



