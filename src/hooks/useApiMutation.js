import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ui/Toast';

/**
 * Mutation wrapper that handles the three things every admin write needs:
 * a success toast, an error toast carrying the API's message and request id, and
 * cache invalidation.
 *
 * `invalidate` takes an array of query-key prefixes. React Query matches
 * prefixes, so passing `['users']` clears every user list and detail at once.
 */
export function useApiMutation({
  mutationFn,
  successMessage,
  invalidate = [],
  onSuccess,
  onError,
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      if (successMessage) {
        const message =
          typeof successMessage === 'function' ? successMessage(data, variables) : successMessage;
        if (message) toast.success(message);
      }
      invalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      });
      onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      // Surfaces `message` plus the requestId, which is what makes a screenshot
      // actionable against the backend logs.
      toast.error(error);
      onError?.(error, variables);
    },
  });
}
