# KAWUO IT Service Desk

A responsive IT ticketing portal for Karamoja Women Umbrella Organisation (KAWUO). Staff can submit incidents and service requests, track status, give resolution feedback, and request consent-based remote help. IT can triage and assign tickets, maintain the staff directory, record resolution notes, and prepare monthly management reports.

## What is included

- Staff sign-in and account requests, with administrator approval and role-based access.
- Ticket categories, priorities, status and assignment controls, filtering, and service metrics.
- Feedback from the requester on whether the issue is resolved, with comments for IT and management.
- Monthly reporting dashboard and CSV export. Reports are prepared on demand; the app does not email them automatically.
- Remote assistance requests and session tracking. Actual screen sharing takes place through Microsoft Quick Assist after the staff member approves access on their own device. The portal does not take remote control or retain a session code.
- KAWUO branding, sample tickets and a starter directory based on the supplied staff list.

## Runtime and security

This source is a Vinext/React application using Cloudflare D1 for persistence. The existing private deployment uses Sites hosting and its Sign in with ChatGPT identity headers. The app trusts those headers **only** behind the Sites authentication layer. Do not expose the worker directly with user-supplied identity headers or deploy this source as a static cPanel site.

New users sign in through the host identity provider and then request a staff profile. Staff cannot grant themselves elevated roles. Set the private `IT_SUPPORT_EMAIL` binding to the designated IT account to activate the Systems Administrator. Do not commit its value or any credentials. Password reset belongs to the identity provider; the Forgot password link opens its help flow. The seeded directory entries are suggestions, not credentials or invitations.

The public GitHub repository holds source code. It is separate from the private deployed website and does not make the service desk publicly accessible.

## Development

Use Node.js 22.13 or later. Install dependencies with `npm run install:ci`, then start the local preview with `npm run dev`. The local portable preview has a simulated identity for development; it is not a production account system.

The D1 schema migrations are in `drizzle/`. Apply them to the target D1 binding before using a new installation. `npm run build` builds the Worker and `npm run lint` checks the source. Production hosting requires a private authentication layer that supplies the identity headers, the D1 `DB` binding, and a private `IT_SUPPORT_EMAIL` binding.

The requested `kawuo-it-services-desk.kawuo.org` subdomain can point to a compatible private app host after DNS and TLS configuration. Ordinary cPanel static file hosting cannot run this Worker and D1 application unchanged; a move to cPanel would require a compatible backend and authentication deployment plan.

© KAWUO. Systems Developer: LOMER Francis Peter, IT-KAWUO.
