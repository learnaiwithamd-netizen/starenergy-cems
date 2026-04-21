export enum UserRole {
  ADMIN = 'ADMIN',
  AUDITOR = 'AUDITOR',
  CLIENT = 'CLIENT',
}

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  assignedStoreIds: string[]
  createdAt: string
}
