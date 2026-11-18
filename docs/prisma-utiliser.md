# Utiliser Prisma

Ce guide couvre l'outil : le schéma, les migrations, Studio, le seed, et quoi faire quand ça coince. Pour écrire les requêtes dans le code, voir [Requêtes Prisma](prisma-requetes.md).

## Les trois morceaux

| Morceau          | Où                             | Rôle                                                             |
| ---------------- | ------------------------------ | ---------------------------------------------------------------- |
| Le schéma        | `backend/prisma/schema.prisma` | décrit les tables. C'est le seul fichier qu'on modifie à la main |
| Les migrations   | `backend/prisma/migrations/`   | l'historique des changements, en SQL. À commiter                 |
| Le client généré | `node_modules/.prisma/client`  | le code JS (`prisma.product.findMany()`…) déduit du schéma       |

Le principe : on modifie le schéma, Prisma calcule le SQL qui fait passer la base de l'ancien état au nouveau, l'enregistre dans une migration, l'applique, puis régénère le client.

La config est dans `backend/prisma.config.js`. Elle charge `backend/.env`, donc `DATABASE_URL` doit y être défini.

## Les commandes

À lancer depuis la racine du projet :

| Commande                             | Ce qu'elle fait                                                        |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `npm run db:up`                      | démarre PostgreSQL (Docker). À faire avant toute autre commande        |
| `npm run db:migrate -- --name <nom>` | crée une migration à partir du schéma, l'applique, régénère le client  |
| `npm run db:migrate`                 | applique les migrations récupérées des collègues (après un `git pull`) |
| `npm run db:studio`                  | ouvre une interface web pour voir et modifier les données              |
| `npm run db:seed`                    | insère les données d'exemple (`backend/prisma/seed.js`)                |
| `npm run db:reset`                   | vide la base, rejoue toutes les migrations, relance le seed            |
| `npm run db:nuke`                    | supprime le conteneur et son volume, repart d'un Postgres neuf         |
| `npm run db:deploy`                  | applique les migrations en attente, sans rien créer (prod uniquement)  |

Le `--` dans `npm run db:migrate -- --name <nom>` est obligatoire : sans lui, npm garde `--name` pour lui au lieu de le passer à Prisma.

Pour les autres commandes Prisma, se placer dans `backend/` :

```bash
cd backend
npx prisma format          # aligne et corrige la mise en forme du schéma
npx prisma validate        # vérifie le schéma sans toucher à la base
npx prisma migrate status  # liste les migrations appliquées / en attente
npx prisma generate        # régénère le client seul
```

## Modifier le schéma

### Le cycle

1. Modifier `backend/prisma/schema.prisma`.
2. `npm run db:migrate -- --name add_product_stock` (un nom court qui dit ce qui change).
3. Vérifier le SQL généré dans `backend/prisma/migrations/<date>_add_product_stock/migration.sql`.
4. Commiter le schéma **et** le dossier de migration ensemble.

Si `npm run dev` tourne pendant la migration, le redémarrer : le serveur ne recharge pas le client régénéré tout seul.

### Écrire un modèle

```prisma
model Product {
  id          String    @id @default(cuid())   // clé primaire, générée automatiquement
  name        String                           // obligatoire
  description String?                          // ? = optionnel (NULL autorisé)
  price       Int                              // en centimes, pas de Float pour de l'argent
  stock       Int       @default(0)
  sku         String    @unique                // pas deux produits avec le même sku
  status      Status    @default(DRAFT)
  tags        String[]                         // tableau (PostgreSQL)
  metadata    Json?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt             // mis à jour automatiquement à chaque update

  @@index([status, createdAt])                 // accélère les filtres/tris sur ces colonnes
}

enum Status {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

| Type       | En base (PostgreSQL) | Pour                                      |
| ---------- | -------------------- | ----------------------------------------- |
| `String`   | `text`               | texte                                     |
| `Int`      | `integer`            | entiers, montants en centimes             |
| `Float`    | `double precision`   | mesures (jamais de l'argent)              |
| `Decimal`  | `decimal(65,30)`     | montants si les centimes ne suffisent pas |
| `Boolean`  | `boolean`            | oui / non                                 |
| `DateTime` | `timestamp(3)`       | dates (stockées en UTC)                   |
| `Json`     | `jsonb`              | données libres sans structure fixe        |

Conventions du template : noms de modèles au singulier en PascalCase (`Product`), champs en camelCase (`createdAt`), ids en `cuid()`.

### Les relations

```prisma
// 1 → n : une catégorie a plusieurs produits
model Category {
  id       String    @id @default(cuid())
  products Product[]
}

model Product {
  id         String   @id @default(cuid())
  categoryId String                                              // la vraie colonne
  category   Category @relation(fields: [categoryId], references: [id])
}
```

Le côté qui porte la clé étrangère (`categoryId`) déclare le `@relation`. L'autre côté (`products Product[]`) est obligatoire aussi, mais n'existe pas en base. `npx prisma format` l'ajoute tout seul s'il manque.

Pour du n ↔ n, une 1 ↔ 1, et les jointures dans les requêtes : voir le schéma boutique de [Requêtes Prisma](prisma-requetes.md#le-schéma-utilisé-dans-les-exemples).

Que faire des enfants quand on supprime le parent :

| `onDelete` | Supprimer une catégorie qui a des produits…            |
| ---------- | ------------------------------------------------------ |
| (rien)     | échoue tant qu'il reste des produits                   |
| `Cascade`  | supprime aussi ses produits                            |
| `SetNull`  | met `categoryId` à NULL (le champ doit être `String?`) |

## Les changements qui demandent de l'attention

Prisma compare l'ancien et le nouveau schéma. Certains changements, il ne peut pas les deviner.

### Ajouter un champ obligatoire à une table qui a déjà des lignes

```prisma
stock Int   // ✗ les lignes existantes n'ont pas de valeur
```

La migration échoue. Trois solutions :

- donner une valeur par défaut : `stock Int @default(0)` ;
- le rendre optionnel : `stock Int?` ;
- en dev uniquement, si les données ne comptent pas : accepter le reset que Prisma propose.

### Renommer un champ ou un modèle

Prisma ne voit pas un renommage : il voit une colonne supprimée et une nouvelle colonne ajoutée. **Les données de la colonne sont perdues.**

Pour garder les données, créer la migration sans l'appliquer, corriger le SQL, puis l'appliquer :

```bash
npm run db:migrate -- --name rename_title_to_name --create-only
```

Dans le `migration.sql` généré, remplacer le `DROP COLUMN` + `ADD COLUMN` par :

```sql
ALTER TABLE "Product" RENAME COLUMN "title" TO "name";
```

Puis `npm run db:migrate` pour l'appliquer.

`--create-only` sert aussi à ajouter du SQL que Prisma ne génère pas : remplir une nouvelle colonne à partir d'une ancienne, créer une extension, etc.

### Supprimer un champ ou une table

La migration supprime les données. En prod, procéder en deux déploiements : d'abord retirer tout usage du champ dans le code, déployer, puis supprimer le champ du schéma au déploiement suivant. Sinon l'ancienne version du serveur, encore en ligne pendant la migration, plante en lisant une colonne qui n'existe plus.

## Prisma Studio

```bash
npm run db:studio
```

Ouvre http://localhost:5555 : chaque modèle s'affiche comme un tableur. On peut filtrer, ajouter, modifier et supprimer des lignes. C'est pratique pour vérifier ce qu'une route a écrit, ou pour préparer un cas de test à la main.

Studio se connecte à la base de `DATABASE_URL`. Ne pas le lancer avec l'URL de la prod.

## Le seed

`backend/prisma/seed.js` remplit la base avec des données d'exemple. Il est lancé par `npm run db:seed`, et automatiquement après `npm run db:reset`.

Le seed peut être relancé plusieurs fois : il vide d'abord ses tables (`deleteMany`), puis les remplit. Garder ce principe en ajoutant un modèle :

```js
async function main() {
  // Supprimer les enfants avant les parents, à cause des clés étrangères.
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const category = await prisma.category.create({ data: { name: 'Périphériques' } });

  await prisma.product.createMany({
    data: [
      { name: 'Clavier', price: 4990, categoryId: category.id },
      { name: 'Souris', price: 1990, categoryId: category.id },
    ],
  });
}
```

## Repartir de zéro

| Situation                                                        | Commande                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Base en désordre, on veut retrouver l'état des migrations + seed | `npm run db:reset`                                                |
| Le conteneur Postgres lui-même pose problème                     | `npm run db:nuke`, puis `npm run db:migrate` et `npm run db:seed` |

Les deux effacent toutes les données locales. Ni l'un ni l'autre ne touche à la prod.

## Travailler à plusieurs

- Après un `git pull` qui contient de nouvelles migrations : `npm run db:migrate` (sans `--name`) pour les appliquer.
- Ne **jamais** modifier ni supprimer une migration déjà poussée : les collègues et la prod l'ont déjà appliquée. Pour corriger, créer une nouvelle migration.
- Deux personnes qui ont créé une migration en parallèle : après le merge, `npm run db:migrate`. Si Prisma signale un écart, `npm run db:reset` en local règle le problème.

## En production (Railway)

Le déploiement lance `npm run db:deploy` (`prisma migrate deploy`) avant de démarrer le serveur (voir `railway.json`). Cette commande applique uniquement les migrations commitées qui manquent. Elle ne crée rien, ne réinitialise rien, et ne pose aucune question.

D'où la règle : **une modification du schéma n'arrive en prod que par une migration commitée.** Ne jamais lancer `db:migrate`, `db:reset` ou `prisma db push` sur la base de prod.

Si la migration échoue au déploiement, le nouveau code ne démarre pas et l'ancienne version reste en ligne. Lire l'erreur dans les logs du déploiement sur Railway, corriger avec une nouvelle migration, redéployer.

## Problèmes courants

| Message                                                              | Cause et solution                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `P1001: Can't reach database server`                                 | Postgres ne tourne pas : `npm run db:up`. Vérifier aussi le port dans `DATABASE_URL` (5433 par défaut) |
| `Environment variable not found: DATABASE_URL`                       | `backend/.env` manque : copier `backend/.env.example`                                                  |
| `Drift detected` / `The database schema is not in sync`              | la base a été modifiée hors migrations (Studio, SQL à la main…). En dev : `npm run db:reset`           |
| `Added the required column ... without a default value`              | voir [Ajouter un champ obligatoire](#ajouter-un-champ-obligatoire-à-une-table-qui-a-déjà-des-lignes)   |
| `prisma.product` est `undefined`, ou `Unknown argument` sur un champ | le client n'est pas à jour : `cd backend && npx prisma generate`, puis redémarrer `npm run dev`        |
| `EPERM: operation not permitted, rename ... query_engine` (Windows)  | le serveur tient le client verrouillé : arrêter `npm run dev`, relancer la commande                    |
| `P2002: Unique constraint failed`                                    | une ligne avec la même valeur existe déjà sur un champ `@unique`. À transformer en 409 dans le service |
| `P2025: Record to update/delete not found`                           | la ligne n'existe pas. Le template vérifie avant avec `getX(id)` pour renvoyer un 404                  |
