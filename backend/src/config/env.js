import 'dotenv/config';
import { z } from 'zod';

// Une config invalide fait échouer le démarrage tout de suite, avec un message
// lisible, plutôt qu'au premier appel à la base.
const csv = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Railway injecte PORT ; 3000 en local.
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL est requis')
    .refine(
      (url) => url.startsWith('postgres://') || url.startsWith('postgresql://'),
      'DATABASE_URL doit être une URL PostgreSQL',
    ),

  // Vide en production : front et API sont sur la même origine.
  CORS_ORIGIN: z.string().default('').transform(csv),

  // Laisser vide : résolu sur backend/public.
  CLIENT_DIR: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] Configuration invalide :');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(racine)'} : ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
