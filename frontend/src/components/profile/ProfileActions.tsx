import { useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../../backend/convex/_generated/api'
import { LogoutIcon, TrashIcon } from '../icons/icons'
import DeleteAccountModal from './DeleteAccountModal'
import DestructButton from './DestructButton'

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
    await signOut()
    await deleteAccount()
    navigate('/')
  }

  return (
    <>
      <div className="flex gap-4">
        <DestructButton icon={<LogoutIcon />} text="Log Out" onClick={handleLogout} />
        <DestructButton icon={<TrashIcon />} text="Delete Account" onClick={() => setShowDeleteConfirm(true)} />
      </div>

      <DeleteAccountModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
      />
    </>
  )
}
