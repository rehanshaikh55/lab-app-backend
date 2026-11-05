import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { registerSocket, unregisterSocket } from '../services/notificationService.js';

export const wsRoutes = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    try {
      const url = new URL(req.url, 'http://x');
      const token = url.searchParams.get('token');
      if (!token) {
        socket.close(1008, 'unauthorized');
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;
      registerSocket(userId, socket);
      socket.on('close', () => unregisterSocket(userId, socket));
    } catch {
      try { socket.close(1008, 'unauthorized'); } catch { /* ignore */ }
    }
  });
};
