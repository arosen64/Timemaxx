import Modal from "../ui/Modal";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  async function handleConfirm() {
    await onConfirm();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Account?"
      primaryVariant="destructive"
      primaryLabel="Delete Account"
      onPrimary={handleConfirm}
      size="sm"
      backdrop="blur"
      showCloseButton={false}
    >
      <p className="text-sm leading-relaxed text-slate-blue">
        Your account and all associated data will be permanently deleted.{" "}
        <span className="font-semibold text-navy">This cannot be undone.</span>
      </p>
    </Modal>
  );
}
