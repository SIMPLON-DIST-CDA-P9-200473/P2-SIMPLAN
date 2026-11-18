import axios from 'axios';

// "/api" en relatif : proxy Vite en dev, même origine en prod.
// VITE_API_URL ne sert que si l'API vit un jour sur un autre domaine.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  withCredentials: true,
});

/** Message d'erreur renvoyé par l'API, avec un repli lisible. */
export function toErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ?? error?.message ?? 'Une erreur inattendue est survenue.'
  );
}
