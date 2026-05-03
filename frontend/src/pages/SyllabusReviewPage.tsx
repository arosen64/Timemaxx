import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { api } from "../../../backend/convex/_generated/api";
import { Id } from "../../../backend/convex/_generated/dataModel";
import Sidebar from "../components/Sidebar";
import { CheckCircleIcon, InfoIcon, PlusIcon } from "../components/icons";
import Button from "../components/ui/Button";
import TaskReviewCard from "../components/syllabus/TaskReviewCard";
import { TASK_TYPE_OPTIONS } from "../components/dashboard/types";
import { type ReviewTask } from "../components/syllabus/types";
import {
  combineDateMsWithTime,
  DEFAULT_DUE_TIME,
  formDateToMs,
  msToFormDate,
  msToTimeInputValue,
  validateDueDateAndTime,
} from "../validators";
import { type Course, type ExtractedTask } from "../types";

interface ReviewLocationState {
  syllabusId: Id<"syllabi">;
  extractedTasks: ExtractedTask[];
  course: Course;
}

let nextTaskId = 0;

function makeEmptyTask(): ReviewTask {
  return {
    id: nextTaskId++,
    title: "",
    description: "",
    taskType: TASK_TYPE_OPTIONS[0],
    dueDate: "",
    dueTime: DEFAULT_DUE_TIME,
  };
}

export default function SyllabusReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ReviewLocationState | null;

  const confirmSyllabusTasks = useMutation(api.mutations.syllabi.confirmSyllabusTasks);

  const [tasks, setTasks] = useState<ReviewTask[]>(() => {
    const initialTasks = state?.extractedTasks ?? [];
    return initialTasks.map((t) => ({
      id: nextTaskId++,
      title: t.title,
      description: t.description,
      taskType: t.taskType,
      dueDate: msToFormDate(t.dueDate),
      dueTime: msToTimeInputValue(t.dueDate),
      assignmentWeight: t.assignmentWeight,
    }));
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) {
    return <Navigate to="/classes" replace />;
  }

  const { syllabusId } = state;

  function updateTask(index: number, updated: ReviewTask) {
    setTasks((prev) => prev.map((t, i) => (i === index ? updated : t)));
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function addTask() {
    setTasks((prev) => [...prev, makeEmptyTask()]);
  }

  async function handleConfirm() {
    setError(null);

    const toSave: Array<{
      title: string;
      description: string;
      taskType: (typeof TASK_TYPE_OPTIONS)[number];
      dueDate: number;
      assignmentWeight?: number;
    }> = [];
    for (const t of tasks) {
      if (!t.title.trim()) {
        setError("One or more tasks is missing a title.");
        return;
      }
      const validationError = validateDueDateAndTime(t.dueDate, t.dueTime);
      if (validationError) {
        setError(`"${t.title || "Unnamed task"}": ${validationError}`);
        return;
      }
      if (
        t.assignmentWeight !== undefined &&
        (!Number.isFinite(t.assignmentWeight) || t.assignmentWeight < 0 || t.assignmentWeight > 100)
      ) {
        setError(`"${t.title || "Unnamed task"}": Grade weight must be between 0 and 100.`);
        return;
      }
      const dateMs = formDateToMs(t.dueDate)!;
      const ms = combineDateMsWithTime(dateMs, t.dueTime)!;
      toSave.push({
        title: t.title.trim(),
        description: t.description,
        taskType: t.taskType,
        dueDate: ms,
        assignmentWeight: t.assignmentWeight,
      });
    }

    const totalWeight = toSave.reduce((sum, t) => sum + (t.assignmentWeight ?? 0), 0);
    if (totalWeight > 100) {
      const rounded = Math.round(totalWeight * 10) / 10;
      const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      setError(`Assignment weights sum to ${display}% — total cannot exceed 100%.`);
      return;
    }

    setIsConfirming(true);
    try {
      await confirmSyllabusTasks({ syllabusId, tasks: toSave });
      navigate("/classes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="flex h-screen bg-bg-gray">
      <Sidebar />

      <main className="flex flex-col flex-1 min-h-0 p-10 overflow-y-auto gap-7">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold font-heading text-navy">Review Extracted Tasks</h1>
            <p className="max-w-xl text-sm font-body text-slate-blue">
              {`Review tasks extracted from your ${state.course.title} syllabus. Edit or remove any task before confirming.`}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-lg bg-success-light px-3 py-1.5 font-body text-[13px] font-semibold text-success">
            <CheckCircleIcon />
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} ready to confirm
          </span>
        </div>

        {/* Task list */}
        <div className="flex flex-col gap-3">
          {tasks.map((task, i) => (
            <TaskReviewCard
              key={task.id}
              task={task}
              onChange={(updated) => updateTask(i, updated)}
              onRemove={() => removeTask(i)}
            />
          ))}

          <Button variant="primary" onClick={addTask} icon={<PlusIcon />} className="w-full">
            Add another task
          </Button>
        </div>

        {/* Validation error */}
        {error && <p className="text-sm font-body text-urgent-red">{error}</p>}

        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-4 mt-auto bg-white border rounded-lg border-border">
          <span className="flex items-center gap-1.5 font-body text-[13px] text-slate-blue">
            <InfoIcon />
            {`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} will be added to your dashboard`}
          </span>
          <div className="flex gap-2.5">
            <Button variant="destructive" onClick={() => navigate("/classes")} className="px-6">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={isConfirming || tasks.length === 0}
              className="px-5"
            >
              {isConfirming ? "Confirming…" : "Confirm Tasks"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
