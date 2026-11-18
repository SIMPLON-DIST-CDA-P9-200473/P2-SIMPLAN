import { Router } from 'express';
import {
  createNoteHandler,
  deleteNoteHandler,
  getNoteHandler,
  listNotesHandler,
  updateNoteHandler,
} from './notes.controller.js';

export const notesRouter = Router();

notesRouter.get('/', listNotesHandler);
notesRouter.post('/', createNoteHandler);
notesRouter.get('/:id', getNoteHandler);
notesRouter.put('/:id', updateNoteHandler);
notesRouter.delete('/:id', deleteNoteHandler);
