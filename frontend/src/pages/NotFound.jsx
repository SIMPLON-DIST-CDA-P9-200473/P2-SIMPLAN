import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100">
      <p className="text-6xl font-semibold">404</p>
      <Link to="/" className="text-zinc-400 underline hover:text-zinc-100">
        Retour à l'accueil
      </Link>
    </main>
  );
}
