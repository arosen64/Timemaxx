import { applySortKey } from '../../src/pages/DashboardPage'
import type { TaskType } from '../../src/components/dashboard/types'

function makeTask(overrides: Partial<TaskType>): TaskType {
  return {
    _id: 'task1' as TaskType['_id'],
    title: 'Task',
    taskType: 'Essay',
    status: 'not_started',
    dueDate: Date.now() + 7 * 86_400_000,
    createdAt: Date.now(),
    ...overrides,
  } as TaskType
}

const NOW = Date.now()

describe('applySortKey', () => {
  it('newest: sorts by createdAt descending', () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskType['_id'], createdAt: NOW + 1000 }),
      makeTask({ _id: 'b' as TaskType['_id'], createdAt: NOW + 3000 }),
      makeTask({ _id: 'c' as TaskType['_id'], createdAt: NOW + 2000 }),
    ]
    const result = applySortKey(tasks, 'newest')
    expect(result.map((t) => t._id)).toEqual(['b', 'c', 'a'])
  })

  it('due_date: sorts by dueDate ascending', () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskType['_id'], dueDate: NOW + 3 * 86_400_000 }),
      makeTask({ _id: 'b' as TaskType['_id'], dueDate: NOW + 1 * 86_400_000 }),
      makeTask({ _id: 'c' as TaskType['_id'], dueDate: NOW + 2 * 86_400_000 }),
    ]
    const result = applySortKey(tasks, 'due_date')
    expect(result.map((t) => t._id)).toEqual(['b', 'c', 'a'])
  })

  it('class: sorts alphabetically by classTag', () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskType['_id'], classTag: 'History' }),
      makeTask({ _id: 'b' as TaskType['_id'], classTag: 'Calculus' }),
      makeTask({ _id: 'c' as TaskType['_id'], classTag: 'Biology' }),
    ]
    const result = applySortKey(tasks, 'class')
    expect(result.map((t) => t._id)).toEqual(['c', 'b', 'a'])
  })

  it('class: tasks with no classTag sort to the bottom', () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskType['_id'], classTag: undefined }),
      makeTask({ _id: 'b' as TaskType['_id'], classTag: 'Calculus' }),
    ]
    const result = applySortKey(tasks, 'class')
    expect(result.map((t) => t._id)).toEqual(['b', 'a'])
  })

  it('class: ties on classTag break by dueDate ascending', () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskType['_id'], classTag: 'Biology', dueDate: NOW + 5 * 86_400_000 }),
      makeTask({ _id: 'b' as TaskType['_id'], classTag: 'Biology', dueDate: NOW + 2 * 86_400_000 }),
    ]
    const result = applySortKey(tasks, 'class')
    expect(result.map((t) => t._id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskType['_id'], dueDate: NOW + 2 * 86_400_000 }),
      makeTask({ _id: 'b' as TaskType['_id'], dueDate: NOW + 1 * 86_400_000 }),
    ]
    const original = [...tasks]
    applySortKey(tasks, 'due_date')
    expect(tasks.map((t) => t._id)).toEqual(original.map((t) => t._id))
  })
})
