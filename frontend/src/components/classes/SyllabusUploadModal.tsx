import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { Modal, FileUpload, Toggle } from '../ui'
import { SpinnerIcon } from '../icons'
import { Course, UploadSyllabusResult } from '../../types'
import { extractPdfText } from '../../utils/pdf'

type Mode = 'upload' | 'text'

interface SyllabusUploadModalProps {
  isOpen: boolean
  onClose: () => void
  /** Course name shown in the subtitle, e.g. "CS 101". */
  course: Course
  /** Called with the extracted tasks after a successful upload. */
  onSuccess?: (result: UploadSyllabusResult) => void
}

export default function SyllabusUploadModal({
  isOpen,
  onClose,
  course,
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

  async function submitToBackend(fileContents: string) {
    const result = await uploadSyllabus({
      fileContents,
      courseId: course.userCourseId as Parameters<typeof uploadSyllabus>[0]['courseId'],
    })
    onSuccess?.(result)
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
        const fileContents = file.type === 'application/pdf'
          ? await extractPdfText(file)
          : await file.text()
        await submitToBackend(fileContents)
      } else {
        if (!text.trim()) {
          setError('Please enter some syllabus text.')
          return
        }
        await submitToBackend(text)
      }
      handleClose()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const subtitle = course.title
    ? `Upload the syllabus for ${course.title}. Accepted formats: PDF, plain text (max 10 MB).`
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
