"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  completeProjectAction,
  createProjectAction,
  listProjects,
  updateProjectAction,
  type ProjectListRow,
} from "@/actions/projects";
import { PageLoadingShell } from "@/components/page-loading-shell";
import { queryKeys } from "@/lib/queries/keys";
import { createTempId } from "@/lib/temp-id";

export function ProjectsClient({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: () => listProjects(),
  });
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const createProject = useMutation({
    mutationFn: (input: { name: string; description: string }) =>
      createProjectAction(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.projects.all });
      const previous = qc.getQueryData<ProjectListRow[]>(queryKeys.projects.all);
      const tempId = createTempId();
      setName("");
      setDesc("");
      if (previous) {
        const now = new Date();
        qc.setQueryData<ProjectListRow[]>(queryKeys.projects.all, [
          {
            id: tempId,
            userId: "",
            name: input.name,
            description: input.description || null,
            status: "active",
            createdAt: now,
            completedAt: null,
            retiredAt: null,
            retiredReason: null,
            trackedMinutes: 0,
          },
          ...previous,
        ]);
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.projects.all, ctx.previous);
      }
      toast.error("Could not create project");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
    onSuccess: () => toast.success("Project created"),
  });

  const { active, completed, retired } = useMemo(() => {
    const active: ProjectListRow[] = [];
    const completed: ProjectListRow[] = [];
    const retired: ProjectListRow[] = [];
    for (const p of rows) {
      if (p.status === "completed") completed.push(p);
      else if (p.status === "retired") retired.push(p);
      else active.push(p);
    }
    return { active, completed, retired };
  }, [rows]);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createProject.mutate({ name: name.trim(), description: desc });
  }

  if (isLoading) {
    return <PageLoadingShell title="Projects" rows={4} />;
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-[13px] text-tk-ink-3">
        Could not load projects.{" "}
        <button
          type="button"
          className="text-tk-honey underline"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${embedded ? "" : "py-2"}`}>
      <h1 className="text-xl font-semibold text-tk-ink">Projects</h1>

      <form onSubmit={(e) => void onCreate(e)} className="card flex flex-col gap-3 p-4">
        <input
          className="input"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <button type="submit" className="btn-primary py-2 text-[13px]">
          Add project
        </button>
      </form>

      {active.length === 0 ? (
        <p className="text-[13px] text-tk-ink-3">No active projects.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((p) => (
            <ProjectCard key={p.id} project={p} onSaved={refetch} />
          ))}
        </ul>
      )}

      {completed.length > 0 ? (
        <ProjectsArchiveSection title="Completed projects" count={completed.length}>
          <ul className="flex flex-col gap-2">
            {completed.map((p) => (
              <CompletedProjectCard key={p.id} project={p} onSaved={refetch} />
            ))}
          </ul>
        </ProjectsArchiveSection>
      ) : null}

      {retired.length > 0 ? (
        <ProjectsArchiveSection title="Retired projects" count={retired.length}>
          <ul className="flex flex-col gap-2">
            {retired.map((p) => (
              <ProjectCard key={p.id} project={p} onSaved={refetch} />
            ))}
          </ul>
        </ProjectsArchiveSection>
      ) : null}
    </div>
  );
}

function ProjectsArchiveSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details className="card overflow-hidden">
      <summary className="eyebrow cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-[11px] font-normal text-tk-ink-3">{count}</span>
        </span>
      </summary>
      <div className="border-t border-tk-line px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}

function formatTrackedMinutes(minutes: number): string {
  if (minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCompletedAt(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function projectCardClass(status: ProjectListRow["status"]) {
  switch (status) {
    case "active":
      return "card border border-tk-green/35 bg-tk-green/10 ring-1 ring-tk-green/20";
    case "paused":
      return "card border border-tk-amber/35 bg-tk-amber/10 ring-1 ring-tk-amber/20";
    case "completed":
      return "card border border-tk-honey/35 bg-tk-honey/10 ring-1 ring-tk-honey/20";
    case "retired":
      return "card border border-tk-red/35 bg-tk-red/10 ring-1 ring-tk-red/20";
    default:
      return "card";
  }
}

function ProjectCard({
  project,
  onSaved,
}: {
  project: ProjectListRow;
  onSaved: () => Promise<unknown>;
}) {
  const [status, setStatus] = useState(project.status);
  const [reason, setReason] = useState(project.retiredReason ?? "");
  const [retireOpen, setRetireOpen] = useState(false);

  async function saveStatus(next: "active" | "paused" | "retired") {
    if (next === "retired" && !reason.trim()) {
      toast.error("Retirement reason required");
      return;
    }
    await updateProjectAction({
      id: project.id,
      name: project.name,
      description: project.description,
      status: next,
      retiredReason: next === "retired" ? reason : undefined,
    });
    setStatus(next);
    if (next !== "retired") setRetireOpen(false);
    toast.success("Updated");
    await onSaved();
  }

  async function onComplete() {
    await completeProjectAction(project.id);
    toast.success("Project completed");
    await onSaved();
  }

  function cancelRetire() {
    setRetireOpen(false);
    setReason(project.retiredReason ?? "");
  }

  const statusLabel =
    status === "active"
      ? "Active"
      : status === "paused"
        ? "Paused"
        : status === "completed"
          ? "Completed"
          : "Retired";

  const trackedLabel = formatTrackedMinutes(project.trackedMinutes);

  return (
    <li className={`${projectCardClass(status)} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-tk-ink">{project.name}</p>
          {project.description ? (
            <p className="mt-1 text-[13px] text-tk-ink-2">{project.description}</p>
          ) : null}
          <p
            className={`mt-2 text-[11px] font-medium uppercase tracking-wide ${
              status === "active"
                ? "text-tk-green"
                : status === "paused"
                  ? "text-tk-amber"
                  : status === "completed"
                    ? "text-tk-honey"
                    : "text-tk-red"
            }`}
          >
            {statusLabel}
          </p>
        </div>
        {trackedLabel ? (
          <div className="shrink-0 text-right">
            <p className="mono text-[17px] font-semibold leading-none text-tk-ink">
              {trackedLabel}
            </p>
            <p className="mt-0.5 text-[10px] text-tk-ink-4">tracked</p>
          </div>
        ) : null}
      </div>
      {status === "retired" && project.retiredReason ? (
        <p className="mt-2 text-[12px] text-tk-ink-2">{project.retiredReason}</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {status !== "active" ? (
            <button
              type="button"
              className="btn-ghost text-[12px]"
              onClick={() => void saveStatus("active")}
            >
              Activate
            </button>
          ) : null}
          {status !== "paused" ? (
            <button
              type="button"
              className="btn-ghost text-[12px]"
              onClick={() => void saveStatus("paused")}
            >
              Pause
            </button>
          ) : null}
          {status !== "retired" && status !== "completed" && !retireOpen ? (
            <>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-[12px]"
                onClick={() => void onComplete()}
              >
                Done
              </button>
              <button
                type="button"
                className="btn-ghost text-[12px] text-tk-red"
                onClick={() => setRetireOpen(true)}
              >
                Retire
              </button>
            </>
          ) : null}
        </div>
        {retireOpen ? (
          <div className="flex flex-col gap-2 border-t border-tk-line pt-2">
            <label className="text-[11px] text-tk-ink-3">
              Why are you retiring this project?
              <textarea
                className="input mt-1 w-full text-[12px]"
                rows={2}
                placeholder="Required"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-[12px]"
                onClick={() => void saveStatus("retired")}
              >
                Confirm retire
              </button>
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-[12px]"
                onClick={cancelRetire}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function CompletedProjectCard({
  project,
  onSaved,
}: {
  project: ProjectListRow;
  onSaved: () => Promise<unknown>;
}) {
  const trackedLabel = formatTrackedMinutes(project.trackedMinutes);
  const completedLabel = formatCompletedAt(project.completedAt);

  async function reactivate() {
    await updateProjectAction({
      id: project.id,
      name: project.name,
      description: project.description,
      status: "active",
    });
    toast.success("Project reactivated");
    await onSaved();
  }

  return (
    <li className={`${projectCardClass("completed")} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-tk-ink">{project.name}</p>
          {project.description ? (
            <p className="mt-1 text-[13px] text-tk-ink-2">{project.description}</p>
          ) : null}
          {completedLabel ? (
            <p className="mt-2 text-[11px] text-tk-ink-3">Completed {completedLabel}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          {trackedLabel ? (
            <>
              <p className="mono text-[17px] font-semibold leading-none text-tk-ink">
                {trackedLabel}
              </p>
              <p className="mt-0.5 text-[10px] text-tk-ink-4">tracked</p>
            </>
          ) : (
            <span className="text-[11px] text-tk-honey">Done</span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <button
          type="button"
          className="btn-ghost text-[12px]"
          onClick={() => void reactivate()}
        >
          Reactivate
        </button>
      </div>
    </li>
  );
}
