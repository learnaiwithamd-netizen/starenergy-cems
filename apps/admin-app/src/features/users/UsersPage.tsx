import { useState, type FormEvent, type JSX } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cems/ui'
import { UserRole, type AdminUser, type UserStatus } from '@cems/types'
import { useCreateUser, useUpdateUser, useUsersList } from './users-api'

export function UsersPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL')
  const usersQ = useUsersList({
    role: 'AUDITOR',
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  })

  return (
    <section aria-labelledby="users-heading">
      <h1 id="users-heading" className="text-2xl font-semibold">
        Auditor accounts
      </h1>
      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm">
          Status:&nbsp;
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'ALL')}
            className="rounded border border-border bg-surface px-2 py-1"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <CreateUserDialogTrigger />
      </div>

      <div className="mt-4">
        {usersQ.isLoading && <p>Loading users…</p>}
        {usersQ.isError && (
          <p role="alert" className="text-sm text-danger">
            Failed to load users — try refreshing.
          </p>
        )}
        {usersQ.data && usersQ.data.users.length === 0 && (
          <p className="text-sm text-muted">No auditor accounts yet.</p>
        )}
        {usersQ.data && usersQ.data.users.length > 0 && (
          <UsersTable users={usersQ.data.users} />
        )}
      </div>
    </section>
  )
}

function UsersTable({ users }: { users: AdminUser[] }): JSX.Element {
  const updateMut = useUpdateUser()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.name}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>{u.status}</TableCell>
            <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
            <TableCell className="text-right">
              <Button
                variant={u.status === 'ACTIVE' ? 'destructive' : 'outline'}
                onClick={() =>
                  updateMut.mutate({
                    id: u.id,
                    patch: { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
                  })
                }
                disabled={updateMut.isPending}
              >
                {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function CreateUserDialogTrigger(): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New auditor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create auditor account</DialogTitle>
          <DialogDescription>
            The auditor will receive a welcome email with a link to set their password.
          </DialogDescription>
        </DialogHeader>
        <CreateUserForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateUserForm({ onSuccess }: { onSuccess: () => void }): JSX.Element {
  const createMut = useCreateUser()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      await createMut.mutateAsync({ name, email, role: UserRole.AUDITOR })
      setName('')
      setEmail('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const submitDisabled = createMut.isPending || name.trim() === '' || email.trim() === ''

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="new-user-name" className="block text-sm font-medium">
          Name
        </label>
        <Input
          id="new-user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          className="mt-1 w-full"
        />
      </div>
      <div>
        <label htmlFor="new-user-email" className="block text-sm font-medium">
          Email
        </label>
        <Input
          id="new-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          className="mt-1 w-full"
        />
      </div>
      <div role="alert" aria-live="assertive" className="min-h-[1.25rem] text-sm text-danger">
        {error}
      </div>
      <Button type="submit" disabled={submitDisabled} className="w-full">
        {createMut.isPending ? 'Creating…' : 'Create auditor'}
      </Button>
    </form>
  )
}
