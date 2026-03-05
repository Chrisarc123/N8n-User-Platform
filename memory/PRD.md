# FlowPortal - n8n Client Portal PRD

## Original Problem Statement
Create an app that connects to n8n and serves as a client-facing UI. Clients receive workflow results without having direct access to n8n. Admin manages clients with granular permissions.

## Architecture
- **Backend**: FastAPI + MongoDB + JWT Auth
- **Frontend**: React + Shadcn/UI + Tailwind (Dark Theme)
- **Integration**: n8n via Webhook URLs + REST API + Callback endpoint

## User Personas
- **Admin**: Manages n8n workflows, creates client accounts, assigns granular permissions (view/trigger/download)
- **Client**: Views assigned workflows, triggers workflows, views results, downloads outputs

## Core Requirements
- JWT authentication (admin creates client accounts)
- Granular permissions per client per workflow (view, trigger, download)
- Webhook-based workflow triggering
- Async callback support for n8n results
- CSV/JSON result download
- Execution history tracking

## What's Been Implemented (March 2026)
- [x] Full backend API (auth, users, workflows, executions, assignments, settings, stats)
- [x] Login page (split screen, dark theme)
- [x] Admin Dashboard (bento grid stats, recent executions)
- [x] Admin Client Management (CRUD + permission assignment via toggles)
- [x] Admin Workflow Management (CRUD + input schema builder)
- [x] Admin Execution History (filterable, detail view)
- [x] Admin Settings (n8n connection config, callback URL)
- [x] Client Dashboard (workflow cards with permission badges)
- [x] Client Workflow Detail (trigger form, execution history, JSON result viewer)
- [x] Client Execution History
- [x] Download functionality (JSON + CSV)
- [x] Default admin: admin@flowportal.com / admin123

## Prioritized Backlog
### P0 (Done)
- Auth, CRUD, permissions, workflow trigger, results viewer

### P1
- Real-time execution status updates (WebSocket/polling)
- n8n REST API integration for fetching execution history from n8n
- Password change for users

### P2
- Email notifications on workflow completion
- Execution scheduling
- Result visualization (charts/tables for structured data)
- Bulk workflow assignment
- Activity audit log
- Multi-tenant support

## Next Tasks
1. Connect to a real n8n instance for end-to-end testing
2. Add real-time status polling for running executions
3. Add password change functionality for clients
4. Add result visualization for tabular data
