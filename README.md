# Multi-Tenant Workflow Engine

A full-stack approval workflow system with tenant isolation. Organizations define custom state-machine workflows, route items through approval gates, enforce SLA deadlines, and maintain immutable audit trails.

**Stack:** Node.js + Express 5 | PostgreSQL | React 19

---

## Quick Start

### Prerequisites

- Node.js 18+, PostgreSQL 14+, npm

### Install & Run

```bash
# Install
cd backend && npm install
cd ../workflow-frontend && npm install

# Configure backend
cp backend/.env.example backend/.env   # or create manually:
# DATABASE_URL=postgres://user:pass@localhost:5432/workflow_db
# JWT_SECRET=your-secret
# PORT=3000
# CORS_ORIGIN=http://localhost:5173

# Database
createdb workflow_db
cd backend
npm run migrate
npm run seed

# Run (two terminals)
cd backend && npm run dev              # http://localhost:3000
cd workflow-frontend && npm run dev    # http://localhost:5173
```

### Seed Accounts

| Email | Password | Nexora Labs | Veltrix Co |
|---|---|---|---|
| admin@example.com | admin123 | ADMIN | USER |
| approver@example.com | approver123 | APPROVER | APPROVER |
| user@example.com | user123 | USER | — |
| manager@example.com | manager123 | APPROVER | ADMIN |

Seeded workflows:
- **Nexora Labs → Document Approval:** Draft → Under Review → Approved/Rejected
- **Veltrix Co → Purchase Request:** New → Manager Review → Completed/Denied

---

## Core Concepts

**Tenants** — Isolated organizations sharing one database. Users can belong to multiple tenants with different roles (ADMIN, APPROVER, USER).

**Workflows** — State machines with states (nodes) and transitions (edges). Each workflow has one initial state and at least one final state. Transitions can be direct or approval-gated.

**Approval Strategies:**
| Strategy | When item moves |
|---|---|
| SINGLE | Any one approver approves |
| ALL | Every assigned approver approves |
| QUORUM | N approvers approve (configurable) |

Rejection by any approver cancels all pending approvals for that transition.

**Items** — Documents/requests that flow through workflows. Each has a current state and a version number for concurrency control.

**SLA Rules** — "If item stays in state X for >Y hours, flag it." Background job checks every 5 minutes.

**Audit Trail** — Every action logged with before/after state. Database triggers prevent modification or deletion.

---

## Architecture

### Why These Choices

**Shared-database multi-tenancy** — Every table has `tenant_id`. Simpler than schema-per-tenant, no connection pool explosion, straightforward queries. Tenant isolation enforced at middleware layer.

**Optimistic + pessimistic locking** — `SELECT ... FOR UPDATE` prevents concurrent writes. `version` column catches stale UI reads. Together they prevent lost updates.

**Append-only workflows** — States and transitions are never deleted. Items always have valid state references. Deactivating a workflow stops new items without breaking in-progress ones.

**Immutable audit logs** — PostgreSQL triggers block UPDATE/DELETE on audit_logs. Logs store JSONB snapshots for full traceability.

**Background SLA checker** — Polling catches items that nobody touches (the exact scenario SLAs target). Uses bulk CTE query, no per-item loops.

**Case-insensitive enums** — All inputs normalized to uppercase via Zod `.transform()` before validation. Prevents cryptic database errors from casing mismatches.

### Request Flow

```
Request → Helmet → Compression → Rate Limiter → CORS → Request ID
  → Route → JWT Auth → Tenant Context → Role Check
  → Controller (Zod validation → Service → Response)
  → Error Handler Chain (if thrown)
```

### Layers

| Layer | Does | Doesn't |
|---|---|---|
| Controller | Parse request, validate with Zod, call service, return JSON | Touch DB, contain business logic |
| Service | Business logic, DB queries, transactions, audit logging | Know about HTTP (req/res) |
| Middleware | Auth, tenant scoping, role checks, error handling | — |

### Error Handling

Chain-of-responsibility pattern — first matching handler wins:

```
BodyParserError  → 400/413 (malformed JSON, payload too large)
ZodError         → 422 with field-level details
AppError         → mapped status codes (400–503)
PostgresError    → SQLSTATE mapping (23505→409, 23503→422)
Fallback         → 500 (details hidden in production)
```

---

## API Reference

All routes except `/auth/*` require `Authorization: Bearer <token>`.
Routes under `/workflows`, `/items`, `/approvals`, `/sla` also require `X-Tenant-Id: <uuid>`.
Enum values are case-insensitive.

### Auth
| Method | Path | Body |
|---|---|---|
| POST | /auth/register | `{ email, password }` |
| POST | /auth/login | `{ email, password }` → `{ token, user }` |
| GET | /auth/me | — |

### Tenants
| Method | Path | Role | Body |
|---|---|---|---|
| GET | /tenants | Any | — |
| POST | /tenants | Any | `{ name }` |
| GET | /tenants/:id/members | Any | — |
| POST | /tenants/:id/members | ADMIN | `{ email, role }` |
| DELETE | /tenants/:id/members/:userId | ADMIN | — |

### Workflows
| Method | Path | Role | Body |
|---|---|---|---|
| GET | /workflows | Any | — |
| POST | /workflows | ADMIN | `{ name, states[], transitions[] }` |
| GET | /workflows/:id | Any | — |
| PATCH | /workflows/:id | ADMIN | `{ states[], transitions[] }` (append-only) |
| PATCH | /workflows/:id/deactivate | ADMIN | — |

### Items
| Method | Path | Body |
|---|---|---|
| GET | /items | — |
| POST | /items | `{ workflowId, title }` |
| GET | /items/:id | — |
| GET | /items/:id/transitions | — |
| POST | /items/:id/transition | `{ transitionId, version, idempotencyKey? }` |
| POST | /items/batch-transition | `{ items: [{ itemId, transitionId, version }] }` |
| GET | /items/:id/audit | — |
| GET | /items/audit | `?actionType=&itemId=` |

### Approvals
| Method | Path | Body |
|---|---|---|
| GET | /approvals/pending | — |
| POST | /items/:itemId/approve | `{ decision }` (APPROVED/REJECTED) |
| POST | /approvals/batch-decide | `{ decision, itemIds[] }` |
| POST | /approvals/:id/delegate | `{ delegateToUserId }` |

### SLA
| Method | Path | Role | Body |
|---|---|---|---|
| GET | /sla/rules | Any | — |
| POST | /sla/rules | ADMIN | `{ workflowId, stateId, deadlineHours, escalationRole }` |
| DELETE | /sla/rules/:id | ADMIN | — |
| GET | /sla/breaches | Any | — |

### Pagination

All list endpoints accept `?page=1&limit=20` and return:
```json
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
```

### Health
`GET /health` → `{ status, uptime }` with DB connectivity check.

---

## Database Schema

12 migrations applied via `npm run migrate` (idempotent, tracked in `_migrations`).

| Table | Key Columns |
|---|---|
| users | id, email (unique), password_hash |
| tenants | id, name |
| tenant_members | user_id, tenant_id, role — UNIQUE(user_id, tenant_id) |
| workflows | id, tenant_id, name, is_active — UNIQUE(tenant_id, name) WHERE active |
| workflow_states | id, workflow_id, name, is_initial, is_final |
| workflow_transitions | id, workflow_id, from/to_state_id, requires_approval, approval_strategy, required_role — CHECK(from != to) |
| items | id, tenant_id, workflow_id, current_state_id, title, version |
| approvals | id, item_id, approver_id, transition_id, status, delegated_from — UNIQUE(item_id, approver_id, transition_id) |
| audit_logs | id, tenant_id, entity_type/id, action_type, metadata (JSONB), before/after_state (JSONB) — **immutable** |
| sla_rules | id, tenant_id, workflow_id, state_id, deadline_hours — UNIQUE(tenant_id, workflow_id, state_id) |
| sla_breaches | id, item_id, state_id, breached_at, escalated |

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Default |
|---|---|---|
| DATABASE_URL | Yes | — |
| JWT_SECRET | Yes | — |
| PORT | No | 3000 |
| CORS_ORIGIN | No | http://localhost:5173 |
| NODE_ENV | No | development |
| LOG_LEVEL | No | info |

### Frontend (`workflow-frontend/.env`)
| Variable | Required | Default |
|---|---|---|
| VITE_API_URL | No | http://localhost:3000/ |

---

## Known Limitations

- SLA checker uses in-process `setInterval` — use external scheduler for multi-instance deployments
- No real-time updates (WebSocket/SSE) — frontend refreshes on navigation
- No file attachments, email notifications, or webhook integrations
- JWT tokens expire after 1 hour — no refresh token mechanism yet
- No role hierarchy — ADMIN doesn't auto-inherit APPROVER permissions for approval decisions
