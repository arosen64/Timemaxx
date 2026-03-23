import Sidebar from '../components/Sidebar'

export default function ClassesPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center bg-bg-gray">
        <p className="font-body text-sm text-slate-blue">Classes coming soon.</p>
      </main>
    </div>
  )
}
