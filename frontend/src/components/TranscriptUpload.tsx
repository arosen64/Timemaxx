import { useRef, useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { type ParsedCourse } from '../../../backend/convex/actions/parseTranscript'
import { type Course } from '../types'
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
  onCoursesAdded: (courses: Course[]) => void
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip the data URL prefix — Gemini needs raw base64 only
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TranscriptUpload({ onCoursesAdded }: TranscriptUploadProps) {
  const parseTranscript = useAction(api.actions.parseTranscript.parseTranscript)
  const addUserCourse = useMutation(api.mutations.userCourses.addUserCourse)

  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    setFile(f)
    setError(null)
    setSummary(null)
    setParsing(true)

    try {
      const fileBase64 = await readFileAsBase64(f)
      const parsed: ParsedCourse[] = await parseTranscript({ fileBase64 })

      // Save each parsed course to the DB, skip duplicates silently.
      // "X" grade means in-progress — omit grade so the study goals UI shows instead.
      const saved: Course[] = []
      await Promise.all(
        parsed.map(async (c) => {
          const hasGrade = c.grade && c.grade.trim().toUpperCase() !== 'X'
          try {
            const userCourseId = await addUserCourse({
              courseCode: c.courseCode,
              title: c.title,
              credits: c.credits,
              term: c.term,
              grade: hasGrade ? c.grade : undefined,
            })
            saved.push({
              userCourseId,
              courseCode: c.courseCode,
              title: c.title,
              credits: c.credits,
              term: c.term,
              grade: hasGrade ? c.grade : undefined,
            })
          } catch {
            // Already exists or unauthorized — skip quietly
          }
        })
      )

      onCoursesAdded(saved)
      setSummary(`${saved.length} course${saved.length !== 1 ? 's' : ''} imported from transcript`)
    } catch {
      setError('Failed to parse transcript. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  const handleRemove = () => {
    setFile(null)
    setError(null)
    setSummary(null)
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-gray px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon />
              <span className="font-body text-sm font-medium text-navy truncate">{file.name}</span>
              {parsing && (
                <span className="font-body text-xs text-light-blue animate-pulse shrink-0">
                  Parsing…
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={parsing}
              className="font-body text-xs text-light-blue hover:text-urgent-red transition-colors shrink-0 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          {summary && (
            <p className="font-body text-xs text-teal">{summary}</p>
          )}
          {error && (
            <p className="font-body text-xs text-urgent-red">{error}</p>
          )}
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
