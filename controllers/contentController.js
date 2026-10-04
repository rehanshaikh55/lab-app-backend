import * as contentService from '../services/contentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getContent = asyncHandler(async (req, reply) => {
  reply.header('Cache-Control', 'public, max-age=300');
  return reply.code(200).send(await contentService.getContent(req.params.key));
});

export const setContent = asyncHandler(async (req, reply) =>
  reply.code(200).send(await contentService.setContent({
    key: req.params.key,
    payload: req.body.payload,
  })));
