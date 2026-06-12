"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  completeTaskAction,
  createTaskAction,
  dropTaskAction,
  scheduleTaskForTodayAction,
  updateTaskAction,
} from "@/actions/tasks";
import { useOptimisticMutation } from "@/lib/mutations/optimistic";
import { queryKeys } from "@/lib/queries/keys";
import {
  affectsToday,
  buildOptimisticTaskRow,
  insertOptimisticTask,
  removeTaskFromCache,
  replaceTempId,
  updateTaskInCache,
} from "@/lib/queries/task-cache-helpers";
import type { TasksPageData } from "@/lib/queries/tasks";
import { createTempId } from "@/lib/temp-id";

const todayInvalidate = [queryKeys.today.all];

export function useCreateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      estimateMinutes: number;
      categoryId?: string | null;
      projectId?: string | null;
      dueDate?: string | null;
      scheduledDate?: string | null;
      tagIds?: string[];
      onFormReset?: () => void;
    }) =>
      createTaskAction({
        title: input.title,
        estimateMinutes: input.estimateMinutes,
        categoryId: input.categoryId,
        projectId: input.projectId,
        dueDate: input.dueDate,
        scheduledDate: input.scheduledDate,
        tagIds: input.tagIds,
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasks.all });
      const previous = qc.getQueryData<TasksPageData>(queryKeys.tasks.all);
      const tempId = createTempId();
      input.onFormReset?.();
      if (previous) {
        const task = buildOptimisticTaskRow({
          id: tempId,
          title: input.title.trim(),
          estimateMinutes: input.estimateMinutes,
          categoryId: input.categoryId,
          projectId: input.projectId,
          dueDate: input.dueDate,
          scheduledDate: input.scheduledDate,
          data: previous,
        });
        qc.setQueryData(
          queryKeys.tasks.all,
          insertOptimisticTask(previous, task),
        );
      }
      return { previous, tempId };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.tasks.all, context.previous);
      }
      toast.error(
        error instanceof Error ? error.message : "Could not create task",
      );
    },
    onSuccess: (result, _input, context) => {
      const current = qc.getQueryData<TasksPageData>(queryKeys.tasks.all);
      if (current && context?.tempId) {
        qc.setQueryData(
          queryKeys.tasks.all,
          replaceTempId(current, context.tempId, result.id),
        );
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void qc.invalidateQueries({ queryKey: queryKeys.today.all });
    },
  });
}

export function useCompleteTaskMutation() {
  return useOptimisticMutation<
    TasksPageData,
    { taskId: string },
    Awaited<ReturnType<typeof completeTaskAction>>
  >({
    queryKey: queryKeys.tasks.all,
    mutationFn: ({ taskId }) => completeTaskAction(taskId),
    applyOptimistic: (cache, { taskId }) =>
      removeTaskFromCache(cache, taskId),
    invalidateKeys: [...todayInvalidate, ["stats"]],
    errorMessage: "Could not complete task",
  });
}

export function useDropTaskMutation() {
  return useOptimisticMutation<
    TasksPageData,
    { taskId: string; reason: string },
    void
  >({
    queryKey: queryKeys.tasks.all,
    mutationFn: ({ taskId, reason }) => dropTaskAction(taskId, reason),
    applyOptimistic: (cache, { taskId }) =>
      removeTaskFromCache(cache, taskId),
    invalidateKeys: todayInvalidate,
    errorMessage: "Could not drop task",
  });
}

export function useScheduleForTodayMutation() {
  return useOptimisticMutation<TasksPageData, { taskId: string }, void>({
    queryKey: queryKeys.tasks.all,
    mutationFn: ({ taskId }) => scheduleTaskForTodayAction(taskId),
    applyOptimistic: (cache, { taskId }) =>
      updateTaskInCache(cache, taskId, (t) => ({
        ...t,
        scheduledDate: cache.today,
        status: "scheduled",
      })),
    invalidateKeys: todayInvalidate,
    errorMessage: "Could not schedule task",
  });
}

export function useUpdateTaskMutation() {
  return useOptimisticMutation<
    TasksPageData,
    {
      taskId: string;
      fields: {
        title?: string;
        estimateMinutes?: number;
        categoryId?: string | null;
        projectId?: string | null;
        dueDate?: string | null;
        scheduledDate?: string | null;
        description?: string | null;
      };
    },
    { ok: true }
  >({
    queryKey: queryKeys.tasks.all,
    mutationFn: async ({ taskId, fields }) => {
      const res = await updateTaskAction(taskId, fields);
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    applyOptimistic: (cache, { taskId, fields }) =>
      updateTaskInCache(cache, taskId, (t) => {
        const next = { ...t, ...fields, updatedAt: new Date() };
        if (
          fields.scheduledDate !== undefined ||
          fields.dueDate !== undefined
        ) {
          const sched =
            fields.scheduledDate !== undefined
              ? fields.scheduledDate
              : t.scheduledDate;
          const due =
            fields.dueDate !== undefined ? fields.dueDate : t.dueDate;
          next.status = sched || due ? "scheduled" : "backlog";
        }
        return next;
      }),
    invalidateKeys: todayInvalidate,
    errorMessage: "Could not update task",
  });
}

export function taskMutationAffectsToday(
  data: TasksPageData,
  scheduledDate?: string | null,
  dueDate?: string | null,
): boolean {
  return affectsToday(data, scheduledDate, dueDate);
}
