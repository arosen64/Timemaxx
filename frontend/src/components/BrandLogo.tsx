import { BookOpenIcon } from './icons/BookOpenIcon'

interface BrandLogoProps {
  /** 'sm' = sidebar (h-8 w-8 icon box, text-lg label); 'md' = landing page (h-10 w-10, text-xl). */
  size?: 'sm' | 'md'
}

export default function BrandLogo({ size = 'sm' }: BrandLogoProps) {
  const boxClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
  const iconSize = size === 'md' ? 26 : 18
  const textClass = size === 'md' ? 'text-xl' : 'text-lg'

  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center ${boxClass} rounded bg-teal text-navy`}>
        <BookOpenIcon size={iconSize} />
      </div>
      <span className={`font-heading ${textClass} font-bold text-white`}>Timemaxx</span>
    </div>
  )
}
