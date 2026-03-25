export default function PreferencesPage() {
    return(
        <div className="flex h-screen font-body bg-bg-gray">
            <div className="m-auto w-full max-w-4xl rounded-lg bg-white p-8">
                <h1 className="font-heading text-2xl font-semibold text-navy">Preferences</h1>
                <p className="mt-2 font-body text-sm text-slate-blue">Set your preferences to get better study recommendations.</p>
                <div className="mt-6 flex w-full gap-8">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <span className="font-body text-xs font-semibold text-slate-blue">Preferred Study Time</span>
                        <span className="font-heading text-base font-medium text-navy">Evenings</span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <span className="font-body text-xs font-semibold text-slate-blue">Study Environment</span>
                        <span className="font-heading text-base font-medium text-navy">Quiet</span>
                    </div>
                </div>
            </div>
        </div>
    )
}