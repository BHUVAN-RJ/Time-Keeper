"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  createProjectAction,
  listProjects,
  updateProjectAction,
  type ProjectListRow,
} from "@/actions/projects";
import { PageLoadingShell } from "@/components/page-loading-shell";

export function ProjectsClient({ embedded = false }: { embedded?: boolean }) {
  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProjectAction({ name, description: desc });
    setName("");
    setDesc("");
    toast.success("Project created");
    await refetch();
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

      <ul className="flex flex-col gap-2">
        {rows.map((p) => (
          <ProjectCard key={p.id} project={p} onSaved={refetch} />
        ))}
      </ul>
    </div>
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

function projectCardClass(status: ProjectListRow["status"]) {
  switch (status) {
    case "active":
      return "card border border-tk-green/35 bg-tk-green/10 ring-1 ring-tk-green/20";
    case "paused":
      return "card border border-tk-amber/35 bg-tk-amber/10 ring-1 ring-tk-amber/20";
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

  function cancelRetire() {
    setRetireOpen(false);
    setReason(project.retiredReason ?? "");
  }

  const statusLabel =
    status === "active" ? "Active" : status === "paused" ? "Paused" : "Retired";

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
        {status !== "retired" && !retireOpen ? (
          <button
            type="button"
            className="btn-ghost text-[12px] text-tk-red"
            onClick={() => setRetireOpen(true)}
          >
            Retire
          </button>
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
