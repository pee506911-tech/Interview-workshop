import { Card, CardIcon } from '../ui'

interface FacultyStepProps {
    searchQuery: string
    onSearchChange: (query: string) => void
    faculties: string[]
    onSelect: (faculty: string) => void
}

/**
 * Step 1: Faculty/Subject selection
 */
export function FacultyStep({
    searchQuery,
    onSearchChange,
    faculties,
    onSelect
}: FacultyStepProps) {
    return (
        <section className="fade-in">
            <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2 text-gray-900">Interview Workshop</h1>
                <p className="text-gray-500 text-sm">Choose a subject to get started.</p>
            </div>

            <div className="relative mb-6">
                <i className="fa-solid fa-search absolute left-4 top-3.5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search faculty..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-white shadow-sm ring-1 ring-gray-200 focus:ring-2 focus:ring-brand outline-none transition text-sm"
                />
            </div>

            <div className="space-y-3">
                {faculties.map(name => (
                    <Card key={name} onClick={() => onSelect(name)}>
                        <div className="font-bold text-gray-900">{name}</div>
                        <CardIcon icon="fa-solid fa-chevron-right" />
                    </Card>
                ))}
                {faculties.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        No subjects found.
                    </div>
                )}
            </div>
        </section>
    )
}
