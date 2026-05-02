import React, { useMemo, useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../backend/convex/_generated/api";
import type { Id } from "../../../../backend/convex/_generated/dataModel";
import { ChevronLeftIcon, ChevronRightIcon, SpinnerIcon, CalendarIcon, SplitIcon } from "../icons";
import { isCurrentTerm } from "../../utils/termUtils";

const OTHER_COURSE_KEY = "__none__";

type StudyBlockInPanel = {
  _id: Id<"studyBlocks">;
  taskId: Id<"tasks">;
  subtaskId?: Id<"subtasks">;
  title: string;
  studyBlockLength: number;
  taskTitle: string;
  taskDueDate: number;
  courseColor?: string;
  courseName?: string;
};

type Props = {
  unscheduledBlocks: StudyBlockInPanel[];
  assigningBlockId: Id<"studyBlocks"> | null;
  onToggleAssign: (id: Id<"studyBlocks">) => void;
  timezone: string;
  onScheduleAllMsg: (
    msg: string,
    warn?: boolean,
    skippedReasons?: { title: string; reason: string }[]
  ) => void;
  onBeforeSchedule: (proceed: () => void) => void;
};

// ---------------------------------------------------------------------------
// BlockRow — extracted to avoid duplication and fix nested-interactive lint
// ---------------------------------------------------------------------------
function BlockRow({
  block,
  isAssigning,
  isScheduling,
  isSplitting,
  splitError,
  onToggleAssign,
  onSchedule,
  onSplit,
}: {
  block: StudyBlockInPanel;
  isAssigning: boolean;
  isScheduling: boolean;
  isSplitting: boolean;
  splitError: string | null;
  onToggleAssign: (id: Id<"studyBlocks">) => void;
  onSchedule: (id: Id<"studyBlocks">) => void;
  onSplit: (id: Id<"studyBlocks">) => void;
}) {
  const canSplit = block.studyBlockLength >= 30;
  return (
    <div className="flex flex-col gap-0.5">
      {/* outer div handles the assign-mode toggle; inner buttons are separate actions */}
      {/* div[role=button] + <button> is valid — avoids nested <button> elements */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggleAssign(block._id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleAssign(block._id);
          }
        }}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
          isAssigning
            ? "border-teal bg-teal/10"
            : "border-border bg-bg-gray hover:border-teal/50 hover:bg-teal/5"
        }`}
      >
        <span className="h-1 w-4 rounded-full bg-sky-blue shrink-0" />
        <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-navy">
          {block.title}
        </span>
        <span className="text-[10px] text-light-blue shrink-0">{block.studyBlockLength} min</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSplit(block._id);
          }}
          disabled={!canSplit || isSplitting}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-light-blue transition hover:bg-navy/10 hover:text-navy disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Split "${block.title}"`}
          title={`Split "${block.title}"`}
        >
          {isSplitting ? (
            <SpinnerIcon color="currentColor" size={10} />
          ) : (
            <SplitIcon color="currentColor" size={10} />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSchedule(block._id);
          }}
          disabled={isScheduling}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-light-blue transition hover:bg-navy/10 hover:text-navy disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Auto-schedule "${block.title}"`}
          title={`Auto-schedule "${block.title}"`}
        >
          {isScheduling ? (
            <SpinnerIcon color="currentColor" size={10} />
          ) : (
            <CalendarIcon color="currentColor" size={10} />
          )}
        </button>
      </div>
      {splitError && <p className="px-2.5 text-[10px] text-urgent-red">{splitError}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClassPanel
// ---------------------------------------------------------------------------
export default function ClassPanel({
  unscheduledBlocks,
  assigningBlockId,
  onToggleAssign,
  timezone,
  onScheduleAllMsg,
  onBeforeSchedule,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tasks"> | null>(null);
  const [schedulingBlockIds, setSchedulingBlockIds] = useState<Set<Id<"studyBlocks">>>(new Set());
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);
  const [splittingBlockIds, setSplittingBlockIds] = useState<Set<Id<"studyBlocks">>>(new Set());
  const [splitErrors, setSplitErrors] = useState<Map<Id<"studyBlocks">, string>>(new Map());

  const splitStudyBlockMutation = useMutation(api.mutations.studyBlocks.splitStudyBlock);

  const courses = useQuery(api.queries.userCourses.getUserCourses);
  // getTasksByCourseId drives the task-list drill-down; skipped until a course is selected.
  // Passing no courseId returns tasks with no class (the OTHER bucket).
  const courseTasksArgs: { courseId?: Id<"userCourses"> } | "skip" = !selectedCourseId
    ? "skip"
    : selectedCourseId === OTHER_COURSE_KEY
      ? {}
      : { courseId: selectedCourseId as Id<"userCourses"> };
  const courseTasks = useQuery(api.queries.tasks.getTasksByCourseId, courseTasksArgs);

  const scheduleBlockAction = useAction(api.actions.scheduleBlock.scheduleBlock);
  const scheduleAllBlocksAction = useAction(api.actions.scheduleAllBlocks.scheduleAllBlocks);

  const subtasks = useQuery(
    api.queries.subtasks.getSubtasksForTask,
    selectedTaskId ? { parentTaskId: selectedTaskId } : "skip"
  );

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const currentCourses = useMemo(
    () => (courses ?? []).filter((c) => isCurrentTerm(c.term)),
    [courses]
  );

  const tasksForSelectedCourse = (courseTasks ?? []).filter((t) => t.status !== "completed");

  const selectedTask = useMemo(
    () => tasksForSelectedCourse.find((t) => t._id === selectedTaskId) ?? null,
    [tasksForSelectedCourse, selectedTaskId]
  );

  const selectedCourse = useMemo(
    () => currentCourses.find((c) => c._id === selectedCourseId) ?? null,
    [currentCourses, selectedCourseId]
  );

  const selectedTaskBlocks = useMemo(
    () => (selectedTaskId ? unscheduledBlocks.filter((b) => b.taskId === selectedTaskId) : []),
    [selectedTaskId, unscheduledBlocks]
  );

  const blocksBySubtask = useMemo(() => {
    const map = new Map<string, StudyBlockInPanel[]>();
    for (const block of selectedTaskBlocks) {
      if (!block.subtaskId) continue;
      const key = block.subtaskId as string;
      const bucket = map.get(key);
      if (bucket) bucket.push(block);
      else map.set(key, [block]);
    }
    return map;
  }, [selectedTaskBlocks]);

  const taskLevelBlocks = useMemo(
    () => selectedTaskBlocks.filter((b) => !b.subtaskId),
    [selectedTaskBlocks]
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function doScheduleBlock(blockId: Id<"studyBlocks">) {
    setSchedulingBlockIds((prev) => new Set(prev).add(blockId));
    try {
      const result = await scheduleBlockAction({ studyBlockId: blockId, timezone });
      if ("error" in result) {
        onScheduleAllMsg("No valid slot found before the due date.", true);
      } else if (result.scheduled === 0) {
        onScheduleAllMsg("Block is already scheduled.", true);
      }
    } catch (err) {
      onScheduleAllMsg(
        `Failed to schedule: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSchedulingBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    }
  }

  function handleScheduleBlock(blockId: Id<"studyBlocks">) {
    onBeforeSchedule(() => doScheduleBlock(blockId));
  }

  async function handleSplitBlock(blockId: Id<"studyBlocks">) {
    const block = unscheduledBlocks.find((b) => b._id === blockId);
    if (!block) return;
    const splitAt = Math.floor(block.studyBlockLength / 2);
    const remaining = block.studyBlockLength - splitAt;
    if (splitAt < 15 || remaining < 15) {
      setSplitErrors((prev) =>
        new Map(prev).set(blockId, "Unable to split: each part must be at least 15 minutes.")
      );
      return;
    }
    setSplitErrors((prev) => {
      const next = new Map(prev);
      next.delete(blockId);
      return next;
    });
    setSplittingBlockIds((prev) => new Set(prev).add(blockId));
    try {
      await splitStudyBlockMutation({ studyBlockId: blockId, splitAtMinutes: splitAt });
    } catch (err) {
      setSplitErrors((prev) =>
        new Map(prev).set(blockId, err instanceof Error ? err.message : "Unable to split.")
      );
    } finally {
      setSplittingBlockIds((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
    }
  }

  function handleScheduleSelected() {
    if (!selectedTaskId) return;
    onBeforeSchedule(() => doScheduleAllBlocks());
  }

  async function doScheduleAllBlocks() {
    if (!selectedTaskId) return;
    setIsSchedulingAll(true);
    try {
      const result = await scheduleAllBlocksAction({ taskId: selectedTaskId, timezone });
      const base =
        result.skipped === 0
          ? `All ${result.scheduled} block${result.scheduled !== 1 ? "s" : ""} scheduled.`
          : `${result.scheduled} scheduled, ${result.skipped} skipped.`;
      const conflictNote =
        result.conflicted > 0
          ? ` ${result.conflicted} conflicted block${result.conflicted !== 1 ? "s" : ""} need${result.conflicted === 1 ? "s" : ""} auto-reschedule.`
          : "";
      onScheduleAllMsg(
        base + conflictNote,
        result.skipped > 0,
        result.skippedReasons?.length ? result.skippedReasons : undefined
      );
    } catch (err) {
      onScheduleAllMsg(
        `Scheduling failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsSchedulingAll(false);
    }
  }

  function goBack() {
    if (selectedTaskId) {
      setSelectedTaskId(null);
    } else {
      setSelectedCourseId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const asideClass = `flex shrink-0 flex-col border-t sm:border-t-0 sm:border-l border-border bg-white overflow-hidden transition-all duration-200 ${
    isCollapsed
      ? "w-full sm:w-10 max-h-10 sm:max-h-none"
      : "w-full sm:w-[240px] lg:w-[280px] max-h-[40vh] sm:max-h-none"
  }`;

  const toggleBtn = (
    <button
      type="button"
      onClick={() => setIsCollapsed((v) => !v)}
      className={`rounded p-1 text-light-blue hover:bg-bg-gray hover:text-slate-blue shrink-0 ${isCollapsed ? "mx-auto" : "ml-auto"}`}
      aria-label={isCollapsed ? "Expand classes panel" : "Collapse classes panel"}
    >
      {isCollapsed ? <ChevronLeftIcon size={12} /> : <ChevronRightIcon size={12} />}
    </button>
  );

  // Level 0 — class list
  if (!selectedCourseId) {
    return (
      <aside className={asideClass} data-tray>
        <div className="flex items-center px-3 py-2.5 border-b border-border shrink-0">
          {!isCollapsed && (
            <span className="text-[10px] font-semibold text-light-blue tracking-wider flex-1">
              CLASSES
            </span>
          )}
          {toggleBtn}
        </div>
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {courses === undefined ? (
              <div className="flex items-center justify-center py-8">
                <SpinnerIcon color="#4E6A8C" size={14} />
              </div>
            ) : (
              <>
                {currentCourses.length === 0 && (
                  <p className="px-4 py-4 text-xs text-light-blue">No current classes.</p>
                )}
                {currentCourses.map((course) => (
                  <button
                    key={course._id}
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(course._id);
                      setSelectedTaskId(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-bg-gray transition-colors border-b border-border"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: course.color ?? "navy" }}
                    />
                    <span className="flex flex-1 min-w-0 flex-col gap-0.5">
                      <span className="text-[10px] text-light-blue font-medium">
                        {course.courseCode}
                      </span>
                      <span className="truncate text-[12px] font-semibold text-navy">
                        {course.title}
                      </span>
                    </span>
                    <ChevronRightIcon size={12} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(OTHER_COURSE_KEY);
                    setSelectedTaskId(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-bg-gray transition-colors border-b border-border"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-light-blue" />
                  <span className="flex flex-1 min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] text-light-blue font-medium">OTHER</span>
                    <span className="truncate text-[12px] font-semibold text-navy">
                      Other tasks
                    </span>
                  </span>
                  <ChevronRightIcon size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    );
  }

  // Level 1 — task list for selected class
  if (!selectedTask) {
    const panelTitle =
      selectedCourseId === OTHER_COURSE_KEY ? "Other tasks" : (selectedCourse?.title ?? "");
    return (
      <aside className={asideClass} data-tray>
        <PanelHeader
          label="TASKS"
          title={panelTitle}
          onBack={goBack}
          toggleBtn={toggleBtn}
          isCollapsed={isCollapsed}
        />
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {tasksForSelectedCourse.length === 0 ? (
              <p className="px-4 py-4 text-xs text-light-blue">No tasks for this class.</p>
            ) : (
              tasksForSelectedCourse.map((task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => setSelectedTaskId(task._id as Id<"tasks">)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors border-b border-border hover:bg-bg-gray"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-light-blue" />
                  <span className="flex-1 min-w-0 truncate text-[12px] font-medium text-slate-blue">
                    {task.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-light-blue">
                    {new Date(task.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: timezone,
                    })}
                  </span>
                  <ChevronRightIcon size={11} />
                </button>
              ))
            )}
          </div>
        )}
      </aside>
    );
  }

  // Level 2 — task detail with subtasks + study blocks
  const subtasksList = subtasks ?? [];
  return (
    <aside className={asideClass} data-tray>
      <PanelHeader
        label="TASK"
        title={selectedTask.title}
        onBack={goBack}
        toggleBtn={toggleBtn}
        isCollapsed={isCollapsed}
      />

      {!isCollapsed && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {subtasks === undefined ? (
              <div className="flex items-center justify-center py-8">
                <SpinnerIcon color="#4E6A8C" size={14} />
              </div>
            ) : (
              <>
                {subtasksList.length === 0 && taskLevelBlocks.length === 0 && (
                  <p className="text-[11px] text-light-blue">No subtasks or unscheduled blocks.</p>
                )}

                {/* Subtasks — each with their study blocks underneath */}
                {subtasksList.map((sub) => {
                  const subBlocks = blocksBySubtask.get(sub._id as string) ?? [];
                  return (
                    <div key={sub._id} className="rounded-lg border border-border bg-white">
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-light-blue" />
                        <span className="flex-1 min-w-0 text-[11px] font-medium text-navy">
                          {sub.title}
                        </span>
                        {sub.timeEstimate !== undefined && (
                          <span className="shrink-0 text-[10px] text-light-blue">
                            {sub.timeEstimate} min
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 px-2.5 py-2">
                        {subBlocks.length === 0 ? (
                          <p className="px-1 text-[10px] text-light-blue">No unscheduled blocks.</p>
                        ) : (
                          subBlocks.map((block) => (
                            <BlockRow
                              key={block._id}
                              block={block}
                              isAssigning={assigningBlockId === block._id}
                              isScheduling={schedulingBlockIds.has(block._id)}
                              isSplitting={splittingBlockIds.has(block._id)}
                              splitError={splitErrors.get(block._id) ?? null}
                              onToggleAssign={onToggleAssign}
                              onSchedule={handleScheduleBlock}
                              onSplit={handleSplitBlock}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Task-level blocks (no subtask association) */}
                {taskLevelBlocks.length > 0 && (
                  <div className="rounded-lg border border-border bg-white">
                    <p className="border-b border-border px-3 py-2 text-[10px] font-semibold text-light-blue tracking-wider">
                      GENERAL BLOCKS
                    </p>
                    <div className="space-y-1.5 px-2.5 py-2">
                      {taskLevelBlocks.map((block) => (
                        <BlockRow
                          key={block._id}
                          block={block}
                          isAssigning={assigningBlockId === block._id}
                          isScheduling={schedulingBlockIds.has(block._id)}
                          isSplitting={splittingBlockIds.has(block._id)}
                          splitError={splitErrors.get(block._id) ?? null}
                          onToggleAssign={onToggleAssign}
                          onSchedule={handleScheduleBlock}
                          onSplit={handleSplitBlock}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Schedule button */}
          <div className="border-t border-border p-4 shrink-0">
            <button
              type="button"
              onClick={handleScheduleSelected}
              disabled={isSchedulingAll || selectedTaskBlocks.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSchedulingAll && <SpinnerIcon color="currentColor" size={12} />}
              <CalendarIcon color="currentColor" size={13} />
              Schedule (up to 10 blocks)
            </button>
            {selectedTaskBlocks.length === 0 && !isSchedulingAll && (
              <p className="mt-1.5 text-center text-[10px] text-light-blue">All blocks scheduled</p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// PanelHeader — shared drill-down header with back button
// ---------------------------------------------------------------------------
function PanelHeader({
  label,
  title,
  onBack,
  toggleBtn,
  isCollapsed,
}: {
  label: string;
  title: string;
  onBack: () => void;
  toggleBtn: React.ReactNode;
  isCollapsed: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 shrink-0">
      {!isCollapsed && (
        <button
          type="button"
          onClick={onBack}
          className="rounded p-1 text-light-blue hover:bg-bg-gray hover:text-slate-blue"
          aria-label="Back"
        >
          <ChevronLeftIcon size={14} />
        </button>
      )}
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-light-blue tracking-wider">{label}</p>
          <p className="truncate text-[12px] font-semibold text-navy">{title}</p>
        </div>
      )}
      {toggleBtn}
    </div>
  );
}
