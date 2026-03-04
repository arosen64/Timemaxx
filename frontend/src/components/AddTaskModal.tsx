import { useState } from 'react'

const TASK_TYPES = ['Problem Set', 'Essay', 'Coding', 'Exam Prep'] as const

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
  const [taskName, setTaskName] = useState('')
  const [selectedType, setSelectedType] = useState<string>('Problem Set')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <span className="modal-title">Add new task</span>
          <button onClick={onClose} className="modal-close-btn">
            &times;
          </button>
        </div>

        {/* Subtitle */}
        <p className="modal-subtitle">Fill in the details below.</p>

        {/* Form Body */}
        <div className="form-body">
          {/* Task name */}
          <div className="form-field">
            <label className="form-label">Task name</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g. Calculus Problem Set 5"
              className="form-input"
            />
          </div>

          {/* Task type */}
          <div className="form-field">
            <label className="form-label">Task type</label>
            <div className="flex gap-2">
              {TASK_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`chip ${selectedType === type ? 'chip-selected' : 'chip-unselected'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste or type your assignment description here..."
              className="form-textarea"
            />
          </div>

          {/* Due date */}
          <div className="form-field">
            <label className="form-label">Due date</label>
            <div className="form-date-wrapper">
              <input
                type="text"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="MM / DD / YYYY"
                className="form-date-input"
              />
              <CalendarIcon />
            </div>
          </div>
        </div>

        {/* Button Row */}
        <div className="modal-btn-row">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button className="btn-submit">
            Add Task
            <span className="btn-submit-dot" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="stroke-light-blue"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
