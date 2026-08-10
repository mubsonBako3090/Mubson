# KSU Procurement Requisition System

Digital procurement requisition system for Kaduna State University (KSU), built as a final-year project case study.

## Full scope (all 7 build stages complete)

- **Auth**: self-registration (role + college/faculty/department, pending admin approval), admin registration (self-locks at 2 admins), login (JWT, 24h expiry), logout, email-based password reset
- **Dashboards**: role-specific view for all 7 roles (Requester, HOD, Dean, Provost, VC, Procurement Officer, Admin)
- **Requisitions**: 3-step wizard (details → itemized list → review/attachments) with save-draft-and-resume, PDF export, list with status tabs, detail view, edit/resubmit
- **Approvals**: approve / return-for-clarification / reject (resubmittable or final), routed through the correct college-specific chain (including the Postgraduate and Basic Studies special paths), ₦10,000,000 escalation flag
- **Admin**: invite users directly, approve pending self-registrations, edit/deactivate accounts
- **Reports & Analytics**: breakdowns by status, college, department, category, with date/college filters
- **Audit Trail**: every status change, login, and edit, filterable by action/entity
- **Settings**: profile info, change password

## Scope boundaries (by design)

- No vendor directory, purchase orders, or budget/bursary module — the system ends at requisition approval
- No seed script — the first admin accounts are created via the self-locking `/register-admin` route
- Admin accounts hard-capped at exactly 2

## Tech stack

Next.js 14.2.3 (App Router) + React 18.3.1, Bootstrap 5.3.3, Zustand, Axios, React Hot Toast, CSS Modules (one per page, fully responsive) · Next.js API Routes on Node.js 18+, Mongoose 8.3.4, bcryptjs, jsonwebtoken, Nodemailer, PDFKit, Cloudinary, Joi, date-fns · MongoDB Atlas · Vercel + GitHub deployment

All pages/layouts/components are `.jsx`; API routes (`route.js`) and middleware stay `.js` per Next.js convention (they contain no JSX); models/lib/services/store/constants/utils stay `.js` as pure logic.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values (MongoDB Atlas URI, JWT secret, SMTP credentials, Cloudinary credentials)
3. Visit `/register-admin` to create your first administrator account (available only while fewer than 2 admins exist)
4. Log in as admin, then either invite users directly (`/users/invite`) or have them self-register at `/register` and approve them from `/users`
5. `npm run dev`

## Notes for the write-up

- Approval routing logic lives in `src/lib/routing.js` — this is the piece that encodes the Public Procurement Act-based hierarchy from Chapter 3, including the two special routing paths.
- The "returned for clarification" flow uses an `awaitingRequesterAction` flag on the Requisition model to distinguish "goes back to the previous approver" from "goes back to the requester" — worth explaining in your system design chapter.
- Reports use plain CSS bar visualizations rather than a charting library, since one wasn't in the finalized tech stack.
