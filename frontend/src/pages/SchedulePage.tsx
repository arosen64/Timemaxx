import Sidebar from '../components/Sidebar'
import ScheduleTab from '../components/schedule/ScheduleTab'

export default function SchedulePage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-gray font-body text-slate-blue">
      <Sidebar />

      <main className="flex flex-col flex-1 min-h-0 p-10 overflow-hidden gap-7">
        <header>
          <h1 className="font-heading text-[28px] font-bold text-navy">Schedule</h1>
          <p className="text-sm text-slate-blue">Your 7-day calendar view</p>
        </header>

        <ScheduleTab />
      </main>
    </div>
  )
}
