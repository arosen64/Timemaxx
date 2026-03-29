import Sidebar from '../components/Sidebar'
import ScheduleTab from '../components/schedule/ScheduleTab'

export default function SchedulePage() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-gray font-body text-slate-blue">
      <Sidebar />

      <main className="flex flex-col flex-1 min-h-0 p-10 overflow-hidden">
        <ScheduleTab />
      </main>
    </div>
  )
}
