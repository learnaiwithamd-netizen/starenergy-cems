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

type RoleFilter = 'AUDITOR' | 'CLIENT'

const ROLE_LABEL: Record<RoleFilter, { plural: string; singular: string }> = {
  AUDITOR: { plural: 'Auditor accounts', singular: 'auditor' },
  CLIENT: { plural: 'Client accounts', singular: 'client' },
}

export function UsersPage(): JSX.Element {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('AUDITOR')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL')
  const usersQ = useUsersList({
    role: roleFilter,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  })

  const labels = ROLE_LABEL[roleFilter]

  return (
    <section aria-labelledby="users-heading">
      <h1 id="users-heading" className="text-2xl font-semibold">
        {labels.plural}
      </h1>

      <div role="tablist" aria-label="User role" className="mt-4 flex gap-2">
        <RoleTab userRole="AUDITOR" active={roleFilter === 'AUDITOR'} onSelect={setRoleFilter} />
        <RoleTab userRole="CLIENT" active={roleFilter === 'CLIENT'} onSelect={setRoleFilter} />
      </div>

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
        <CreateUserDialogTrigger role={roleFilter} />
      </div>

      <div className="mt-4">
        {usersQ.isLoading && <p>Loading users…</p>}
        {usersQ.isError && (
          <p role="alert" className="text-sm text-danger">
            Failed to load users — try refreshing.
          </p>
        )}
        {usersQ.data && usersQ.data.users.length === 0 && (
          <p className="text-sm text-muted">No {labels.singular} accounts yet.</p>
        )}
        {usersQ.data && usersQ.data.users.length > 0 && (
          <UsersTable users={usersQ.data.users} role={roleFilter} />
        )}
      </div>
    </section>
  )
}

function RoleTab({
  userRole,
  active,
  onSelect,
}: {
  userRole: RoleFilter
  active: boolean
  onSelect: (r: RoleFilter) => void
}): JSX.Element {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={() => onSelect(userRole)}
      className={`rounded border px-3 py-1 text-sm ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface'
      }`}
    >
      {userRole === 'AUDITOR' ? 'Auditors' : 'Clients'}
    </button>
  )
}

function UsersTable({ users, role }: { users: AdminUser[]; role: RoleFilter }): JSX.Element {
  const updateMut = useUpdateUser()
  const showStores = role === 'CLIENT'
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          {showStores && <TableHead>Assigned stores</TableHead>}
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
            {showStores && (
              <TableCell>
                <span title={u.assignedStoreIds.join(', ') || 'none'}>
                  {u.assignedStoreIds.length}
                </span>
              </TableCell>
            )}
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

function CreateUserDialogTrigger({ role }: { role: RoleFilter }): JSX.Element {
  const [open, setOpen] = useState(false)
  const labels = ROLE_LABEL[role]
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New {labels.singular}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {labels.singular} account</DialogTitle>
          <DialogDescription>
            The {labels.singular} will receive a welcome email with a link to set their password.
          </DialogDescription>
        </DialogHeader>
        <CreateUserForm role={role} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateUserForm({
  role,
  onSuccess,
}: {
  role: RoleFilter
  onSuccess: () => void
}): JSX.Element {
  const createMut = useCreateUser()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [storeIdsRaw, setStoreIdsRaw] = useState('')
  const [error, setError] = useState<string | null>(null)

  function parseStoreIds(s: string): string[] {
    return s
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      const assignedStoreIds = parseStoreIds(storeIdsRaw)
      const userRole = role === 'AUDITOR' ? UserRole.AUDITOR : UserRole.CLIENT
      await createMut.mutateAsync({ name, email, role: userRole, assignedStoreIds })
      setName('')
      setEmail('')
      setStoreIdsRaw('')
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
      <div>
        <label htmlFor="new-user-stores" className="block text-sm font-medium">
          Assigned stores
        </label>
        <Input
          id="new-user-stores"
          value={storeIdsRaw}
          onChange={(e) => setStoreIdsRaw(e.target.value)}
          placeholder="store-id-001, store-id-002"
          aria-describedby="new-user-stores-help"
          className="mt-1 w-full"
        />
        <p id="new-user-stores-help" className="mt-1 text-xs text-muted">
          {role === 'CLIENT'
            ? 'Store IDs (comma-separated). Gates which audits this client can read.'
            : 'Store IDs (comma-separated). UX filter for the store-selector — does not gate data access.'}
          {' '}Future stories will replace this with a store picker.
        </p>
      </div>
      <div role="alert" aria-live="assertive" className="min-h-[1.25rem] text-sm text-danger">
        {error}
      </div>
      <Button type="submit" disabled={submitDisabled} className="w-full">
        {createMut.isPending ? 'Creating…' : `Create ${ROLE_LABEL[role].singular}`}
      </Button>
    </form>
  )
}
