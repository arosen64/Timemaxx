export const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'IP', 'S', 'U', 'NG'] as const

export const STUDY_GOALS = ['Just pass', 'Do well', 'Ace it'] as const

export const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as const

// Fixed accent colors per insight slot
export const ACCENTS = [
  { bg: 'bg-teal/10', border: 'border-teal/30', dot: 'bg-teal', label: 'text-teal' },
  { bg: 'bg-urgent-red/10', border: 'border-urgent-red/30', dot: 'bg-urgent-red', label: 'text-urgent-red' },
  { bg: 'bg-sky-blue/10', border: 'border-sky-blue/30', dot: 'bg-sky-blue', label: 'text-sky-blue' },
  { bg: 'bg-navy/10', border: 'border-navy/30', dot: 'bg-navy', label: 'text-navy' },
  { bg: 'bg-slate-blue/10', border: 'border-slate-blue/30', dot: 'bg-slate-blue', label: 'text-slate-blue' },
]