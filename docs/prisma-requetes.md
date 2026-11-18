# Requêtes Prisma

Les requêtes s'écrivent dans les **services** (`backend/src/modules/<ressource>/<ressource>.service.js`), avec l'instance partagée :

```js
import { prisma } from '../../lib/prisma.js';
```

Doc officielle : https://www.prisma.io/docs/orm/prisma-client/queries

## Le schéma utilisé dans les exemples

Une boutique : des catégories, des produits, des clients, des commandes.

```prisma
model Category {
  id       String    @id @default(cuid())
  name     String    @unique
  products Product[]                       // 1 catégorie → n produits
}

model Product {
  id         String      @id @default(cuid())
  name       String
  price      Int                            // en centimes
  stock      Int         @default(0)
  published  Boolean     @default(false)
  categoryId String
  category   Category    @relation(fields: [categoryId], references: [id])
  orderItems OrderItem[]
  createdAt  DateTime    @default(now())
}

model User {
  id     String  @id @default(cuid())
  email  String  @unique
  name   String
  orders Order[]                            // 1 client → n commandes
}

model Order {
  id        String      @id @default(cuid())
  userId    String
  user      User        @relation(fields: [userId], references: [id])
  items     OrderItem[]
  createdAt DateTime    @default(now())
}

// Table de liaison : n commandes ↔ n produits, avec une quantité.
model OrderItem {
  orderId   String
  productId String
  quantity  Int
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])

  @@id([orderId, productId])
}
```

Comment lire une relation :

- `categoryId` est la vraie colonne en base (la clé étrangère).
- `category` et `products` n'existent pas en base : ce sont des champs virtuels que Prisma utilise pour les jointures.
- `@relation(fields: [categoryId], references: [id])` se met du côté qui porte la clé étrangère.

Après chaque modification du schéma : `npm run db:migrate -- --name <nom>`.

## Lire

```js
// Tous les produits
await prisma.product.findMany();

// Un seul, par une colonne @id ou @unique. Renvoie null si absent.
await prisma.product.findUnique({ where: { id } });
await prisma.user.findUnique({ where: { email: 'a@b.fr' } });

// Le premier qui correspond à un filtre quelconque
await prisma.product.findFirst({ where: { published: true } });

// Comme findUnique, mais lève une erreur si absent
await prisma.product.findUniqueOrThrow({ where: { id } });
```

Dans ce template on préfère `findUnique` + `httpError(404, ...)` : le message d'erreur est contrôlé (voir `notes.service.js`).

## Filtrer : `where`

```js
await prisma.product.findMany({
  where: {
    published: true, // égalité
    price: { gte: 1000, lte: 5000 }, // entre 10 € et 50 €
    stock: { gt: 0 }, // gt, gte, lt, lte
    name: { contains: 'clavier', mode: 'insensitive' }, // ILIKE %clavier% (sans casse)
    categoryId: { in: [idA, idB] }, // IN (...)
  },
});
```

Plusieurs clés dans `where` = **ET**. Pour **OU** et **NON** :

```js
await prisma.product.findMany({
  where: {
    OR: [{ stock: 0 }, { published: false }],
    NOT: { name: { startsWith: 'Test' } },
  },
});
```

Autres opérateurs utiles : `startsWith`, `endsWith`, `notIn`, `not`, `equals: null` (colonne vide).

## Trier, paginer

```js
await prisma.product.findMany({
  orderBy: [{ price: 'asc' }, { name: 'asc' }], // plusieurs critères
  skip: 20, // décalage
  take: 10, // limite → page 3 de 10 éléments
});
```

Pattern classique pour une liste paginée avec le total :

```js
export async function listProducts({ page = 1, pageSize = 10 }) {
  const where = { published: true };

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({ where, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, pageSize };
}
```

## Choisir les colonnes : `select`

```js
await prisma.user.findMany({
  select: { id: true, name: true }, // pas d'email dans la réponse
});
```

Toujours utiliser `select` quand une table contient une donnée sensible (mot de passe hashé, token) : sans `select`, Prisma renvoie toutes les colonnes.

## Jointures : `include`

`include` ajoute les relations au résultat. C'est l'équivalent d'un `JOIN`.

```js
// Un produit avec sa catégorie (relation n → 1)
await prisma.product.findUnique({
  where: { id },
  include: { category: true },
});
// → { id, name, price, ..., category: { id, name } }

// Une catégorie avec ses produits (relation 1 → n)
await prisma.category.findUnique({
  where: { id },
  include: { products: true },
});
// → { id, name, products: [ {...}, {...} ] }
```

### Filtrer, trier, limiter la relation incluse

```js
await prisma.category.findMany({
  include: {
    products: {
      where: { published: true },
      orderBy: { price: 'asc' },
      take: 3, // les 3 moins chers de chaque catégorie
    },
  },
});
```

### Jointures imbriquées

Une commande avec son client, ses lignes, et le produit de chaque ligne :

```js
await prisma.order.findUnique({
  where: { id },
  include: {
    user: { select: { name: true, email: true } },
    items: {
      include: {
        product: { select: { name: true, price: true } },
      },
    },
  },
});
// → {
//     id, createdAt,
//     user: { name, email },
//     items: [ { quantity: 2, product: { name, price } }, ... ]
//   }
```

### `select` et `include` ensemble

On ne peut pas mettre les deux au même niveau. Pour choisir les colonnes **et** joindre, tout passer dans `select` :

```js
await prisma.product.findMany({
  select: {
    id: true,
    name: true,
    category: { select: { name: true } }, // la jointure se fait aussi dans select
  },
});
```

### Filtrer sur une relation

```js
// Les produits dont la catégorie s'appelle "Périphériques" (n → 1 : is)
await prisma.product.findMany({
  where: { category: { is: { name: 'Périphériques' } } },
});

// Les catégories qui ont au moins un produit en rupture (1 → n : some)
await prisma.category.findMany({
  where: { products: { some: { stock: 0 } } },
});

// Les clients sans aucune commande
await prisma.user.findMany({
  where: { orders: { none: {} } },
});
```

`some` (au moins un), `every` (tous), `none` (aucun) pour les relations 1 → n ; `is` / `isNot` pour les relations n → 1.

### Compter les éléments liés

```js
await prisma.category.findMany({
  include: { _count: { select: { products: true } } },
});
// → [ { id, name, _count: { products: 12 } }, ... ]
```

## Créer

```js
await prisma.product.create({
  data: { name: 'Clavier', price: 4990, categoryId },
});

// Plusieurs d'un coup (ne renvoie que le nombre créé)
await prisma.product.createMany({
  data: [
    { name: 'Souris', price: 1990, categoryId },
    { name: 'Écran', price: 19990, categoryId },
  ],
});
```

### Lier à une ligne existante : `connect`

Équivalent à passer `categoryId`, mais plus lisible quand on cible par une autre colonne unique :

```js
await prisma.product.create({
  data: {
    name: 'Clavier',
    price: 4990,
    category: { connect: { name: 'Périphériques' } },
  },
});
```

### Créer avec les relations en une fois (écriture imbriquée)

Une commande et ses lignes dans la même requête, et donc la même transaction :

```js
await prisma.order.create({
  data: {
    user: { connect: { id: userId } },
    items: {
      create: [
        { productId: idClavier, quantity: 1 },
        { productId: idSouris, quantity: 2 },
      ],
    },
  },
  include: { items: true },
});
```

`connectOrCreate` : lie la ligne si elle existe, la crée sinon.

```js
category: {
  connectOrCreate: {
    where: { name: 'Audio' },
    create: { name: 'Audio' },
  },
},
```

## Modifier

```js
await prisma.product.update({
  where: { id },
  data: { price: 3990 },
});

// Opérations atomiques, sans lire la valeur avant
await prisma.product.update({
  where: { id },
  data: { stock: { decrement: 1 } }, // increment, decrement, multiply, divide
});

// Plusieurs lignes
await prisma.product.updateMany({
  where: { stock: 0 },
  data: { published: false },
});

// Créer ou modifier selon l'existence
await prisma.user.upsert({
  where: { email },
  update: { name },
  create: { email, name },
});
```

`update` lève une erreur Prisma `P2025` si la ligne n'existe pas. Le template vérifie avant avec `getX(id)` pour renvoyer un 404 propre.

## Supprimer

```js
await prisma.product.delete({ where: { id } });
await prisma.product.deleteMany({ where: { published: false } });
```

Supprimer une ligne encore référencée (une catégorie qui a des produits) échoue, sauf si la relation a `onDelete: Cascade`. Ici, supprimer une `Order` supprime ses `OrderItem`, mais pas les produits.

L'erreur levée dans ce cas est générique et finirait en 500. Mieux vaut vérifier avant et renvoyer un message clair :

```js
export async function deleteCategory(id) {
  const used = await prisma.product.count({ where: { categoryId: id } });
  if (used > 0)
    throw httpError(409, 'CATEGORY_IN_USE', 'Catégorie encore utilisée par des produits');
  await prisma.category.delete({ where: { id } });
}
```

## Agréger

```js
// Nombre
await prisma.product.count({ where: { published: true } });

// Somme, moyenne, min, max
await prisma.product.aggregate({
  _sum: { stock: true },
  _avg: { price: true },
  _min: { price: true },
  _max: { price: true },
});

// GROUP BY : nombre de produits et prix moyen par catégorie
await prisma.product.groupBy({
  by: ['categoryId'],
  _count: { _all: true },
  _avg: { price: true },
  orderBy: { _count: { categoryId: 'desc' } },
});
```

## Transactions

Tout réussit ou rien n'est appliqué. Exemple : passer une commande et décrémenter le stock.

```js
export async function placeOrder(userId, items) {
  return prisma.$transaction(async (tx) => {
    for (const { productId, quantity } of items) {
      const product = await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
      });
      if (product.stock < 0) {
        // Lever une erreur annule toute la transaction, stock compris.
        throw httpError(409, 'OUT_OF_STOCK', `Stock insuffisant : ${product.name}`);
      }
    }

    return tx.order.create({
      data: { userId, items: { create: items } },
      include: { items: true },
    });
  });
}
```

Dans la fonction, utiliser `tx` et pas `prisma`, sinon la requête sort de la transaction.

## SQL brut

Pour une requête que l'API Prisma ne couvre pas :

```js
const minPrice = 1000;
const rows = await prisma.$queryRaw`
  SELECT c.name, COUNT(p.id)::int AS total
  FROM "Category" c
  LEFT JOIN "Product" p ON p."categoryId" = c.id AND p.price >= ${minPrice}
  GROUP BY c.name
`;
```

Les `${}` sont transformés en paramètres SQL, donc pas d'injection possible. Ne **jamais** utiliser `$queryRawUnsafe` avec une valeur venant de l'utilisateur. Les noms de tables et de colonnes s'écrivent entre guillemets doubles, avec la casse du schéma.

## Voir le SQL généré

Dans `backend/src/lib/prisma.js`, ajouter `'query'` aux logs en dev :

```js
log: isDevelopment ? ['query', 'warn', 'error'] : ['error'],
```

Chaque requête s'affiche dans le terminal de `npm run dev`. `npm run db:studio` permet de vérifier le contenu des tables.

## Aide-mémoire

| Besoin                               | Prisma                                       |
| ------------------------------------ | -------------------------------------------- |
| `WHERE a = 1 AND b = 2`              | `where: { a: 1, b: 2 }`                      |
| `WHERE a = 1 OR b = 2`               | `where: { OR: [{ a: 1 }, { b: 2 }] }`        |
| `ILIKE '%x%'` (sans casse)           | `{ contains: 'x', mode: 'insensitive' }`     |
| `IN (...)`                           | `{ in: [...] }`                              |
| `SELECT a, b`                        | `select: { a: true, b: true }`               |
| `JOIN`                               | `include: { relation: true }`                |
| `WHERE EXISTS (sous-requête)`        | `where: { relation: { some: {...} } }`       |
| `ORDER BY a DESC LIMIT 10 OFFSET 20` | `orderBy: { a: 'desc' }, take: 10, skip: 20` |
| `COUNT(*)`                           | `count()` ou `_count`                        |
| `GROUP BY`                           | `groupBy({ by: [...] })`                     |
| `BEGIN ... COMMIT`                   | `$transaction(async (tx) => {...})`          |
