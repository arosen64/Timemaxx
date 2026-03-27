import { TASK_TYPE_OPTIONS, type SchemaTaskType } from '../dashboard/types'
import { Button } from '../ui'

interface TaskTypePillsProps {
  value: SchemaTaskType
  onChange: (type: SchemaTaskType) => void
}

export default function TaskTypePills({ value, onChange }: TaskTypePillsProps) {
  return (
    <div className="flex gap-1.5">
      {TASK_TYPE_OPTIONS.map((type) => (
        <Button
          key={type}
          variant={value === type ? 'primary' : 'secondary'}
          onClick={() => onChange(type)}
          className="h-7 px-3 text-xs rounded-md"
        >
          {type}
        </Button>
      ))}
    </div>
  )
}
