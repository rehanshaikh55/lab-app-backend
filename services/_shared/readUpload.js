import { Errors } from '../../common/errors.js';

// Streams a @fastify/multipart file into a Buffer, enforcing maxBytes.
export const readUploadBuffer = async (fileData, maxBytes) => {
  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of fileData.file) {
      total += chunk.length;
      if (total > maxBytes) throw Errors.FILE_TOO_LARGE();
      chunks.push(chunk);
    }
  } catch (err) {
    if (err?.code === 'FST_REQ_FILE_TOO_LARGE') throw Errors.FILE_TOO_LARGE();
    throw err;
  }
  if (fileData.file.truncated) throw Errors.FILE_TOO_LARGE();
  return Buffer.concat(chunks);
};
