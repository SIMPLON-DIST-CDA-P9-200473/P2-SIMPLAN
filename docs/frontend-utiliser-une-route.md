# Utiliser une route (frontend)

Suite du [guide backend](backend-ajouter-une-route.md) : l'API expose maintenant `/api/products`. On va l'afficher dans une page.

## Ce qui est déjà en place

| Fichier                  | Rôle                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `src/api/client.js`      | instance Axios, `baseURL = "/api"`, et `toErrorMessage()`             |
| `src/lib/queryClient.js` | options par défaut des queries (cache 1 min, pas de retry sur un 4xx) |
| `src/main.jsx`           | `QueryClientProvider` autour de toute l'app                           |

Grâce à `baseURL`, on écrit `api.get("/products")` et Axios appelle `/api/products`. En dev, le proxy Vite renvoie vers Express ; en prod, c'est la même origine. Aucune URL à changer entre les deux.

## 1. Les hooks : `src/api/products.js`

Un fichier par ressource, qui regroupe les appels Axios et les hooks TanStack Query.

```js
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

// Les clés identifient les données dans le cache.
// Les centraliser évite les fautes de frappe entre query et invalidation.
export const productKeys = {
  all: ['products'],
  detail: (id) => ['products', id],
};

// Lecture : useQuery
export function useProducts() {
  return useQuery({
    queryKey: productKeys.all,
    queryFn: () => api.get('/products').then((res) => res.data),
  });
}

export function useProduct(id) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => api.get(`/products/${id}`).then((res) => res.data),
    enabled: Boolean(id), // n'appelle pas l'API tant que l'id est vide
  });
}

// Écriture : useMutation
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (product) => api.post('/products', product).then((res) => res.data),
    // La liste en cache est périmée : on la marque comme telle, TanStack Query la recharge.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}
```

`invalidateQueries({ queryKey: ["products"] })` invalide toutes les clés qui commencent par `["products"]`, donc la liste **et** les détails.

## 2. La page : `src/pages/Products.jsx`

```jsx
import { useState } from 'react';
import { useCreateProduct, useDeleteProduct, useProducts } from '@/api/products';
import { toErrorMessage } from '@/api/client';

export default function Products() {
  const { data: products, isPending, isError, error } = useProducts();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    createProduct.mutate(
      { name, price: Math.round(Number(price) * 100) }, // euros → centimes
      {
        onSuccess: () => {
          setName('');
          setPrice('');
        },
      },
    );
  }

  if (isPending) return <p className="p-6">Chargement…</p>;
  if (isError) return <p className="p-6 text-red-500">{toErrorMessage(error)}</p>;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Produits</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom"
          className="flex-1 rounded border px-3 py-2"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Prix €"
          type="number"
          step="0.01"
          className="w-28 rounded border px-3 py-2"
        />
        <button
          disabled={createProduct.isPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {createProduct.isError && (
        <p className="mt-2 text-sm text-red-500">{toErrorMessage(createProduct.error)}</p>
      )}

      <ul className="mt-6 divide-y">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between py-2">
            <span>
              {product.name} — {(product.price / 100).toFixed(2)} €
            </span>
            <button
              onClick={() => deleteProduct.mutate(product.id)}
              className="text-sm text-red-500"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

Ce que renvoient les hooks :

| `useQuery`          | Sens                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `data`              | la réponse de l'API (`undefined` tant qu'elle n'est pas arrivée)     |
| `isPending`         | premier chargement en cours                                          |
| `isError` / `error` | l'appel a échoué ; `toErrorMessage(error)` donne le message de l'API |
| `isFetching`        | un rechargement est en cours (y compris en arrière-plan)             |

| `useMutation`       | Sens                                                   |
| ------------------- | ------------------------------------------------------ |
| `mutate(vars)`      | lance l'appel                                          |
| `isPending`         | l'appel est en cours (utile pour désactiver un bouton) |
| `isError` / `error` | l'appel a échoué (ex. 400 de validation)               |

Il n'y a ni `useEffect` ni `useState` pour stocker la liste : TanStack Query s'occupe du cache, du chargement et du rechargement après chaque mutation.

## 3. La route de la page : `src/router.jsx`

```jsx
// ... imports existants
import Products from '@/pages/Products';

export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/products', element: <Products /> },
  { path: '*', element: <NotFound /> },
]);
```

La page est sur http://localhost:5173/products. Laisser `*` en dernier.

Attention à ne pas confondre les deux « routes » :

| Route           | Déclarée dans                 | Rôle                        |
| --------------- | ----------------------------- | --------------------------- |
| `/products`     | `frontend/src/router.jsx`     | affiche la page React       |
| `/api/products` | `backend/src/routes/index.js` | renvoie les données en JSON |

Le préfixe `/api` les sépare : en prod, Express envoie tout ce qui commence par `/api` à l'API, et `index.html` pour le reste.

## 4. Page de détail (optionnel)

Pour une URL du type `/products/:id`, lire le paramètre avec `useParams` :

```jsx
import { useParams } from 'react-router-dom';
import { useProduct } from '@/api/products';

export default function ProductDetail() {
  const { id } = useParams();
  const { data: product, isPending, isError } = useProduct(id);

  if (isPending) return <p>Chargement…</p>;
  if (isError) return <p>Produit introuvable.</p>;

  return <h1>{product.name}</h1>;
}
```

Et dans `router.jsx` : `{ path: "/products/:id", element: <ProductDetail /> }`.

## Déboguer

- Les devtools TanStack Query (le logo en bas à droite, en dev) montrent chaque clé en cache, son état et ses données.
- L'onglet Réseau du navigateur montre la vraie requête : URL, status, body renvoyé.
- Une erreur 404 `NOT_FOUND` sur `/api/...` veut dire que la route n'est pas montée côté backend (étape 6 du guide backend).
