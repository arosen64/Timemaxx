import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { Id } from '../../../../backend/convex/_generated/dataModel'
import Modal from '../ui/Modal'
import { FileUpload, Toggle } from '../ui'
import { SpinnerIcon } from '../icons'
import { UploadSyllabusResult } from '../../types'
import { extractPdfText } from '../../utils/pdf'

type Mode = 'upload' | 'text'

interface SyllabusUploadModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: Id<'userCourses'>
  /** Course name shown in the subtitle, e.g. "CS 101". */
  courseName?: string
  /** Called with the result after a successful upload. */
  onSuccess?: (result: UploadSyllabusResult) => void
}

export default function SyllabusUploadModal({
  isOpen,
  onClose,
  courseId,
  courseName,
  onSuccess,
}: SyllabusUploadModalProps) {
  const uploadSyllabus = useAction(api.actions.uploadSyllabus.uploadSyllabus)

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
      let fileContents: string
      if (mode === 'upload') {
        if (!file) {
          setError('Please select a file to upload.')
          return
        }
        fileContents = file.type === 'application/pdf'
          ? await extractPdfText(file)
          : await file.text()
      } else {
        if (!text.trim()) {
          setError('Please enter some syllabus text.')
          return
        }
        fileContents = text
      }
      const result = await uploadSyllabus({ fileContents, courseId })
      onSuccess?.(result)
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
      isPrimaryDisabled={isSubmitting}
      error={error}
    >
      <Toggle
        options={[
          { value: 'upload', label: 'File Upload' },
          { value: 'text', label: 'Paste Text' },
        ]}
        value={mode}
        onChange={switchMode}
      />

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
