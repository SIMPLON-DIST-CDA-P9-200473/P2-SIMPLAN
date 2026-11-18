import { z } from 'zod';

export const noteIdSchema = z.object({
  id: z.string().min(1),
});

export const noteInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().max(5000).default(''),
});
