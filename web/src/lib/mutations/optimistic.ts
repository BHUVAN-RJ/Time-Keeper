import {
  type QueryKey,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";

type OptimisticMutationOptions<TCache, TVariables, TResult> = {
  queryKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<TResult>;
  applyOptimistic: (cache: TCache, variables: TVariables) => TCache;
  onReconcile?: (
    cache: TCache,
    result: TResult,
    variables: TVariables,
  ) => TCache;
  invalidateKeys?: QueryKey[];
  errorMessage?: string | ((error: unknown) => string);
  onSuccessSideEffect?: (result: TResult, variables: TVariables) => void;
};

export function useOptimisticMutation<TCache, TVariables, TResult>({
  queryKey,
  mutationFn,
  applyOptimistic,
  onReconcile,
  invalidateKeys = [],
  errorMessage = "Something went wrong. Please try again.",
  onSuccessSideEffect,
}: OptimisticMutationOptions<TCache, TVariables, TResult>) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<TCache>(queryKey);
      if (previous !== undefined) {
        qc.setQueryData(queryKey, applyOptimistic(previous, variables));
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        qc.setQueryData(queryKey, context.previous);
      }
      const msg =
        typeof errorMessage === "function"
          ? errorMessage(error)
          : errorMessage;
      toast.error(error instanceof Error ? error.message : msg);
    },
    onSuccess: (result, variables) => {
      if (onReconcile) {
        const current = qc.getQueryData<TCache>(queryKey);
        if (current !== undefined) {
          qc.setQueryData(queryKey, onReconcile(current, result, variables));
        }
      }
      onSuccessSideEffect?.(result, variables);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey });
      for (const key of invalidateKeys) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  } satisfies UseMutationOptions<
    TResult,
    unknown,
    TVariables,
    { previous: TCache | undefined }
  >);
}
