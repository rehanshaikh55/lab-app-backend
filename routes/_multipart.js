import multipart from '@fastify/multipart';

// Registered per route plugin (encapsulated) rather than on the root app: AdminJS
// registers @fastify/multipart on the root instance, and a second root registration
// throws "decorator 'multipartErrors' has already been added".
export const registerMultipart = (fastify) =>
  fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
