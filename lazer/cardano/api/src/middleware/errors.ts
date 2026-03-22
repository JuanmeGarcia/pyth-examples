import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler so thrown errors are forwarded to Express
 * error handling instead of crashing the process.
 */
export function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Global error handler — returns a structured JSON error.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("[error]", err.message);
  const status = (err as Error & { status?: number }).status ?? 500;
  res.status(status).json({ error: err.message });
}
