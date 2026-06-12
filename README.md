# ahmedyhussain.com

Personal website for Ahmed Hussain — built with Next.js 15, Prisma, Tailwind CSS, and Motion.

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or [Neon](https://neon.tech) serverless)
- [Resend](https://resend.com) API key for contact form emails

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env and fill in all values

# 3. Hash your admin password
node scripts/hash-password.mjs "your-password"
# Copy the hash into ADMIN_PASSWORD_HASH in .env

# 4. Generate Prisma client
npx prisma generate

# 5. Run the database migration
npx prisma migrate dev --name init

# 6. Seed the database
npx prisma db seed

# 7. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push the repository to GitHub
2. Import the project in Vercel
3. Set environment variables in Vercel project settings:
   - `DATABASE_URL` — your PostgreSQL connection string (Neon recommended)
   - `RESEND_API_KEY` — Resend API key
   - `CONTACT_TO_EMAIL` — email to receive contact form messages
   - `ADMIN_PASSWORD_HASH` — bcrypt hash of your admin password
   - `SESSION_SECRET` — random string (at least 32 characters)
4. Deploy. The build command is `npx prisma generate && next build`
5. Run migrations against your production database:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

## Admin panel

Visit `/admin/login` and sign in with your password. From the admin dashboard
you can:

- Create, edit, publish, and delete blog posts (Markdown)
- Create, edit, publish, and delete project entries
- Read and manage contact form messages

## Environment variables

| Variable              | Description                           |
| --------------------- | ------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string          |
| `RESEND_API_KEY`      | Resend API key for emails             |
| `CONTACT_TO_EMAIL`    | Destination for contact form emails   |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password         |
| `SESSION_SECRET`      | JWT signing secret (32+ chars)        |

## Project structure

```
src/
├── app/             # App Router pages and API routes
├── components/      # React components
├── lib/             # Utilities (prisma, auth, email, rate-limiter)
middleware.ts        # Auth middleware for /admin routes
prisma/
├── schema.prisma    # Database schema
├── seed.ts          # Seed data
scripts/
└── hash-password.mjs
```
