import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    reply.code(400).send({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.issues,
    });
    return;
  }

  // Known application errors with a status code
  if (error.statusCode) {
    reply.code(error.statusCode).send({
      code: error.code ?? 'APPLICATION_ERROR',
      message: error.message,
    });
    return;
  }

  // Unknown errors — log and return a generic 500
  logger.error({ err: error, reqId: request.id }, 'Unhandled error');
  reply.code(500).send({
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred',
  });
}
