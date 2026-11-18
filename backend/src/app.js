import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProduction } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { apiRouter } from './routes/index.js';
import { serveClient } from './serveClient.js';

export const app = express();

// Railway termine TLS en amont : sans ça, req.protocol et req.ip sont faux.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// CSP par défaut de helmet. Pour charger des images ou scripts d'un domaine tiers,
// surcharger la directive concernée (ex. contentSecurityPolicy.directives['img-src']).
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Monté seulement si CORS_ORIGIN est renseigné (vide en production).
if (env.CORS_ORIGIN.length > 0) {
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
}

// L'ordre compte.
app.use('/api', apiRouter); // 1. API
app.use('/api', notFound); // 2. 404 JSON, avant le fallback SPA
serveClient(app); // 3. build du front + fallback index.html
app.use(errorHandler); // 4. erreurs, en dernier
