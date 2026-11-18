import { Router } from 'express';
import { notesRouter } from '../modules/notes/notes.routes.js';

export const apiRouter = Router();

// Healthcheck appelé par Railway après chaque déploiement. Sans accès à la base :
// un souci passager de Postgres ne doit pas faire échouer le déploiement d'un code sain.
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use('/notes', notesRouter);
