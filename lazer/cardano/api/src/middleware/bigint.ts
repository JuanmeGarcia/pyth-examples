import type { Request, Response, NextFunction } from "express";

/**
 * Express doesn't serialize BigInt natively. This middleware patches
 * res.json() so any BigInt values become strings before serialisation.
 */
export function bigintSerializer(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    return originalJson(
      JSON.parse(
        JSON.stringify(body, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ),
    );
  };

  next();
}
