/**
 * Wraps an async Fastify route handler with try/catch.
 * Passes unexpected errors to Fastify's global error handler.
 */
export const asyncHandler = (fn) => async (request, reply) => {
  try {
    return await fn(request, reply);
  } catch (err) {
    request.log.error({ err }, `Unhandled error in ${fn.name || 'handler'}`);
    throw err; // re-throw so Fastify's setErrorHandler picks it up
  }
};
