import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const noteKeys = {
  all: ['notes'],
  detail: (id) => ['notes', id],
};

export function useNotes() {
  return useQuery({
    queryKey: noteKeys.all,
    queryFn: () => api.get('/notes').then((res) => res.data),
  });
}

export function useNote(id) {
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: () => api.get(`/notes/${id}`).then((res) => res.data),
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note) => api.post('/notes', note).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => api.delete(`/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
  });
}
