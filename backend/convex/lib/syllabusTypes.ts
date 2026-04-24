import { Id } from "../_generated/dataModel";
import { TaskType } from "./taskValidators";

export type ExtractedTask = {
  title: string;
  description: string;
  dueDate: number;
  taskType: TaskType;
  assignmentWeight?: number;
};

export type UploadSyllabusResult = {
  syllabusId: Id<"syllabi">;
  extractedTasks: ExtractedTask[];
};
