import Sidebar from '../components/Sidebar'

export default function ClassesPage() {
  return (
    <div className="flex h-screen font-body bg-bg-gray">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto gap-8 p-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold text-navy">Classes</h1>
          <p className="font-body text-sm text-slate-blue">Manage your classes and syllabi</p>
        </div>
      </main>
    </div>
  )
}
