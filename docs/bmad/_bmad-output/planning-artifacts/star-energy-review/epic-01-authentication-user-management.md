## Epic 1: Authentication & User Management

All three user types (Auditor, Admin, Client) can log in and access only their permitted surface and data. Admin can create and manage user accounts.

**FRs covered:** FR38, FR39, FR40, FR41, FR42

---

### Story 1.1: Email/Password Login & JWT Issuance

As a user (Auditor, Admin, or Client),
I want to log in with my email and password,
So that I receive a JWT that grants me access to exactly the surfaces and data my role permits.

**Acceptance Criteria:**

**Given** a valid email and password are submitted to POST `/api/v1/auth/login`,
**When** credentials match a user in the database,
**Then** an access token (role-embedded JWT) and a refresh token are returned; access token TTL is 8h for Auditor, 4h for Admin/Client

**Given** an invalid email or wrong password is submitted,
**When** the login route processes the request,
**Then** RFC 7807 401 is returned — no hint whether email or password was wrong (no enumeration)

**Given** a valid access token is included in an API request,
**When** the auth middleware validates it,
**Then** the request proceeds with role and tenant_id extracted from the token — no database lookup on every request

**Given** an expired access token is used,
**When** the auth middleware checks expiry,
**Then** RFC 7807 401 is returned with `type: "token-expired"`

**Given** POST `/api/v1/auth/refresh` is called with a valid refresh token,
**When** the refresh token is found in user_sessions and not expired,
**Then** a new access token and rotated refresh token are returned; the old refresh token is invalidated

**Given** POST `/api/v1/auth/logout` is called,
**When** the refresh token is revoked,
**Then** the user_sessions row is deleted and subsequent refresh attempts with that token return 401

---

### Story 1.2: Role-Based Surface Access & Route Guards

As a user,
I want my browser to route me to the correct application surface on login,
So that Auditors only see the Site Audit App, Admins see the Admin Console, and Clients see the Client Portal.

**Acceptance Criteria:**

**Given** an Auditor logs in,
**When** authentication succeeds,
**Then** the browser navigates to the audit-app — the admin-app and client-portal URLs redirect to the audit-app login

**Given** an Admin logs in,
**When** authentication succeeds,
**Then** the browser navigates to the admin-app — the audit-app and client-portal URLs redirect to the admin-app login

**Given** a Client logs in,
**When** authentication succeeds,
**Then** the browser navigates to the client-portal — the audit-app and admin-app URLs redirect to the client-portal login

**Given** an unauthenticated user attempts to navigate to any protected route,
**When** the React Router auth guard runs,
**Then** the user is redirected to the login page for that surface

**Given** a Client-role JWT is used to call an Admin-only API endpoint,
**When** the auth middleware checks role permissions,
**Then** RFC 7807 403 is returned

---

### Story 1.3: Admin User Management — Auditor Accounts

As an Admin,
I want to create, edit, and deactivate Auditor accounts,
So that field technicians can be onboarded and offboarded without engineering involvement.

**Acceptance Criteria:**

**Given** an Admin submits POST `/api/v1/users` with `role: "AUDITOR"` and valid email,
**When** the request is processed,
**Then** a new user record is created, a welcome email is sent with a password-set link, and the account is ACTIVE

**Given** an Admin submits PATCH `/api/v1/users/:id` with updated name or email,
**When** the request is processed,
**Then** the user record is updated and changes take effect immediately

**Given** an Admin submits PATCH `/api/v1/users/:id` with `status: "INACTIVE"`,
**When** the request is processed,
**Then** the user is deactivated; any active sessions for that user are revoked; the user cannot log in

**Given** an Admin views GET `/api/v1/users?role=AUDITOR`,
**When** the response is returned,
**Then** only Auditor accounts scoped to the Admin's tenant are listed (RLS enforced)

---

### Story 1.4: Admin User Management — Client Accounts & Site Assignment

As an Admin,
I want to create Client accounts and assign them to specific store locations,
So that clients can log in and see only the data for their sites — no other client's data is ever visible.

**Acceptance Criteria:**

**Given** an Admin submits POST `/api/v1/users` with `role: "CLIENT"` and a list of `assignedStoreIds`,
**When** the request is processed,
**Then** a Client user is created with store assignments stored; a welcome email is sent

**Given** a Client user logs in and calls GET `/api/v1/audits`,
**When** Azure SQL RLS applies the client's assigned store IDs,
**Then** only audit records for their assigned stores are returned — confirmed by attempting to fetch an audit for an unassigned store and receiving 404

**Given** an Admin updates a Client's store assignments via PATCH `/api/v1/users/:id`,
**When** new assignments take effect,
**Then** the Client immediately gains access to newly assigned stores and loses access to removed ones on their next API call

**Given** an Admin deactivates a Client account,
**When** the Client attempts to log in,
**Then** login fails with 401; active sessions are revoked

---

