import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';

// Express 5 transmet les rejets de promesse ici : pas besoin de try/catch
// dans les handlers async.
// eslint-disable-next-line no-unused-vars -- Express reconnaît ce middleware à ses 4 arguments
export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  res.status(status).json({
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: status >= 500 && isProduction ? 'Erreur interne du serveur' : error.message,
      ...(isProduction ? {} : { stack: error.stack }),
    },
  });
}

/** Erreur avec un status HTTP, renvoyée telle quelle au client. */
export function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
