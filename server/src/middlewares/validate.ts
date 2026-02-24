// ─────────────────────────────────────────────
// src/middlewares/validate.ts
// express-validator error handler middleware
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Run after express-validator chains.
 * Returns 422 with error details if validation fails.
 */
export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }
  next();
}
