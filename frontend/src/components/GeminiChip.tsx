import { SparklesIcon } from './icons/icons'

interface GeminiChipProps {
  label?: string
}

export default function GeminiChip({ label = 'Powered by Google Gemini' }: GeminiChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-gray px-3.5 py-3 text-sky-blue">
      <SparklesIcon size={14} />
      <span className="text-[11px] text-slate-blue">{label}</span>
    </div>
  )
}
