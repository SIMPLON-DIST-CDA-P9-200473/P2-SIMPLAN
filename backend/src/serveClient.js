import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';

/**
 * Sert le build Vite (déposé dans backend/public par frontend/vite.config.js).
 * En dev ce dossier n'existe pas : rien n'est monté et Express reste une API pure,
 * le front étant servi par Vite.
 */
export function serveClient(app) {
  const clientDir = env.CLIENT_DIR
    ? path.resolve(env.CLIENT_DIR)
    : path.resolve(import.meta.dirname, '../public');

  if (!fs.existsSync(path.join(clientDir, 'index.html'))) {
    console.warn(`[client] aucun build dans ${clientDir} - mode API seule`);
    return false;
  }

  // Les fichiers de /assets ont un hash dans leur nom : cache illimité.
  app.use(
    '/assets',
    express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }),
  );

  // index: false pour que "/" passe par le fallback ci-dessous.
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));

  // Fallback SPA : toute URL inconnue renvoie index.html, React Router prend le relais.
  // Express 5 impose un wildcard nommé ; les accolades incluent "/".
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  console.log(`[client] build servi depuis ${clientDir}`);
  return true;
}
