import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { registerSocket, unregisterSocket } from '../services/notificationService.js';

export const wsRoutes = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    try {
      const url = new URL(req.url, 'http://x');
      const token = url.searchParams.get('token');
      if (!token) {
        connection.socket.close(1008, 'unauthorized');
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;
      registerSocket(userId, connection.socket);
      connection.socket.on('close', () => unregisterSocket(userId, connection.socket));
    } catch {
      try { connection.socket.close(1008, 'unauthorized'); } catch { /* ignore */ }
    }
  });
};
