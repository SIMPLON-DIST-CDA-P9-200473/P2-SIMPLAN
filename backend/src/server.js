import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

// 0.0.0.0 obligatoire sur Railway : écouter sur localhost donne
// "Application failed to respond".
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[api] http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Railway envoie SIGTERM avant de remplacer un conteneur.
async function shutdown(signal) {
  console.log(`[api] ${signal} reçu, arrêt...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[api] arrêt forcé après 10s');
    process.exit(1);
  }, 10_000).unref();
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => shutdown(signal));
}
