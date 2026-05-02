import { useRef, useState } from "react";
import { FileIcon, UploadIcon } from "../icons";

interface FileUploadProps {
  accept: string;
  acceptedMimeTypes: string[];
  maxBytes: number;
  hint: string;
  file: File | null;
  onFile: (file: File) => void;
  onError: (message: string) => void;
  onRemove: () => void;
}

export default function FileUpload({
  accept,
  acceptedMimeTypes,
  maxBytes,
  hint,
  file,
  onFile,
  onError,
  onRemove,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(f: File): string | null {
    if (!acceptedMimeTypes.includes(f.type)) return `Unsupported file type. Accepted: ${hint}`;
    if (f.size > maxBytes)
      return `File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`;
    return null;
  }

  function pick(f: File) {
    const err = validate(f);
    if (err) {
      onError(err);
    } else {
      onFile(f);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pick(dropped);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) pick(selected);
    e.target.value = "";
  }

  if (file) {
    return (
      <div className="flex items-center justify-between w-full rounded-lg border border-border bg-bg-gray px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon color="#8FA6C2" />
          <span className="truncate text-sm font-body text-navy">{file.name}</span>
          <span className="shrink-0 text-xs font-body text-slate-blue">
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove file"
          className="ml-3 shrink-0 text-slate-blue hover:text-navy transition text-lg leading-none"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload file drop zone"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer transition gap-2 ${
        isDragging ? "border-teal bg-teal/5" : "border-border bg-bg-gray hover:border-light-blue"
      }`}
    >
      <UploadIcon color="#8FA6C2" />
      <p className="text-sm font-body text-slate-blue">
        Drag & drop or{" "}
        <span className="text-teal font-semibold underline underline-offset-2">browse</span>
      </p>
      <p className="text-xs font-body text-light-blue">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
