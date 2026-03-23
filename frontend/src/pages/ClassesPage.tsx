import { PageLayout } from '../components/ui'

export default function ClassesPage() {
  return (
    <PageLayout>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold text-navy">Classes</h1>
        <p className="font-body text-sm text-slate-blue">Manage your classes and syllabi</p>
      </div>
    </PageLayout>
  )
}
