import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/httpErrors.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // If headers already sent, delegate to default express error handler
  if (res.headersSent) {
    return _next(err);
  }

  // Handle custom HttpError
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      code: err.code,
    });
    return;
  }

  // Handle Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    const detailMsg = formattedErrors
      .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
      .join('; ');

    res.status(400).json({
      success: false,
      message: detailMsg || 'Validation failed',
      errors: formattedErrors,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // Handle Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(', ') : 'field';
      res.status(409).json({
        success: false,
        message: `Unique constraint violated. Record with this ${target} already exists.`,
        code: 'DUPLICATE_ENTRY',
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'The requested record does not exist or has been deleted.',
        code: 'RECORD_NOT_FOUND',
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: 'Database operation failed',
      code: err.code,
      meta: env.NODE_ENV === 'development' ? err.meta : undefined,
    });
    return;
  }

  // Handle SyntaxError (like malformed JSON payload)
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request',
      code: 'INVALID_JSON',
    });
    return;
  }

  // Fallback 500 Internal Server Error
  console.error('[UNHANDLED_ERROR]', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
