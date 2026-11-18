import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const notes = [
  { title: 'Première note', content: 'Créée par le seed.' },
  { title: 'Deuxième note', content: 'Supprimer prisma/seed.js si inutile.' },
];

async function main() {
  await prisma.note.deleteMany();
  await prisma.note.createMany({ data: notes });
  console.log(`[seed] ${notes.length} notes insérées`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
