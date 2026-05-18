"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { startTransition, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { applyMatrixLayoutAction, type TaskRow } from "@/actions/tasks";
import {
  QUADRANT_META,
  QUADRANTS,
  layoutFromTasks,
  matrixLayoutToPayload,
  parseQuadrantContainerId,
  quadrantContainerId,
  type Quadrant,
} from "@/lib/eisenhower";

type ItemsState = Record<Quadrant, string[]>;

function findContainer(id: string, items: ItemsState): Quadrant | null {
  const asQuadrant = parseQuadrantContainerId(id);
  if (asQuadrant) return asQuadrant;
  for (const q of QUADRANTS) {
    if (items[q].includes(id)) return q;
  }
  return null;
}

function resolveOverQuadrant(
  overId: string,
  items: ItemsState,
): Quadrant | null {
  return findContainer(overId, items) ?? parseQuadrantContainerId(overId);
}

function MatrixTaskCard({
  task,
  dragHandle,
}: {
  task: TaskRow;
  dragHandle?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-tk-line bg-tk-surface p-2.5 shadow-sm">
      <div className="flex gap-2">
        {dragHandle}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-tk-ink">
            {task.title}
          </p>
          <p className="mt-1 text-[11px] text-tk-ink-3">
            {task.estimateMinutes}m
            {task.projectName ? (
              <span className="ml-1.5 rounded bg-tk-surface-2 px-1 py-0.5 text-[10px] text-tk-ink-2">
                {task.projectName}
              </span>
            ) : null}
            {task.dueDate ? (
              <span className="ml-1.5">· due {task.dueDate}</span>
            ) : null}
          </p>
          {task.rescheduleCount >= 3 ? (
            <p className="mt-0.5 text-[10px] text-tk-warn">
              ↻ {task.rescheduleCount} reschedules
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SortableMatrixCard({ task }: { task: TaskRow }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <MatrixTaskCard
        task={task}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 shrink-0 touch-none cursor-grab text-tk-ink-4 active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
    </li>
  );
}

function QuadrantColumn({
  quadrant,
  taskIds,
  tasksById,
  highlighted,
}: {
  quadrant: Quadrant;
  taskIds: string[];
  tasksById: Record<string, TaskRow>;
  highlighted: boolean;
}) {
  const meta = QUADRANT_META[quadrant];
  const { setNodeRef } = useDroppable({
    id: quadrantContainerId(quadrant),
  });

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[140px] flex-col rounded-xl border bg-tk-surface-2/60 transition-[border-color,box-shadow] duration-150 ${
        highlighted
          ? "border-tk-cream/80 shadow-[0_0_0_2px_rgba(239,228,200,0.35)]"
          : "border-tk-line"
      }`}
    >
      <header className="border-b border-tk-line px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-wide text-tk-honey">
            {meta.code}
          </span>
          <span className="text-[12px] font-semibold text-tk-ink">{meta.title}</span>
        </div>
        <p className="text-[10px] text-tk-ink-4">{meta.subtitle}</p>
      </header>
      <SortableContext
        id={quadrantContainerId(quadrant)}
        items={taskIds}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-1 flex-col gap-2 p-2">
          {taskIds.length === 0 ? (
            <li className="py-6 text-center text-[11px] text-tk-ink-4">
              Drop tasks here
            </li>
          ) : (
            taskIds.map((id) => {
              const task = tasksById[id];
              if (!task) return null;
              return <SortableMatrixCard key={id} task={task} />;
            })
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export function EisenhowerBoard({
  tasks,
  initialLayout,
  onSaved,
}: {
  tasks: TaskRow[];
  initialLayout: ItemsState;
  onSaved: () => void;
}) {
  const tasksById = useMemo(() => {
    const map: Record<string, TaskRow> = {};
    for (const t of tasks) map[t.id] = t;
    return map;
  }, [tasks]);

  const [items, setItems] = useState<ItemsState>(initialLayout);
  const itemsRef = useRef(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredQuadrant, setHoveredQuadrant] = useState<Quadrant | null>(null);
  const [saving, setSaving] = useState(false);

  const syncItems = useCallback((next: ItemsState) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistLayout = useCallback(
    async (next: ItemsState) => {
      setSaving(true);
      try {
        await applyMatrixLayoutAction(matrixLayoutToPayload(next));
        startTransition(() => onSaved());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save order");
        const reset = layoutFromTasks(tasks);
        syncItems(reset);
      } finally {
        setSaving(false);
      }
    },
    [onSaved, syncItems, tasks],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    const current = itemsRef.current;

    if (!over) {
      setHoveredQuadrant(null);
      return;
    }

    const overContainer = resolveOverQuadrant(String(over.id), current);
    setHoveredQuadrant(overContainer);

    const activeContainer = findContainer(String(active.id), current);
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    const activeItems = [...current[activeContainer]];
    const overItems = [...current[overContainer]];
    const activeIndex = activeItems.indexOf(String(active.id));
    if (activeIndex < 0) return;

    const overIndex = parseQuadrantContainerId(String(over.id))
      ? overItems.length
      : overItems.indexOf(String(over.id));

    activeItems.splice(activeIndex, 1);
    overItems.splice(
      overIndex >= 0 ? overIndex : overItems.length,
      0,
      String(active.id),
    );

    syncItems({
      ...current,
      [activeContainer]: activeItems,
      [overContainer]: overItems,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setHoveredQuadrant(null);

    const current = itemsRef.current;
    let next = current;

    if (over) {
      const activeContainer = findContainer(String(active.id), current);
      const overContainer = resolveOverQuadrant(String(over.id), current);

      if (activeContainer && overContainer && activeContainer === overContainer) {
        const containerItems = [...current[activeContainer]];
        const oldIndex = containerItems.indexOf(String(active.id));
        let newIndex = containerItems.indexOf(String(over.id));
        if (parseQuadrantContainerId(String(over.id))) {
          newIndex = containerItems.length - 1;
        }
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          next = {
            ...current,
            [activeContainer]: arrayMove(containerItems, oldIndex, newIndex),
          };
          syncItems(next);
        }
      }
    }

    void persistLayout(next);
  }

  function handleDragCancel() {
    setActiveId(null);
    setHoveredQuadrant(null);
  }

  const activeTask = activeId ? tasksById[activeId] : null;
  const totalTasks = QUADRANTS.reduce((n, q) => n + items[q].length, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-tk-ink-3">
        Drag cards between quadrants to set urgency and importance. Reorder within
        a quadrant to set priority.
        {saving ? (
          <span className="ml-2 text-tk-honey">Saving…</span>
        ) : null}
      </p>

      {totalTasks === 0 ? (
        <p className="rounded-xl border border-dashed border-tk-line py-10 text-center text-[13px] text-tk-ink-3">
          No active tasks. Add tasks below, then prioritize here.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUADRANTS.map((q) => (
              <QuadrantColumn
                key={q}
                quadrant={q}
                taskIds={items[q]}
                tasksById={tasksById}
                highlighted={hoveredQuadrant === q}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rotate-1 opacity-95">
                <MatrixTaskCard task={activeTask} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
