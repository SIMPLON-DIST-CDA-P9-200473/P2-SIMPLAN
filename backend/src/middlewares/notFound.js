// Monté sur /api AVANT le fallback SPA : sinon une route d'API inexistante
// renverrait index.html au lieu d'un 404 JSON.
export function notFound(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route introuvable : ${req.method} ${req.originalUrl}`,
    },
  });
}
