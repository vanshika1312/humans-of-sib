# Humans of SIB

The home of every teammate at **Skillinabox** — our internal HRMS platform.

Not a boring corporate tool. A place to live your SIB journey.

## What's inside

- 🧭 **Personal Journey** — your story at SIB, milestone by milestone
- 🏆 **Wins Wall** — share wins, clap for teammates
- 📣 **Direct to CEO** — ideas, concerns, kudos (anonymous option)
- 🤝 **Department Feedback** — kudos / constructive / requests across teams
- 🟢 **Attendance** — one-tap check-in (office / WFH / field)
- 💗 **Weekly Pulse** — one question, one minute, better every week
- 🎯 **OKRs** — year → quarter → month cascading goals
- 🤝 **1-on-1s** — agenda, notes, action items
- 🎓 **Internal Trainings** + SIB-certified certificates
- 📂 **My Documents** — offer letter, payslips, NDA, ESOP, Form 16…
- 🎉 **Celebrations** — birthdays & work-aversaries
- 🌱 **Onboarding Buddy** — 30 · 60 · 90 day plan
- 👋 **Offboarding** — clean, kind, complete
- 💎 **Learner Impact** — lives you've touched

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19
- **TypeScript 5**
- **Tailwind CSS 4** (brand-themed — cyan / orange / sun / ink)
- **Prisma 6** + **PostgreSQL** (Neon recommended)
- **NextAuth v5** with **Google SSO** (restricted to `@skillinabox.in`)
- **Vercel** deploy

## Getting started

```bash
# 1. Install
npm install

# 2. Set env vars (see .env.example)
cp .env.example .env.local

# 3. Set up the database (after DATABASE_URL is set)
npx prisma db push
npm run db:seed

# 4. Run dev
npm run dev
```

Visit http://localhost:3000

## Scripts

- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run db:push` — sync Prisma schema to database
- `npm run db:seed` — seed cities, departments, trainings
- `npm run db:studio` — open Prisma Studio

## Env vars

See `.env.example`. Required in production:

- `DATABASE_URL` — pooled Neon connection (Vercel-friendly)
- `DIRECT_URL` — direct Neon connection (for migrations)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_URL` — full prod URL (e.g. `https://humans.skillinabox.in`)
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth
- `ALLOWED_EMAIL_DOMAIN` — `skillinabox.in`

Optional — **LIA** (member assistant):

- `LIA_ENABLED` — set to `true` to show LIA in the app (defaults to on when an API key is set)
- `LIA_OPENROUTER_API_KEY` or `OPENROUTER_API_KEY` — OpenRouter / OpenAI-compatible key
- `LIA_MODEL` — optional (default `openai/gpt-4o-mini`; use a paid model if you hit provider rate limits)

HR manages LIA at `/admin/lia`: **Documents** for core policies (leave, attendance, pulse, benefits) and **Articles** for extra FAQs (summary + optional Google Doc/Notion link). Built-in policy slugs there are the canonical source for those topics.

Company-wide **Policy** uploads on **Documents** (`/documents`, scope “for all”) are extracted (PDF/DOCX text) and synced into LIA as `org-policy-*` knowledge articles so members can ask LIA about them. Use **Admin → LIA → Sync Documents policies → LIA** to re-index existing uploads. Scanned PDFs without selectable text need policy text pasted under Admin → LIA or a text-based PDF.

## Made with love by the SIB team

Empowering women across India — now, also empowering the team that empowers them.
