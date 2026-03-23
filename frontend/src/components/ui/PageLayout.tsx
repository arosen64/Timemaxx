import { type ReactNode } from 'react'
import Sidebar from './sidebar'

interface PageLayoutProps {
  children: ReactNode
  mainClassName?: string
}

export default function PageLayout({ children, mainClassName = '' }: PageLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-gray font-body text-slate-blue">
      <Sidebar />
      <main className={`flex flex-col flex-1 min-h-0 overflow-y-auto p-10 ${mainClassName}`}>
        {children}
      </main>
    </div>
  )
}
