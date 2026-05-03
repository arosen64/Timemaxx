import { useState } from "react";
import { TrashIcon } from "../icons";
import { type TaskType, displayTitle } from "./types";
import { Modal } from "../ui";

export default function DeleteModal({
  isOpen,
  task,
  onClose,
  onConfirm,
  subtaskCount = 0,
}: {
  isOpen: boolean;
  task: TaskType | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  subtaskCount?: number;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen && task !== null}
      onClose={onClose}
      title="Delete Task?"
      icon={<TrashIcon color="#CF4520" />}
      primaryLabel="Delete"
      primaryLoadingLabel="Deleting…"
      onPrimary={handleConfirm}
      isPrimaryDisabled={deleting}
      primaryVariant="destructive"
      showCloseButton={false}
      size="sm"
      backdrop="blur"
    >
      <p className="text-sm leading-relaxed text-slate-blue">
        <span className="font-semibold text-navy">"{task ? displayTitle(task) : ""}"</span> will be
        permanently deleted. This cannot be undone.
        {subtaskCount > 0 && (
          <span className="mt-1 block text-slate-blue">
            This will also delete {subtaskCount} subtask{subtaskCount !== 1 ? "s" : ""}.
          </span>
        )}
      </p>
    </Modal>
  );
}
