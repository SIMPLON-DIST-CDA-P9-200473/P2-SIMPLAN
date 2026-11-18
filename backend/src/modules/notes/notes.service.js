import { prisma } from '../../lib/prisma.js';
import { httpError } from '../../middlewares/errorHandler.js';

export function listNotes() {
  return prisma.note.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getNote(id) {
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw httpError(404, 'NOTE_NOT_FOUND', 'Note introuvable');
  return note;
}

export function createNote(data) {
  return prisma.note.create({ data });
}

export async function updateNote(id, data) {
  await getNote(id);
  return prisma.note.update({ where: { id }, data });
}

export async function deleteNote(id) {
  await getNote(id);
  await prisma.note.delete({ where: { id } });
}
