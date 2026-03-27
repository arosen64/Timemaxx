import { useEffect, useState } from 'react'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../../backend/convex/_generated/api'
import { AcademicInsight, AcademicProfileSummaryProps } from '../types'
import { ACCENTS } from '../constants'

export default function AcademicProfileSummary({ profile, onChange }: AcademicProfileSummaryProps) {
  const generateProfile = useAction(api.actions.generateAcademicProfile.generateAcademicProfile)
  const userCourses = useQuery(api.queries.userCourses.getUserCourses)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasCourses = (userCourses?.length ?? 0) > 0
  const insights = profile.transcriptSummary ?? []

  const generate = async () => {
    if (!userCourses) return
    setLoading(true)
    setError(null)
    try {
      const result = await generateProfile({
        courses: userCourses.map((c) => ({
          title: c.title,
          grade: c.grade,
          term: c.term,
        })),
      })
      onChange({ ...profile, transcriptSummary: result as AcademicInsight[] })
    } catch {
      setError('Failed to generate your academic profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Only auto-generate once courses are loaded and no cached summary exists
  useEffect(() => {
    if (userCourses && hasCourses && insights.length === 0) generate()
  }, [userCourses])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-navy">Academic Profile</h2>
          <p className="mt-1 font-body text-sm text-slate-blue">
            A Gemini-generated summary based on your transcript.
          </p>
        </div>
        {hasCourses && !loading && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={generate}
              className="rounded-lg border border-border bg-bg-gray px-3 py-1.5 font-heading text-xs font-semibold text-slate-blue transition hover:border-sky-blue hover:text-navy"
            >
              Regenerate
            </button>
            <p className="font-body text-xs text-light-blue">Added more courses? Regenerate for an updated profile.</p>
          </div>
        )}
      </div>

      {userCourses && !hasCourses && (
        <div className="rounded-xl border border-border bg-bg-gray p-6 text-center">
          <p className="font-body text-sm text-light-blue">
            No courses added yet. Go back and add courses from your transcript to generate your academic profile.
          </p>
        </div>
      )}

      {(loading || userCourses === undefined) && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border bg-bg-gray"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
          <p className="text-center font-body text-xs text-light-blue">
            {userCourses === undefined ? 'Loading courses...' : 'Gemini is analyzing your transcript...'}
          </p>
        </div>
      )}

      {hasCourses && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-urgent-red/20 bg-urgent-red/5 p-6">
          <p className="font-body text-sm text-urgent-red">{error}</p>
          <button
            type="button"
            onClick={generate}
            className="rounded-lg bg-navy px-4 py-2 font-heading text-sm font-medium text-white transition hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}

      {hasCourses && !loading && insights.length > 0 && (
        <div className="flex flex-col gap-3">
          {insights.map((insight, i) => {
            const accent = ACCENTS[i] ?? ACCENTS[0]
            return (
              <div
                key={i}
                className={`flex gap-3 rounded-xl border p-4 ${accent.bg} ${accent.border}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${accent.dot}`} />
                <div className="flex flex-col gap-0.5">
                  <span className={`font-heading text-sm font-semibold ${accent.label}`}>
                    {insight.label}
                  </span>
                  <p className="font-body text-sm text-navy">{insight.text}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
