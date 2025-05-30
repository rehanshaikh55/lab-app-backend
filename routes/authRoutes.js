// routes/auth.js
import express from 'express';
import { register, login, forgotPassword, resetPassword } from '../controllers/authController.js';

 
export const authRoutes = async (fastify,options) => {
  fastify.post('/auth/register', register);
  fastify.post('/auth/login', login);
  fastify.post('/auth/forgot-password', forgotPassword);
  fastify.post('/auth/reset-password/:token', resetPassword);
}



