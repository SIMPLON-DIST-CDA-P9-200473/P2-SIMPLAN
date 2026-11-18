# template-fullstack-railway

Base de départ pour une app fullstack déployée sur Railway en **un seul service** : Express sert l'API sous `/api` et le build React pour tout le reste.

## Stack

| Couche   | Stack                                                                |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, TanStack Query, Axios |
| Backend  | Node 24, Express 5, Prisma 6, zod, helmet, compression, cors, morgan |
| Base     | PostgreSQL 18 (Docker en local, service Railway en prod)             |

Monorepo en workspaces npm : `backend/` et `frontend/`.

## Démarrer

Prérequis : Node 22.12+ et Docker.

```bash
npm install
cp backend/.env.example backend/.env
npm run db:up        # lance PostgreSQL
npm run db:migrate   # applique les migrations
npm run db:seed      # données d'exemple
npm run dev          # Express :3000 + Vite :5173
```

Le site est sur http://localhost:5173. Vite renvoie `/api` vers Express grâce à un proxy.

Si le port 5433 est déjà pris (par un autre projet par exemple), créer un `.env` à la racine avec `DB_PORT=5434` (lu par docker compose) et mettre le même port dans `DATABASE_URL`.

Pour tester le mode production en local (comme sur Railway) :

```bash
npm run build
NODE_ENV=production CORS_ORIGIN= npm start   # http://localhost:3000
```

## Scripts

| Commande                    | Rôle                                                     |
| --------------------------- | -------------------------------------------------------- |
| `npm run dev`               | Express + Vite en parallèle                              |
| `npm run build`             | `prisma generate` + build du front dans `backend/public` |
| `npm start`                 | serveur de prod (API + front)                            |
| `npm run db:up` / `db:down` | démarre / arrête PostgreSQL                              |
| `npm run db:nuke`           | supprime le volume et repart d'une base vide             |
| `npm run db:migrate`        | `prisma migrate dev` (crée et applique une migration)    |
| `npm run db:reset`          | vide la base, rejoue les migrations et le seed           |
| `npm run db:deploy`         | `prisma migrate deploy` (prod)                           |
| `npm run db:seed`           | insère les données d'exemple                             |
| `npm run db:studio`         | ouvre Prisma Studio                                      |
| `npm run format`            | formate tout le projet avec Prettier                     |
| `npm run format:check`      | vérifie le formatage sans rien modifier                  |
| `npm run lint` / `lint:fix` | ESLint : repère (et corrige si possible) les erreurs     |

### Formatage

Tout le monde partage les mêmes règles : **Prettier** s'occupe de la mise en forme (`.prettierrc.json` : guillemets simples, points-virgules, 100 colonnes), **ESLint** des erreurs de code (`eslint.config.js`). Une seule config à la racine pour le backend et le frontend.

Dans VS Code, installer les extensions recommandées (Prettier, ESLint, EditorConfig ; VS Code les propose à l'ouverture du projet) : le fichier est formaté à chaque sauvegarde (`.vscode/settings.json`). Avec un autre éditeur, lancer `npm run format` avant de commiter.

## Structure

```
backend/
  prisma/              schéma, migrations, seed
  public/              build du front (généré, non versionné)
  src/
    app.js             middlewares et ordre de montage
    server.js          listen + arrêt propre sur SIGTERM
    serveClient.js     fichiers statiques + fallback SPA
    config/env.js      validation des variables d'env (zod)
    routes/index.js    healthcheck + montage des modules
    modules/notes/     module d'exemple (routes, controller, service, schemas)
frontend/
  src/
    api/               instance Axios + hooks TanStack Query
    lib/queryClient.js options par défaut des queries
    pages/
    router.jsx
```

L'alias `@` pointe sur `frontend/src/`.

## Variables d'environnement

Dans `backend/.env` :

| Variable       | Local                                     | Railway                             |
| -------------- | ----------------------------------------- | ----------------------------------- |
| `NODE_ENV`     | `development`                             | `production`                        |
| `PORT`         | `3000`                                    | injecté par Railway, ne pas définir |
| `DATABASE_URL` | `postgresql://app:app@localhost:5433/app` | `${{Postgres.DATABASE_URL}}`        |
| `CORS_ORIGIN`  | `http://localhost:5173`                   | vide                                |

Une variable manquante ou invalide fait planter le démarrage avec un message clair.

Le front n'a besoin d'aucune variable : il appelle toujours `/api` en relatif.

## Ajouter une ressource

Tutos détaillés dans [docs/](docs/README.md) : route backend, appel depuis le front avec TanStack Query, utiliser Prisma (schéma, migrations, Studio), requêtes Prisma.

1. Ajouter le modèle dans `backend/prisma/schema.prisma`, puis `npm run db:migrate -- --name ma_ressource`.
2. Copier `backend/src/modules/notes/` et adapter.
3. Monter le router dans `backend/src/routes/index.js`.
4. Ajouter les hooks dans `frontend/src/api/` (voir `notes.js`).

Les handlers async n'ont pas besoin de try/catch : Express 5 transmet les erreurs à `errorHandler`. Une `ZodError` devient un 400, `httpError(404, 'CODE', 'message')` renvoie le status voulu.

## Déployer sur Railway

La config est dans [railway.json](railway.json) et passe avant les réglages du dashboard :

| Étape       | Commande            |
| ----------- | ------------------- |
| Build       | `npm run build`     |
| Pre-Deploy  | `npm run db:deploy` |
| Start       | `npm run start`     |
| Healthcheck | `GET /api/health`   |

Les migrations tournent en Pre-Deploy : si elles échouent, le déploiement est annulé et l'ancienne version reste en ligne.

### Première mise en ligne

1. Pousser le repo sur GitHub.
2. Railway → New Project → Deploy from GitHub repo.
3. **Supprimer le service `frontend`** créé automatiquement (Railway crée un service par workspace). Settings → Danger → Remove Service.
4. **Ajouter PostgreSQL** : + Create → Database → PostgreSQL.
5. Sur le service de l'app, onglet Variables :
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `NODE_ENV` = `production`
6. Settings → Networking → Generate Domain.

Garder **Root Directory = `/`** : le build a besoin des deux workspaces.

### Problèmes courants

- **`Environment variable not found: DATABASE_URL` au Pre-Deploy** : la référence doit utiliser le nom exact du service Postgres (`${{postgres-xyz.DATABASE_URL}}` si c'est son nom).
- **Stack traces dans les réponses** : `NODE_ENV` n'est pas à `production`.
- **"Application failed to respond"** : le serveur doit écouter sur `0.0.0.0` et le `PORT` injecté (déjà le cas dans `server.js`).
- **Images ou scripts tiers bloqués** : la CSP de helmet n'autorise que la même origine. Ajouter le domaine dans `backend/src/app.js`.

## À savoir

- L'ordre des middlewares compte : le 404 JSON de `/api` passe **avant** le fallback SPA, sinon une route d'API inexistante renverrait du HTML.
- Express 5 impose un wildcard nommé pour le fallback : `/{*splat}`, pas `*`.
- Le healthcheck n'interroge pas la base : un souci passager de Postgres ne bloque pas un déploiement.
- Une migration destructive tourne pendant que l'ancienne version sert encore le trafic. Procéder en deux temps : ajouter, déployer, puis supprimer au déploiement suivant.
