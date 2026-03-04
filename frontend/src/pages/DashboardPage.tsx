import { useState } from 'react'
import AddTaskModal from '../components/AddTaskModal'

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg-gray font-body">
      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-7 p-10">
        {/* Page Header */}
        <div className="flex w-full items-center justify-between">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border-none bg-navy px-5"
          >
            <PlusIcon />
            <span className="font-heading text-sm font-semibold text-white">Add Task</span>
          </button>
        </div>

        {/* Placeholder for rest of dashboard content */}
        <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-slate-blue">
          Dashboard content goes here
        </div>
      </div>

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="stroke-teal"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
