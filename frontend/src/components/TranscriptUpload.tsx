import { useRef, useState } from 'react'
import Button from './ui/Button'

function UploadIcon() {
  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-sky-blue"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

interface TranscriptUploadProps {
  onFileChange: (file: File | null) => void
}

export default function TranscriptUpload({ onFileChange }: TranscriptUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    setFile(f)
    onFileChange(f)
  }

  const handleRemove = () => {
    setFile(null)
    onFileChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <label className="font-heading text-sm font-semibold text-navy">Upload Transcript</label>
        <span className="font-body text-xs text-light-blue">(optional)</span>
      </div>
      <p className="font-body text-xs text-slate-blue">
        Upload your JHU transcript to auto-fill your courses
      </p>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-gray px-3 py-2.5">
          <div className="flex items-center gap-2 text-navy">
            <FileIcon />
            <span className="font-body text-sm font-medium truncate">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="font-body text-xs text-light-blue hover:text-urgent-red transition-colors shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
            dragging ? 'border-sky-blue bg-sky-blue/5' : 'border-border bg-bg-gray'
          }`}
        >
          <UploadIcon />
          <div className="flex flex-col items-center gap-1">
            <p className="font-body text-sm font-medium text-slate-blue">
              Drag &amp; drop your transcript here
            </p>
            <p className="font-body text-xs text-light-blue">or</p>
          </div>
          <Button
            variant="primary"
            onClick={() => inputRef.current?.click()}
            className="px-5"
          >
            Browse Files
          </Button>
          <p className="font-body text-xs text-light-blue">Supports PDF · Max 10 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </div>
      )}
    </div>
  )
}
