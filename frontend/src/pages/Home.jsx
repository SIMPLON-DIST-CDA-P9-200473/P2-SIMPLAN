import { useHealth } from '@/api/health';
import { useNotes } from '@/api/notes';

export default function Home() {
  const health = useHealth();
  const notes = useNotes();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Template fullstack Railway</h1>
        <p className="mt-4 text-zinc-400">
          Express sert l'API sous /api et ce front React pour tout le reste, avec Prisma et
          PostgreSQL. Un seul service à déployer sur Railway.
        </p>
        <p className="mt-8 font-mono text-sm text-zinc-500">
          API : {health.isPending ? '…' : health.isError ? 'injoignable' : health.data.status}
          {' · '}
          Base :{' '}
          {notes.isPending ? '…' : notes.isError ? 'injoignable' : `${notes.data.length} notes`}
        </p>
      </div>
    </main>
  );
}
