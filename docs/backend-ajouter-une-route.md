# Ajouter une route (backend)

## Le chemin d'une requête

Exemple : le front appelle `GET /api/products/abc123`.

```
navigateur
  │  GET /api/products/abc123
  ▼
Vite :5173 (dev uniquement)        frontend/vite.config.js   proxy /api → localhost:3000
  ▼
Express :3000                      backend/src/app.js        middlewares, puis app.use('/api', apiRouter)
  ▼
routeur API                        backend/src/routes/index.js       apiRouter.use('/products', productsRouter)
  ▼
routeur du module                  modules/products/products.routes.js     productsRouter.get('/:id', getProductHandler)
  ▼
controller                         modules/products/products.controller.js lit req, valide, renvoie res.json()
  │                                      └── products.schemas.js            schémas zod
  ▼
service                            modules/products/products.service.js    logique + requêtes Prisma
  ▼
Prisma → PostgreSQL                backend/src/lib/prisma.js
```

En prod il n'y a pas de Vite : Express sert le front et l'API sur la même origine, le chemin commence directement à `app.js`.

L'URL finale est la concaténation des préfixes :

| Fichier              | Préfixe monté       |
| -------------------- | ------------------- |
| `app.js`             | `/api`              |
| `routes/index.js`    | `/products`         |
| `products.routes.js` | `/:id`              |
| **URL complète**     | `/api/products/:id` |

Si quelque chose plante en route (validation zod, erreur Prisma, `httpError`), l'erreur remonte toute seule jusqu'à `middlewares/errorHandler.js`, qui renvoie un JSON propre. Pas de try/catch à écrire.

Rôle de chaque couche :

- **routes** : associe une méthode HTTP + un chemin à un handler. Rien d'autre.
- **controller** : lit `req.params`, `req.query`, `req.body`, les valide avec zod, appelle le service, choisit le status HTTP.
- **schemas** : décrit les données attendues (zod). Tout ce qui n'est pas valide devient un 400.
- **service** : la logique métier et l'accès à la base. Ne connaît ni `req` ni `res`, donc réutilisable ailleurs (seed, script, autre module).

## Cas simple : une route sans base

Pour un endpoint qui ne touche pas la base, une ligne dans `backend/src/routes/index.js` suffit :

```js
apiRouter.get('/hello', (req, res) => {
  res.json({ message: 'Bonjour' });
});
```

→ `GET http://localhost:3000/api/hello`

Dès qu'il y a plus d'une route ou une table derrière, créer un module comme ci-dessous.

## Ressource complète : `products`

### 1. Le modèle

`backend/prisma/schema.prisma` :

```prisma
model Product {
  id        String   @id @default(cuid())
  name      String
  price     Int      // en centimes, évite les erreurs d'arrondi
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Puis créer et appliquer la migration (la base doit tourner, `npm run db:up`) :

```bash
npm run db:migrate -- --name add_product
```

Ça crée `backend/prisma/migrations/<date>_add_product/migration.sql` et régénère le client Prisma. Ce fichier est à commiter : c'est lui que Railway applique au déploiement. Détails dans [Utiliser Prisma](prisma-utiliser.md).

### 2. Les schémas

`backend/src/modules/products/products.schemas.js` :

```js
import { z } from 'zod';

export const productIdSchema = z.object({
  id: z.string().min(1),
});

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.coerce.number().int().min(0),
});
```

### 3. Le service

`backend/src/modules/products/products.service.js` :

```js
import { prisma } from '../../lib/prisma.js';
import { httpError } from '../../middlewares/errorHandler.js';

export function listProducts() {
  return prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getProduct(id) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable');
  return product;
}

export function createProduct(data) {
  return prisma.product.create({ data });
}

export async function deleteProduct(id) {
  await getProduct(id);
  await prisma.product.delete({ where: { id } });
}
```

`prisma.product` existe parce que le modèle s'appelle `Product` (Prisma met la première lettre en minuscule).

### 4. Le controller

`backend/src/modules/products/products.controller.js` :

```js
import { productIdSchema, productInputSchema } from './products.schemas.js';
import { createProduct, deleteProduct, getProduct, listProducts } from './products.service.js';

export async function listProductsHandler(req, res) {
  res.json(await listProducts());
}

export async function getProductHandler(req, res) {
  const { id } = productIdSchema.parse(req.params);
  res.json(await getProduct(id));
}

export async function createProductHandler(req, res) {
  const data = productInputSchema.parse(req.body);
  res.status(201).json(await createProduct(data));
}

export async function deleteProductHandler(req, res) {
  const { id } = productIdSchema.parse(req.params);
  await deleteProduct(id);
  res.status(204).end();
}
```

### 5. Les routes du module

`backend/src/modules/products/products.routes.js` :

```js
import { Router } from 'express';
import {
  createProductHandler,
  deleteProductHandler,
  getProductHandler,
  listProductsHandler,
} from './products.controller.js';

export const productsRouter = Router();

productsRouter.get('/', listProductsHandler);
productsRouter.post('/', createProductHandler);
productsRouter.get('/:id', getProductHandler);
productsRouter.delete('/:id', deleteProductHandler);
```

### 6. Monter le module

`backend/src/routes/index.js` :

```js
import { productsRouter } from '../modules/products/products.routes.js';

// ...
apiRouter.use('/products', productsRouter);
```

### 7. Tester

`npm run dev`, puis dans Postman (Body → raw → JSON pour le POST) :

| Requête                                         | Body                                   | Réponse attendue       |
| ----------------------------------------------- | -------------------------------------- | ---------------------- |
| `GET  http://localhost:3000/api/products`       |                                        | 200, `[]`              |
| `POST http://localhost:3000/api/products`       | `{ "name": "Clavier", "price": 4990 }` | 201, le produit        |
| `POST http://localhost:3000/api/products`       | `{ "name": "" }`                       | 400 `VALIDATION_ERROR` |
| `GET  http://localhost:3000/api/products/:id`   |                                        | 200 ou 404             |
| `DELETE http://localhost:3000/api/products/:id` |                                        | 204                    |

`npm run db:studio` pour voir le contenu de la table.

## Récap

| Étape | Fichier                                         |
| ----- | ----------------------------------------------- |
| 1     | `prisma/schema.prisma` + `npm run db:migrate`   |
| 2     | `modules/<ressource>/<ressource>.schemas.js`    |
| 3     | `modules/<ressource>/<ressource>.service.js`    |
| 4     | `modules/<ressource>/<ressource>.controller.js` |
| 5     | `modules/<ressource>/<ressource>.routes.js`     |
| 6     | `routes/index.js`                               |

Ensuite : [utiliser la route côté front](frontend-utiliser-une-route.md).
