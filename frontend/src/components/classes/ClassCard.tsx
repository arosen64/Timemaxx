import { useState } from 'react'
import { TrashIcon, SpinnerIcon, CheckCircleIcon } from '../icons'
import SyllabusUploadModal from './SyllabusUploadModal'

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface ClassCardProps {
  id: string
  courseCode: string
  title: string
  term: string
  extractedTaskCount?: number
  onRemove: () => Promise<void>
  onUpload: (file: File) => Promise<number>
  onTextSubmit: (text: string) => Promise<number>
}

export default function ClassCard({
  courseCode,
  title,
  term,
  onRemove,
  onUpload,
  onTextSubmit,
}: ClassCardProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [extractedCount, setExtractedCount] = useState<number | null>(null)

  async function handleConfirmRemove() {
    setIsRemoving(true)
    try {
      await onRemove()
    } finally {
      setIsRemoving(false)
      setConfirmingRemove(false)
    }
  }

  async function handleUpload(file: File) {
    setUploadStatus('uploading')
    setUploadError(null)
    const count = await onUpload(file)
    setExtractedCount(count)
    setUploadStatus('success')
  }

  async function handleTextSubmit(text: string) {
    setUploadStatus('uploading')
    setUploadError(null)
    const count = await onTextSubmit(text)
    setExtractedCount(count)
    setUploadStatus('success')
  }

  function handleUploadError() {
    setUploadStatus('error')
    setUploadError('Upload failed. Please try again.')
  }

  return (
    <>
      <SyllabusUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        courseName={title}
        onUpload={async (file) => {
          try {
            await handleUpload(file)
          } catch {
            handleUploadError()
            throw new Error('Upload failed')
          }
        }}
        onTextSubmit={async (text) => {
          try {
            await handleTextSubmit(text)
          } catch {
            handleUploadError()
            throw new Error('Upload failed')
          }
        }}
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-heading text-xs font-semibold uppercase tracking-wide text-slate-blue">
              {courseCode}
            </span>
            <h3 className="font-heading text-base font-bold text-navy truncate">{title}</h3>
            <span className="font-body text-xs text-light-blue">{term}</span>
          </div>

          {/* Remove button / inline confirmation */}
          {!confirmingRemove ? (
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              aria-label={`Remove ${title}`}
              className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-light-blue hover:text-urgent-red hover:bg-bg-gray transition"
            >
              <TrashIcon size={15} />
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-body text-xs text-slate-blue whitespace-nowrap">Remove?</span>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="h-7 px-2.5 rounded-md bg-urgent-red font-heading text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {isRemoving ? <SpinnerIcon size={12} /> : 'Yes'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="h-7 px-2.5 rounded-md border border-border font-heading text-xs font-semibold text-slate-blue hover:bg-bg-gray transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-border" />

        {/* Syllabus upload section */}
        <div className="flex items-center justify-between gap-4">
          {uploadStatus === 'idle' && (
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="font-heading text-sm font-semibold text-teal hover:opacity-80 transition"
            >
              Upload Syllabus
            </button>
          )}

          {uploadStatus === 'uploading' && (
            <div className="flex items-center gap-2 text-sm font-body text-slate-blue">
              <SpinnerIcon size={14} />
              <span>Processing syllabus…</span>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm font-body text-slate-blue">
              <CheckCircleIcon size={14} color="#86C8BC" />
              <span>
                Syllabus uploaded
                {extractedCount !== null && ` · ${extractedCount} task${extractedCount !== 1 ? 's' : ''} extracted`}
              </span>
              <button
                type="button"
                onClick={() => { setUploadStatus('idle'); setExtractedCount(null) }}
                className="ml-2 font-heading text-xs font-semibold text-teal hover:opacity-80 transition"
              >
                Upload again
              </button>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="flex items-center gap-2 text-sm font-body text-urgent-red">
              <span>{uploadError}</span>
              <button
                type="button"
                onClick={() => { setUploadStatus('idle'); setUploadError(null); setUploadModalOpen(true) }}
                className="ml-2 font-heading text-xs font-semibold text-teal hover:opacity-80 transition"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
