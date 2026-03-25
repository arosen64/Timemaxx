import { useState } from 'react'
import Modal from '../ui/Modal'
import FileUpload from '../ui/FileUpload'
import { SpinnerIcon } from '../icons'

type Mode = 'upload' | 'text'

interface SyllabusUploadModalProps {
  isOpen: boolean
  onClose: () => void
  /** Course name shown in the subtitle, e.g. "CS 101". */
  courseName?: string
  /** Called with the validated File when the user confirms an upload. */
  onUpload: (file: File) => Promise<void>
  /** Called with the pasted/typed text when the user uses the text fallback. */
  onTextSubmit: (text: string) => Promise<void>
}

export default function SyllabusUploadModal({
  isOpen,
  onClose,
  courseName,
  onUpload,
  onTextSubmit,
}: SyllabusUploadModalProps) {
  const [mode, setMode] = useState<Mode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setFile(null)
    setText('')
    setError(null)
  }

  function handleClose() {
    setMode('upload')
    setFile(null)
    setText('')
    setError(null)
    setIsSubmitting(false)
    onClose()
  }

  async function handlePrimary() {
    setError(null)
    try {
      setIsSubmitting(true)
      if (mode === 'upload') {
        if (!file) {
          setError('Please select a file to upload.')
          return
        }
        await onUpload(file)
      } else {
        if (!text.trim()) {
          setError('Please enter some syllabus text.')
          return
        }
        await onTextSubmit(text)
      }
      handleClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const subtitle = courseName
    ? `Upload the syllabus for ${courseName}. Accepted formats: PDF, plain text (max 10 MB).`
    : 'Upload a syllabus. Accepted formats: PDF, plain text (max 10 MB).'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Syllabus"
      subtitle={subtitle}
      primaryLabel="Upload"
      primaryLoadingLabel="Uploading…"
      onPrimary={handlePrimary}
      error={error}
    >
      {/* Mode toggle */}
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => switchMode('upload')}
          className={`flex flex-1 items-center justify-center h-9 rounded-lg text-sm font-heading font-semibold transition border ${
            mode === 'upload'
              ? 'bg-navy text-white border-navy'
              : 'bg-bg-gray text-slate-blue border-border hover:bg-border'
          }`}
        >
          File Upload
        </button>
        <button
          type="button"
          onClick={() => switchMode('text')}
          className={`flex flex-1 items-center justify-center h-9 rounded-lg text-sm font-heading font-semibold transition border ${
            mode === 'text'
              ? 'bg-navy text-white border-navy'
              : 'bg-bg-gray text-slate-blue border-border hover:bg-border'
          }`}
        >
          Paste Text
        </button>
      </div>

      {mode === 'upload' ? (
        <FileUpload
          accept=".pdf,.txt"
          acceptedMimeTypes={['application/pdf', 'text/plain']}
          maxBytes={10 * 1024 * 1024}
          hint="PDF or .txt · max 10 MB"
          file={file}
          onFile={(f) => { setError(null); setFile(f) }}
          onError={(msg) => { setError(msg); setFile(null) }}
          onRemove={() => { setFile(null); setError(null) }}
        />
      ) : (
        /* Text fallback */
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your syllabus text here…"
          rows={8}
          className="w-full resize-none rounded-lg border border-border bg-bg-gray px-4 py-3 text-sm font-body text-navy placeholder:text-light-blue focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal transition"
        />
      )}

      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm font-body text-slate-blue">
          <SpinnerIcon size={14} />
          <span>Uploading your syllabus…</span>
        </div>
      )}
    </Modal>
  )
}
