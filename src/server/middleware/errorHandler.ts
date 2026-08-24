import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
  const errorStack = err instanceof Error ? err.stack : undefined;

  // Log internal error safely
  logger.error(`[API Error] ${req.method} ${req.originalUrl}: ${errorMessage}`, errorStack);

  // Return sanitized generic response without leaking internal paths or stack traces
  res.status(500).json({
    error: 'An internal server error occurred',
    message: process.env.NODE_ENV === 'test' ? errorMessage : 'Please check system logs or contact support.',
    timestamp: new Date().toISOString(),
  });
}
