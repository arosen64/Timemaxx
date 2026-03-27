import { useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../../backend/convex/_generated/api'
import { LogoutIcon, TrashIcon } from '../icons'
import DeleteAccountModal from './DeleteAccountModal'
import Button from '../ui/Button'

export default function ProfileActions() {
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const deleteAccount = useMutation(api.mutations.users.deleteAccount)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  async function handleDeleteAccount() {
    await deleteAccount()
    await signOut()
    navigate('/')
  }

  return (
    <>
      <div className="flex gap-3">
        <Button variant="destructive" icon={<LogoutIcon />} onClick={handleLogout} className="w-40">
          Log Out
        </Button>
        <Button variant="destructive" icon={<TrashIcon />} onClick={() => setShowDeleteConfirm(true)} className="w-[200px]">
          Delete Account
        </Button>
      </div>

      <DeleteAccountModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
      />
    </>
  )
}
