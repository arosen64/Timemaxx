import { useQuery } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import { SparklesIcon } from '../icons'
import ScheduleBlock, { type UpcomingBlock } from './ScheduleBlock'

export default function UpcomingSchedulePanel() {
  const upcomingBlocks = useQuery(api.queries.studyBlocks.getUpcomingStudyBlocks) as UpcomingBlock[] | undefined

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-4">
      <h2 className="text-base font-bold font-heading text-navy">Today's Schedule</h2>

      {upcomingBlocks === undefined ? (
        <div className="rounded-[10px] border border-border bg-white p-5 text-sm text-slate-blue">
          Loading…
        </div>
      ) : upcomingBlocks.length === 0 ? (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-[18px]">
          <span className="font-heading text-[13px] font-semibold text-navy">No blocks in the next 24 hours</span>
          <span className="text-xs text-slate-blue">Head to the Schedule tab to assign study blocks.</span>
        </div>
      ) : (
        upcomingBlocks.map((block, i) => (
          <ScheduleBlock key={block._id} block={block} isFirst={i === 0} />
        ))
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-gray px-3.5 py-3">
        <SparklesIcon color="#68ACE5" size={14} />
        <span className="text-[11px] text-slate-blue">Powered by Google Gemini</span>
      </div>
    </aside>
  )
}
