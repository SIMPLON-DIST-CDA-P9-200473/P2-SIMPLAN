import { noteIdSchema, noteInputSchema } from './notes.schemas.js';
import { createNote, deleteNote, getNote, listNotes, updateNote } from './notes.service.js';

export async function listNotesHandler(req, res) {
  res.json(await listNotes());
}

export async function getNoteHandler(req, res) {
  const { id } = noteIdSchema.parse(req.params);
  res.json(await getNote(id));
}

export async function createNoteHandler(req, res) {
  const data = noteInputSchema.parse(req.body);
  res.status(201).json(await createNote(data));
}

export async function updateNoteHandler(req, res) {
  const { id } = noteIdSchema.parse(req.params);
  const data = noteInputSchema.parse(req.body);
  res.json(await updateNote(id, data));
}

export async function deleteNoteHandler(req, res) {
  const { id } = noteIdSchema.parse(req.params);
  await deleteNote(id);
  res.status(204).end();
}
