import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { type ParsedCourse } from '../../../backend/convex/actions/parseTranscript'
import { type Course } from '../types'
import FileUpload from './ui/FileUpload'
import { SpinnerIcon } from './icons'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf.getPage(i + 1).then((page) =>
        page.getTextContent().then((content) =>
          content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
        )
      )
    )
  )
  return pages.join('\n')
}

interface TranscriptUploadProps {
  onCoursesAdded: (courses: Course[]) => void
}

export default function TranscriptUpload({ onCoursesAdded }: TranscriptUploadProps) {
  const parseTranscript = useAction(api.actions.parseTranscript.parseTranscript)
  const addUserCourse = useMutation(api.mutations.userCourses.addUserCourse)

  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (f: File) => {
    setFile(f)
    setError(null)
    setSummary(null)
    setParsing(true)

    try {
      const fileText = await extractPdfText(f)
      const parsed: ParsedCourse[] = await parseTranscript({ fileText })

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
            // Already exists — skip quietly
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
      <FileUpload
        accept=".pdf"
        acceptedMimeTypes={['application/pdf']}
        maxBytes={10 * 1024 * 1024}
        hint="PDF · max 10 MB"
        file={file}
        onFile={handleFile}
        onError={(msg) => { setError(msg); setFile(null) }}
        onRemove={handleRemove}
      />
      {parsing && (
        <div className="flex items-center gap-2 font-body text-xs text-slate-blue">
          <SpinnerIcon size={12} />
          <span>Parsing transcript…</span>
        </div>
      )}
      {summary && <p className="font-body text-xs text-teal">{summary}</p>}
      {error && <p className="font-body text-xs text-urgent-red">{error}</p>}
    </div>
  )
}
