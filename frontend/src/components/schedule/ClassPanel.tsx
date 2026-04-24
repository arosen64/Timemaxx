import { useMemo, useState } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../../../backend/convex/_generated/api'
import type { Id } from '../../../../backend/convex/_generated/dataModel'
import { ChevronLeftIcon, ChevronRightIcon, SpinnerIcon, CalendarIcon } from '../icons'
import { isCurrentTerm } from '../../utils/termUtils'

const DEFAULT_COURSE_COLOR = '#002D72'
const OTHER_CLASS_ID = '__none__'

type StudyBlockInPanel = {
  _id: Id<'studyBlocks'>
  taskId: Id<'tasks'>
  subtaskId?: Id<'subtasks'>
  title: string
  studyBlockLength: number
  taskTitle: string
  taskDueDate: number
  courseColor?: string
  courseName?: string
}

type Task = {
  _id: Id<'tasks'>
  title: string
  dueDate: number
  courseId?: Id<'userCourses'> | null
}

type ClassRow = {
  id: string
  courseCode: string
  title: string
  color: string
  taskCount: number
}

type Props = {
  unscheduledBlocks: StudyBlockInPanel[]
  assigningBlockId: Id<'studyBlocks'> | null
  onToggleAssign: (id: Id<'studyBlocks'>) => void
  timezone: string
  onScheduleAllMsg: (msg: string) => void
}

export default function ClassPanel({
  unscheduledBlocks,
  assigningBlockId,
  onToggleAssign,
  timezone,
  onScheduleAllMsg,
}: Props) {
  const safeApi = api as any

  const getUserCoursesRef = safeApi?.queries?.userCourses?.getUserCourses
  const getAllTasksRef = safeApi?.queries?.tasks?.getAllTasks
  const getSubtasksForTaskRef = safeApi?.queries?.subtasks?.getSubtasksForTask
  const scheduleBlockRef = safeApi?.actions?.scheduleBlock?.scheduleBlock

  const courses = useQuery(getUserCoursesRef ?? 'skip')
  const allTasks = useQuery(getAllTasksRef ?? 'skip', getAllTasksRef ? {} : 'skip')

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<Id<'tasks'> | null>(null)

  const subtasks = useQuery(
    getSubtasksForTaskRef ?? 'skip',
    selectedTaskId && getSubtasksForTaskRef ? { parentTaskId: selectedTaskId } : 'skip'
  )

  const scheduleBlockAction = useAction(scheduleBlockRef ?? 'skip')

  const [schedulingBlockIds, setSchedulingBlockIds] = useState<Set<Id<'studyBlocks'>>>(new Set())
  const [isSchedulingAll, setIsSchedulingAll] = useState(false)

  async function handleScheduleBlock(blockId: Id<'studyBlocks'>) {
    if (!scheduleBlockRef) return
    setSchedulingBlockIds((prev) => new Set(prev).add(blockId))
    try {
      await scheduleBlockAction({ studyBlockId: blockId, timezone })
    } finally {
      setSchedulingBlockIds((prev) => {
        const next = new Set(prev)
        next.delete(blockId)
        return next
      })
    }
  }

  async function handleScheduleSelected() {
    if (!selectedTaskId || !scheduleBlockRef) return
    setIsSchedulingAll(true)
    try {
      const unscheduledIds = selectedTaskBlocks.map((block) => block._id)
      const results = await Promise.allSettled(
        unscheduledIds.map((studyBlockId) => scheduleBlockAction({ studyBlockId, timezone })),
      )
      const scheduled = results.filter((result) => result.status === 'fulfilled').length
      const skipped = results.length - scheduled
      onScheduleAllMsg(
        skipped === 0
          ? `All ${scheduled} block${scheduled !== 1 ? 's' : ''} scheduled.`
          : `${scheduled} scheduled, ${skipped} skipped.`
      )
    } catch {
      onScheduleAllMsg('Scheduling failed. Please try again.')
    } finally {
      setIsSchedulingAll(false)
    }
  }

  const coursesList = Array.isArray(courses) ? courses : []
  const tasksList = Array.isArray(allTasks) ? allTasks : []
  const subtasksList = Array.isArray(subtasks) ? subtasks : []

  const selectedTaskBlocks = selectedTaskId
    ? unscheduledBlocks.filter((b) => b.taskId === selectedTaskId)
    : []

  const currentCourses = coursesList.filter((c) => isCurrentTerm(c.term))

  const tasksByCourse = new Map<string, typeof allTasks>()
  for (const task of tasksList) {
    const key = task.courseId ?? '__none__'
    if (!tasksByCourse.has(key)) tasksByCourse.set(key, [])
    tasksByCourse.get(key)!.push(task)
  }

  const selectedTask = tasksList.find((t) => t._id === selectedTaskId)
  const selectedCourse = currentCourses.find((course) => course._id === selectedCourseId) ?? null

  const tasksForSelectedCourse = useMemo(() => {
    if (!selectedCourseId) return []
    return (tasksByCourse.get(selectedCourseId) ?? []) as Task[]
  }, [selectedCourseId, tasksByCourse])

  const classRows = useMemo(() => {
    const rows: ClassRow[] = currentCourses.map((course) => ({
      id: course._id,
      courseCode: course.courseCode,
      title: course.title,
      color: course.color ?? DEFAULT_COURSE_COLOR,
      taskCount: (tasksByCourse.get(course._id) ?? []).length,
    }))
    const otherTaskCount = (tasksByCourse.get(OTHER_CLASS_ID) ?? []).length
    if (otherTaskCount > 0) {
      rows.push({
        id: OTHER_CLASS_ID,
        courseCode: 'OTHER',
        title: 'Tasks without class',
        color: '#8EA5BC',
        taskCount: otherTaskCount,
      })
    }
    return rows
  }, [currentCourses, tasksByCourse])

  const blocksBySubtask = useMemo(() => {
    const map = new Map<string, StudyBlockInPanel[]>()
    for (const block of selectedTaskBlocks) {
      if (!block.subtaskId) continue
      const key = block.subtaskId as string
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(block)
    }
    return map
  }, [selectedTaskBlocks])

  const taskLevelBlocks = useMemo(
    () => selectedTaskBlocks.filter((block) => !block.subtaskId),
    [selectedTaskBlocks],
  )

  return (
    <aside
      className="flex w-[280px] shrink-0 flex-col border-l border-border bg-white overflow-hidden"
      data-tray
    >
      {!selectedCourseId ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2.5 border-b border-border">
            <span className="text-[10px] font-semibold text-light-blue tracking-wider">CLASSES</span>
          </div>
          {courses === undefined ? (
            <div className="flex items-center justify-center py-8">
              <SpinnerIcon color="#4E6A8C" size={14} />
            </div>
          ) : classRows.length === 0 ? (
            <div className="px-3 py-3">
              {unscheduledBlocks.length === 0 ? (
                <p className="px-1 py-1 text-xs text-light-blue">All blocks scheduled.</p>
              ) : (
                <div className="space-y-1.5">
                  {unscheduledBlocks.map((block) => {
                    const isAssigning = assigningBlockId === block._id
                    const isBlockScheduling = schedulingBlockIds.has(block._id)
                    return (
                      <div
                        key={block._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggleAssign(block._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onToggleAssign(block._id)
                          }
                        }}
                        className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                          isAssigning
                            ? 'border-teal bg-teal/10'
                            : 'border-border bg-bg-gray hover:border-teal/50 hover:bg-teal/5'
                        }`}
                      >
                        <span className="h-1 w-4 rounded-full bg-sky-blue shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-[11px] font-medium text-navy">{block.title}</span>
                          <span className="block truncate text-[10px] text-light-blue">{block.taskTitle}</span>
                        </span>
                        <span className="text-[10px] text-light-blue shrink-0">{block.studyBlockLength} min</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleScheduleBlock(block._id)
                          }}
                          disabled={isBlockScheduling}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-light-blue opacity-0 transition hover:bg-navy/10 hover:text-navy group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Auto-schedule this block"
                        >
                          {isBlockScheduling
                            ? <SpinnerIcon color="currentColor" size={10} />
                            : <CalendarIcon color="currentColor" size={10} />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            classRows.map((course) => {
              const taskCount = course.taskCount
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(course.id)
                    setSelectedTaskId(null)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-bg-gray transition-colors border-b border-border"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: course.color ?? DEFAULT_COURSE_COLOR }}
                  />
                  <span className="flex flex-1 min-w-0 flex-col gap-0.5">
                    <span className="text-[10px] text-light-blue font-medium">{course.courseCode}</span>
                    <span className="truncate text-[12px] font-semibold text-navy">{course.title}</span>
                  </span>
                  {taskCount > 0 && (
                    <span className="text-[11px] text-light-blue font-medium shrink-0">{taskCount}</span>
                  )}
                  <span className="shrink-0 text-light-blue">
                    <ChevronRightIcon size={12} />
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : !selectedTask ? (
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCourseId(null)
                setSelectedTaskId(null)
              }}
              className="rounded p-1 text-light-blue hover:bg-bg-gray hover:text-slate-blue"
              aria-label="Back to classes"
            >
              <ChevronLeftIcon size={14} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-light-blue tracking-wider">TASKS</p>
              <p className="truncate text-[12px] font-semibold text-navy">
                {selectedCourseId === OTHER_CLASS_ID ? 'Tasks without class' : selectedCourse?.title}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tasksForSelectedCourse.length === 0 ? (
              <p className="px-4 py-4 text-xs text-light-blue">No tasks for this class.</p>
            ) : (
              tasksForSelectedCourse.map((task: Task) => (
                <button
                  key={task._id}
                  type="button"
                  onClick={() => setSelectedTaskId(task._id)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors border-b border-border hover:bg-bg-gray"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-light-blue" />
                  <span className="flex-1 min-w-0 truncate text-[12px] font-medium text-slate-blue">
                    {task.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-light-blue">
                    {new Date(task.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: timezone,
                    })}
                  </span>
                  <ChevronRightIcon size={11} />
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              className="rounded p-1 text-light-blue hover:bg-bg-gray hover:text-slate-blue"
              aria-label="Back to tasks"
            >
              <ChevronLeftIcon size={14} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-light-blue tracking-wider">TASK DETAILS</p>
              <p className="truncate text-[12px] font-semibold text-navy">{selectedTask.title}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {subtasks === undefined ? (
              <div className="flex items-center justify-center py-8">
                <SpinnerIcon color="#4E6A8C" size={14} />
              </div>
            ) : subtasksList.length === 0 ? (
              <p className="mb-2 text-[11px] text-light-blue">No subtasks yet.</p>
            ) : (
              <div className="space-y-3">
                {subtasksList.map((sub) => {
                  const subtaskBlocks = blocksBySubtask.get(sub._id as string) ?? []
                  return (
                    <div key={sub._id} className="rounded-lg border border-border bg-white">
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                        <span className="h-3 w-3 shrink-0 rounded-full border border-light-blue" />
                        <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-navy">{sub.title}</span>
                        {sub.timeEstimate && (
                          <span className="shrink-0 text-[10px] text-light-blue">{sub.timeEstimate} min</span>
                        )}
                      </div>
                      <div className="space-y-1.5 px-2.5 py-2">
                        {subtaskBlocks.length === 0 ? (
                          <p className="px-1 text-[10px] text-light-blue">No unscheduled study blocks.</p>
                        ) : (
                          subtaskBlocks.map((block) => {
                            const isAssigning = assigningBlockId === block._id
                            const isBlockScheduling = schedulingBlockIds.has(block._id)
                            return (
                              <div
                                key={block._id}
                                role="button"
                                tabIndex={0}
                                onClick={() => onToggleAssign(block._id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onToggleAssign(block._id)
                                  }
                                }}
                                className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                                  isAssigning
                                    ? 'border-teal bg-teal/10'
                                    : 'border-border bg-bg-gray hover:border-teal/50 hover:bg-teal/5'
                                }`}
                              >
                                <span className="h-1 w-4 rounded-full bg-sky-blue shrink-0" />
                                <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-navy">{block.title}</span>
                                <span className="text-[10px] text-light-blue shrink-0">{block.studyBlockLength} min</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleScheduleBlock(block._id)
                                  }}
                                  disabled={isBlockScheduling}
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-light-blue opacity-0 transition hover:bg-navy/10 hover:text-navy group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  aria-label="Auto-schedule this block"
                                >
                                  {isBlockScheduling
                                    ? <SpinnerIcon color="currentColor" size={10} />
                                    : <CalendarIcon color="currentColor" size={10} />
                                  }
                                </button>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {taskLevelBlocks.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-white">
                <p className="border-b border-border px-3 py-2 text-[10px] font-semibold text-light-blue tracking-wider">
                  GENERAL BLOCKS
                </p>
                <div className="space-y-1.5 px-2.5 py-2">
                  {taskLevelBlocks.map((block) => {
                    const isAssigning = assigningBlockId === block._id
                    const isBlockScheduling = schedulingBlockIds.has(block._id)
                    return (
                      <div
                        key={block._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onToggleAssign(block._id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onToggleAssign(block._id)
                          }
                        }}
                        className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                          isAssigning
                            ? 'border-teal bg-teal/10'
                            : 'border-border bg-bg-gray hover:border-teal/50 hover:bg-teal/5'
                        }`}
                      >
                        <span className="h-1 w-4 rounded-full bg-sky-blue shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-navy">{block.title}</span>
                        <span className="text-[10px] text-light-blue shrink-0">{block.studyBlockLength} min</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleScheduleBlock(block._id)
                          }}
                          disabled={isBlockScheduling}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-light-blue opacity-0 transition hover:bg-navy/10 hover:text-navy group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Auto-schedule this block"
                        >
                          {isBlockScheduling
                            ? <SpinnerIcon color="currentColor" size={10} />
                            : <CalendarIcon color="currentColor" size={10} />
                          }
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={handleScheduleSelected}
              disabled={isSchedulingAll || selectedTaskBlocks.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSchedulingAll && <SpinnerIcon color="currentColor" size={12} />}
              <CalendarIcon color="currentColor" size={13} />
              Schedule
            </button>
            {selectedTaskBlocks.length === 0 && (
              <p className="mt-1.5 text-center text-[10px] text-light-blue">All blocks scheduled</p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
