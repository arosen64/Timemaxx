import { useEffect, useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../backend/convex/_generated/api";
import { type Id } from "../../../../backend/convex/_generated/dataModel";
import { type GeneratedSubtask } from "../../../../backend/convex/ai/generateSubtasks";
import {
  type ClassTagCourseOption,
  type EditForm,
  CUSTOM_TASK_TYPE_OPTION,
  TASK_TYPE_OPTIONS,
} from "./types";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Selector from "../ui/Selector";
import DatetimePicker from "../ui/DatetimePicker";
import SubtaskReviewModal from "./SubtaskReviewModal";
import { parseDueDateInput, combineDateMsWithTime } from "../../validators";
import { legacyNaiveClassTag } from "../../utils/classTagUtils";

const EMPTY_CLASS_TAG_COURSES: ClassTagCourseOption[] = [];

/** Map legacy duplicate-prefix tags to canonical `classTag` so the select value matches. */
function migrateClassTagToCanonical(raw: string, courses: ClassTagCourseOption[]): string {
  const t = raw.trim();
  if (!t) return "";
  for (const c of courses) {
    if (t === c.classTag) return c.classTag;
    if (t === legacyNaiveClassTag(c.courseCode, c.title)) return c.classTag;
  }
  return "";
}

function allowedClassTagValue(raw: string, courses: ClassTagCourseOption[]): string {
  const canonical = migrateClassTagToCanonical(raw, courses);
  const allowed = new Set(courses.map((c) => c.classTag));
  return allowed.has(canonical) ? canonical : "";
}

interface TaskModalProps {
  isOpen?: boolean;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryLoadingLabel: string;
  initialValues: {
    taskName: string;
    selectedType: string;
    customTaskType: string;
    description: string;
    dueDate: string;
    dueTime: string;
    classTag: string;
    timeEstimate: string;
    /** Grade weight as a string (e.g. "20"); empty string means no weight. Optional for backward compatibility. */
    assignmentWeight?: string;
  };
  /** Current-term classes; class tag may only be empty or one of these (optional field) */
  classTagCourses?: ClassTagCourseOption[];
  /** When true, hides the entire subtask generation section (e.g. when editing a subtask) */
  hideSubtaskGeneration?: boolean;
  /** When true, hides the assignment-weight input (e.g. when editing a subtask) */
  hideAssignmentWeight?: boolean;
  /** When > 0, show Delete/Regenerate subtask buttons instead of the generate checkbox */
  existingSubtaskCount?: number;
  /** Task ID for regenerating subtasks on an already-saved task */
  existingTaskId?: Id<"tasks">;
  /** Course ID for regenerating subtasks (determines color assignment) */
  existingCourseId?: Id<"userCourses">;
  /** Called when user clicks "Delete subtasks" */
  onDeleteSubtasks?: () => Promise<void>;
  /** Existing tasks used to validate per-course assignment-weight totals. */
  existingTasks?: Array<{
    _id: Id<"tasks">;
    courseId?: Id<"userCourses">;
    assignmentWeight?: number;
  }>;
  onClose: () => void;
  /** Return the created/updated taskId when generating subtasks; void for normal flow */
  onSubmit: (form: EditForm) => Promise<string | void>;
}

export default function TaskModal({
  isOpen,
  title,
  subtitle,
  primaryLabel,
  primaryLoadingLabel,
  initialValues,
  classTagCourses,
  hideSubtaskGeneration = false,
  hideAssignmentWeight = false,
  existingSubtaskCount,
  existingTaskId,
  existingCourseId,
  existingTasks = [],
  onDeleteSubtasks,
  onClose,
  onSubmit,
}: TaskModalProps) {
  const courses = classTagCourses ?? EMPTY_CLASS_TAG_COURSES;
  const [taskName, setTaskName] = useState(initialValues.taskName);
  const [selectedType, setSelectedType] = useState(initialValues.selectedType);
  const [customTaskType, setCustomTaskType] = useState(initialValues.customTaskType);
  const [description, setDescription] = useState(initialValues.description);
  const [dueDatetime, setDueDatetime] = useState<Date | undefined>(() => {
    const ms = parseDueDateInput(initialValues.dueDate);
    if (ms === null) return undefined;
    return new Date(combineDateMsWithTime(ms, initialValues.dueTime) ?? ms);
  });
  const [classTag, setClassTag] = useState(() =>
    allowedClassTagValue(initialValues.classTag, courses)
  );
  const [estimateHours, setEstimateHours] = useState(() => {
    const mins = parseInt(initialValues.timeEstimate, 10);
    return isNaN(mins) ? "" : String(Math.floor(mins / 60));
  });
  const [estimateMinutes, setEstimateMinutes] = useState(() => {
    const mins = parseInt(initialValues.timeEstimate, 10);
    return isNaN(mins) ? "" : String(mins % 60);
  });
  // Default to AI mode when there is no pre-existing manual estimate to show.
  const [useAiEstimate, setUseAiEstimate] = useState(() =>
    isNaN(parseInt(initialValues.timeEstimate, 10))
  );
  const [assignmentWeight, setAssignmentWeight] = useState(initialValues.assignmentWeight ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateSubtasks, setGenerateSubtasks] = useState(false);
  const [generatingSubtasks, setGeneratingSubtasks] = useState(false);
  const [deletingSubtasks, setDeletingSubtasks] = useState(false);
  const [pendingSubtasks, setPendingSubtasks] = useState<GeneratedSubtask[] | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<Id<"tasks"> | null>(null);
  const [pendingCourseId, setPendingCourseId] = useState<Id<"userCourses"> | undefined>(undefined);

  // Safe because AddTaskModal/EditTaskModal pass a `key` that re-mounts this
  // component on task switch, resetting prevClassTagRef to the new initial value.
  const prevClassTagRef = useRef(classTag);
  useEffect(() => {
    const prev = prevClassTagRef.current;
    prevClassTagRef.current = classTag;
    if (!classTag && prev) setAssignmentWeight("");
  }, [classTag]);

  const requestGenerateSubtasks = useAction(
    api.functions.requestGenerateSubtasks.requestGenerateSubtasks
  );

  // useAiEstimate is the single source of truth for AI vs manual mode.
  const isInManualMode = !useAiEstimate;

  const classTagSelectOptions = useMemo(
    () =>
      courses.map((c) => ({
        label: c.classTag,
        value: c.classTag,
      })),
    [courses]
  );
  const selectedCourseId = useMemo(() => {
    const resolvedClassTag = allowedClassTagValue(classTag, courses);
    return courses.find((c) => c.classTag === resolvedClassTag)?.courseId;
  }, [classTag, courses]);

  useEffect(() => {
    if (!isOpen) return;
    setTaskName(initialValues.taskName);
    setSelectedType(initialValues.selectedType);
    setCustomTaskType(initialValues.customTaskType);
    setDescription(initialValues.description);
    const ms = parseDueDateInput(initialValues.dueDate);
    setDueDatetime(
      ms !== null ? new Date(combineDateMsWithTime(ms, initialValues.dueTime) ?? ms) : undefined
    );
    setClassTag(allowedClassTagValue(initialValues.classTag, courses));
    const mins = parseInt(initialValues.timeEstimate, 10);
    setEstimateHours(isNaN(mins) ? "" : String(Math.floor(mins / 60)));
    setEstimateMinutes(isNaN(mins) ? "" : String(mins % 60));
    setUseAiEstimate(isNaN(mins));
    setAssignmentWeight(initialValues.assignmentWeight ?? "");
    setError(null);
    setSubmitting(false);
    setGenerateSubtasks(false);
    setGeneratingSubtasks(false);
    setDeletingSubtasks(false);
    setPendingSubtasks(null);
    setPendingTaskId(null);
    setPendingCourseId(undefined);
  }, [
    isOpen,
    initialValues.taskName,
    initialValues.selectedType,
    initialValues.customTaskType,
    initialValues.description,
    initialValues.dueDate,
    initialValues.dueTime,
    initialValues.classTag,
    initialValues.timeEstimate,
    initialValues.assignmentWeight,
    courses,
  ]);

  async function handleDeleteSubtasks() {
    if (!onDeleteSubtasks) return;
    setDeletingSubtasks(true);
    try {
      await onDeleteSubtasks();
    } finally {
      setDeletingSubtasks(false);
    }
  }

  async function handleRegenerateSubtasks() {
    if (!existingTaskId) return;
    setGeneratingSubtasks(true);
    setError(null);
    try {
      // Delete existing subtasks first so regeneration doesn't create duplicates
      if (onDeleteSubtasks) await onDeleteSubtasks();
      const result = await requestGenerateSubtasks({ taskId: existingTaskId });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPendingTaskId(existingTaskId);
      setPendingCourseId(existingCourseId);
      setPendingSubtasks(result.subtasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate subtasks.");
    } finally {
      setGeneratingSubtasks(false);
    }
  }

  async function handleSubmit() {
    if (!taskName.trim()) {
      setError("Please enter a task name.");
      return;
    }
    if (!selectedType.trim()) {
      setError("Please select a task type.");
      return;
    }
    const resolvedTaskType =
      selectedType === CUSTOM_TASK_TYPE_OPTION ? customTaskType.trim() : selectedType;
    if (!resolvedTaskType) {
      setError("Please enter a task type.");
      return;
    }
    if (!description.trim()) {
      setError("Please enter a description.");
      return;
    }
    if (!dueDatetime) {
      setError("Please pick a due date and time.");
      return;
    }
    if (dueDatetime.getTime() <= Date.now()) {
      setError("Due date must be in the future.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const resolvedClassTag = allowedClassTagValue(classTag, courses);
      const courseId = courses.find((c) => c.classTag === resolvedClassTag)?.courseId;
      const dueMs = dueDatetime.getTime();
      const hrs = parseInt(estimateHours, 10);
      const mins = parseInt(estimateMinutes, 10);
      const totalMinutes =
        !isNaN(hrs) || !isNaN(mins) ? (isNaN(hrs) ? 0 : hrs) * 60 + (isNaN(mins) ? 0 : mins) : NaN;
      const parsedEstimate =
        !useAiEstimate && !isNaN(totalMinutes) && totalMinutes > 0 ? totalMinutes : undefined;
      if (parsedEstimate !== undefined && parsedEstimate < 15) {
        setError("Time estimate must be at least 15 minutes.");
        setSubmitting(false);
        return;
      }
      const trimmedWeight = assignmentWeight.trim();
      let parsedWeight: number | undefined;
      const shouldClearAssignmentWeight =
        existingTaskId !== undefined &&
        initialValues.assignmentWeight !== undefined &&
        initialValues.assignmentWeight.trim() !== "" &&
        trimmedWeight === "";
      if (courseId !== undefined && trimmedWeight !== "") {
        const w = Number(trimmedWeight);
        if (!Number.isFinite(w) || w < 0 || w > 100) {
          setError("Assignment weight must be between 0 and 100.");
          setSubmitting(false);
          return;
        }
        parsedWeight = w;
      }
      if (courseId !== undefined && parsedWeight !== undefined) {
        const existingWeightTotal = existingTasks.reduce((sum, task) => {
          if (task._id === existingTaskId) return sum;
          if (task.courseId !== courseId) return sum;
          const weight = task.assignmentWeight;
          if (typeof weight !== "number" || !Number.isFinite(weight)) return sum;
          return sum + weight;
        }, 0);
        const projectedTotal = existingWeightTotal + parsedWeight;
        if (projectedTotal > 100) {
          const roundedExistingTotal = Math.round(existingWeightTotal * 10) / 10;
          const existingTotalDisplay = Number.isInteger(roundedExistingTotal)
            ? String(roundedExistingTotal)
            : roundedExistingTotal.toFixed(1);
          setError(
            `Assignments for this course already sum to ${existingTotalDisplay}% of the grade. Total course weight cannot exceed 100%.`
          );
          setSubmitting(false);
          return;
        }
      }
      const form: EditForm = {
        title: taskName,
        description,
        taskType: resolvedTaskType,
        dueDate: dueMs,
        ...(courseId !== undefined ? { courseId } : {}),
        classTag: resolvedClassTag,
        ...(parsedEstimate !== undefined && !isNaN(parsedEstimate) && parsedEstimate > 0
          ? { timeEstimate: parsedEstimate }
          : {}),
        ...(useAiEstimate ? { useAiEstimate: true } : {}),
        ...(parsedWeight !== undefined ? { assignmentWeight: parsedWeight } : {}),
        ...(shouldClearAssignmentWeight ? { clearAssignmentWeight: true } : {}),
      };

      if (generateSubtasks) {
        const taskId = await onSubmit(form);
        if (!taskId) {
          setError("Failed to create task. Please try again.");
          return;
        }
        setGeneratingSubtasks(true);
        const result = await requestGenerateSubtasks({ taskId: taskId as Id<"tasks"> });
        setGeneratingSubtasks(false);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setPendingTaskId(taskId as Id<"tasks">);
        setPendingCourseId(courseId);
        setPendingSubtasks(result.subtasks);
        // Don't call onClose — SubtaskReviewModal takes over
      } else {
        await onSubmit(form);
        onClose();
      }
    } catch (e) {
      setGeneratingSubtasks(false);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        subtitle={subtitle}
        error={error}
        primaryLabel={primaryLabel}
        primaryLoadingLabel={generatingSubtasks ? "Generating subtasks…" : primaryLoadingLabel}
        onPrimary={handleSubmit}
        isPrimaryDisabled={submitting || generatingSubtasks}
      >
        <div className="flex w-full flex-col gap-5">
          {/* Task name */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Task name</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Calculus Problem Set 5"
              className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
            />
          </div>

          {/* Task type */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Task type</label>
            <div className="flex flex-wrap gap-2">
              {[...TASK_TYPE_OPTIONS, CUSTOM_TASK_TYPE_OPTION].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex h-9 cursor-pointer items-center justify-center rounded-md px-3.5 font-body text-[13px] ${
                    selectedType === type
                      ? "border-none bg-navy font-semibold text-white"
                      : "border border-border bg-bg-gray font-normal text-slate-blue"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {selectedType === CUSTOM_TASK_TYPE_OPTION && (
              <input
                type="text"
                value={customTaskType}
                onChange={(e) => setCustomTaskType(e.target.value)}
                placeholder="Enter other task type"
                className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
              />
            )}
          </div>

          {/* Class tag — native select like term/school on Classes page; only empty or a listed class */}
          <div className="flex w-full flex-col gap-1.5">
            <div>
              <label className="font-heading text-[13px] font-semibold text-navy">
                Class tag <span className="font-normal text-light-blue">(optional)</span>
              </label>
              {courses.length > 0 ? (
                <p className="mt-0.5 font-body text-xs text-light-blue">
                  Choose one of your current classes, or leave blank
                </p>
              ) : (
                <p className="mt-0.5 font-body text-xs text-light-blue">
                  Add classes for the current term on the Classes page to tag tasks
                </p>
              )}
            </div>
            {courses.length > 0 ? (
              <Selector
                className="w-full"
                value={classTag}
                onChange={setClassTag}
                options={classTagSelectOptions}
                placeholder="Select a class (optional)"
              />
            ) : (
              <div className="rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-light-blue">
                No current-term classes
              </div>
            )}
          </div>

          {/* Assignment weight — percentage of final grade (optional) */}
          {!hideAssignmentWeight && selectedCourseId !== undefined && (
            <div className="flex w-full flex-col gap-1.5">
              <label
                htmlFor="task-assignment-weight"
                className="font-heading text-[13px] font-semibold text-navy"
              >
                Grade weight <span className="font-normal text-light-blue">(optional)</span>
              </label>
              <p className="-mt-0.5 font-body text-xs text-light-blue">
                What percentage of your final grade is this assignment worth?
              </p>
              <div className="relative w-32">
                <input
                  id="task-assignment-weight"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  inputMode="decimal"
                  value={assignmentWeight}
                  onChange={(e) => {
                    setAssignmentWeight(e.target.value);
                    setError(null);
                  }}
                  placeholder="—"
                  className="h-11 w-full rounded-md border border-border bg-bg-gray pl-3.5 pr-8 font-body text-sm text-navy outline-none placeholder:text-light-blue"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-body text-sm text-light-blue">
                  %
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste or type your assignment description here..."
              className="h-24 w-full resize-none rounded-md border border-border bg-bg-gray px-3.5 py-2.5 font-body text-sm leading-normal text-navy outline-none placeholder:text-light-blue"
            />
          </div>

          {/* Subtasks section — hidden for subtask editing; delete/regenerate when subtasks exist, checkbox when none */}
          {!hideSubtaskGeneration &&
            (existingSubtaskCount !== undefined && existingSubtaskCount > 0 ? (
              <div className="flex flex-col gap-1.5">
                <label className="font-heading text-[13px] font-semibold text-navy">
                  Subtasks{" "}
                  <span className="font-normal text-light-blue">({existingSubtaskCount})</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteSubtasks}
                    disabled={deletingSubtasks || generatingSubtasks || submitting}
                    className="flex flex-1 items-center justify-center rounded-md border border-urgent-red/30 bg-bg-gray px-3 py-2 font-body text-xs font-semibold text-urgent-red transition hover:bg-urgent-red-light disabled:opacity-50"
                  >
                    {deletingSubtasks ? "Deleting…" : "Delete subtasks"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateSubtasks}
                    disabled={deletingSubtasks || generatingSubtasks || submitting}
                    className="flex flex-1 items-center justify-center rounded-md border border-border bg-bg-gray px-3 py-2 font-body text-xs font-semibold text-slate-blue transition hover:bg-white hover:text-navy disabled:opacity-50"
                  >
                    {generatingSubtasks ? "Generating…" : "Regenerate subtasks"}
                  </button>
                </div>
              </div>
            ) : isInManualMode ? (
              <div className="flex flex-col gap-1">
                <label className="font-heading text-[13px] font-semibold text-navy">Subtasks</label>
                <p className="font-body text-xs text-light-blue">
                  AI subtask generation is unavailable with a manual time estimate. Switch to AI
                  estimate to enable it.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <div
                    onClick={() => setGenerateSubtasks((v) => !v)}
                    className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border ${
                      generateSubtasks ? "border-navy bg-navy" : "border-border bg-bg-gray"
                    }`}
                  >
                    {generateSubtasks && (
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                        <path
                          d="M1 4l3 3 6-6"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => setGenerateSubtasks((v) => !v)}
                    className="font-heading text-[13px] font-semibold text-navy"
                  >
                    Generate subtasks with AI
                  </span>
                </label>
                <p className="pl-[26px] font-body text-xs text-light-blue">
                  AI will break your task into steps
                </p>
              </div>
            ))}

          {/* Due date & time — default time 11:59 PM for new tasks */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="font-heading text-[13px] font-semibold text-navy">
              Due date & time
            </label>
            <DatetimePicker
              value={dueDatetime}
              onChange={(d) => {
                setDueDatetime(d);
                setError(null);
              }}
              placeholder="Pick a due date & time"
              minDate={new Date()}
            />
          </div>

          {/* Time estimate override — hidden when AI subtask generation is enabled */}
          <div className={`flex w-full flex-col gap-1.5 ${generateSubtasks ? "hidden" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <label className="font-heading text-[13px] font-semibold text-navy">
                  Time estimate <span className="font-normal text-light-blue">(optional)</span>
                </label>
              </div>
              {!useAiEstimate && (
                <Button
                  variant="outline"
                  className="h-7 px-3 text-xs font-body font-medium"
                  onClick={() => {
                    setUseAiEstimate(true);
                    setEstimateHours("");
                    setEstimateMinutes("");
                  }}
                >
                  Use AI Estimate
                </Button>
              )}
              {useAiEstimate && (
                <Button
                  variant="outline"
                  className="h-7 px-3 text-xs font-body font-medium text-slate-blue"
                  onClick={() => {
                    setUseAiEstimate(false);
                    setGenerateSubtasks(false);
                  }}
                >
                  Set manually
                </Button>
              )}
            </div>
            {!useAiEstimate && existingSubtaskCount !== undefined && existingSubtaskCount > 0 && (
              <p className="font-body text-xs text-burnt-orange">
                Saving will delete your {existingSubtaskCount} existing subtask
                {existingSubtaskCount !== 1 ? "s" : ""} and their scheduled blocks.
              </p>
            )}
            {useAiEstimate ? (
              <div className="rounded-lg border border-border bg-bg-gray px-3.5 py-3 font-body text-sm text-light-blue">
                AI will estimate after saving
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-body text-xs font-medium text-slate-blue"
                    htmlFor="task-estimate-hours"
                  >
                    Hours
                  </label>
                  <input
                    id="task-estimate-hours"
                    type="number"
                    min="0"
                    value={estimateHours}
                    onChange={(e) => setEstimateHours(e.target.value)}
                    placeholder="0"
                    className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    className="font-body text-xs font-medium text-slate-blue"
                    htmlFor="task-estimate-minutes"
                  >
                    Minutes
                  </label>
                  <input
                    id="task-estimate-minutes"
                    type="number"
                    min="0"
                    max="59"
                    value={estimateMinutes}
                    onChange={(e) => setEstimateMinutes(e.target.value)}
                    placeholder="0"
                    className="h-11 w-full rounded-md border border-border bg-bg-gray px-3.5 font-body text-sm text-navy outline-none placeholder:text-light-blue"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
      {pendingSubtasks && pendingTaskId && (
        <SubtaskReviewModal
          isOpen={true}
          subtasks={pendingSubtasks}
          parentTaskId={pendingTaskId}
          courseId={pendingCourseId}
          onClose={() => {
            setPendingSubtasks(null);
            setPendingTaskId(null);
            setPendingCourseId(undefined);
            onClose();
          }}
        />
      )}
    </>
  );
}
