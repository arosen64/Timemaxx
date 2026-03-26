import SyllabusUploadModal from '../components/classes/SyllabusUploadModal'
import { UploadSyllabusResult } from '../types'
// MOCK FOR TESTING ONLY
export default function ClassesPage() {
  return (
    <SyllabusUploadModal
      isOpen={true}
      onClose={() => {}}
      onSuccess={(result: UploadSyllabusResult) => {
        console.log(result)
      }}
      course={{ title: 'Test Course' }}
    />
  )
}
