import { DEFAULT_DUE_TIME, msToTimeInputValue } from "../../validators";
import {
  type ClassTagCourseOption,
  type TaskType,
  type EditForm,
  TASK_TYPE_OPTIONS,
  CUSTOM_TASK_TYPE_OPTION,
  formatDateMMDDYYYY,
} from "./types";
import TaskModal from "./TaskModal";

export default function EditModal({
  isOpen,
  task,
  onClose,
  onSave,
  classTagCourses,
  title = "Edit task",
  subtitle = "Update the details below.",
  existingSubtaskCount,
  onDeleteSubtasks,
  hideSubtaskGeneration = false,
}: {
  isOpen: boolean;
  task: TaskType | null;
  onClose: () => void;
  onSave: (form: EditForm) => Promise<void>;
  classTagCourses?: ClassTagCourseOption[];
  title?: string;
  subtitle?: string;
  existingSubtaskCount?: number;
  onDeleteSubtasks?: () => Promise<void>;
  hideSubtaskGeneration?: boolean;
}) {
  return (
    <TaskModal
      key={task?._id}
      isOpen={isOpen && task !== null}
      title={title}
      subtitle={subtitle}
      primaryLabel="Save Changes"
      primaryLoadingLabel="Saving…"
      existingSubtaskCount={existingSubtaskCount}
      existingTaskId={task?._id ?? undefined}
      existingCourseId={task?.courseId ?? undefined}
      onDeleteSubtasks={onDeleteSubtasks}
      hideSubtaskGeneration={hideSubtaskGeneration}
      initialValues={{
        taskName: task?.title ?? "",
        selectedType:
          task && TASK_TYPE_OPTIONS.includes(task.taskType as (typeof TASK_TYPE_OPTIONS)[number])
            ? task.taskType
            : CUSTOM_TASK_TYPE_OPTION,
        customTaskType:
          task && TASK_TYPE_OPTIONS.includes(task.taskType as (typeof TASK_TYPE_OPTIONS)[number])
            ? ""
            : (task?.taskType ?? ""),
        description: task?.description ?? "",
        dueDate: task ? formatDateMMDDYYYY(task.dueDate) : "",
        dueTime: task ? msToTimeInputValue(task.dueDate) : DEFAULT_DUE_TIME,
        classTag: task?.classTag ?? "",
        timeEstimate:
          task?.isManualEstimate && task?.timeEstimate !== undefined
            ? String(task.timeEstimate)
            : "",
      }}
      classTagCourses={classTagCourses}
      onClose={onClose}
      onSubmit={async (form) => {
        await onSave(form);
        return task!._id;
      }}
    />
  );
}
