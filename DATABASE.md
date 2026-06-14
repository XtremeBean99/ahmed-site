# Database

## Provider

PostgreSQL via [Neon](https://neon.tech) — serverless PostgreSQL, compatible with Prisma, hosted on AWS.

## ORM

Prisma 6 — typed queries, no raw SQL, automatic schema management.

## Schema

### `ContactSubmission`

Stores contact form submissions. Used for:
- Email notification trigger
- Rate limiting (count by `ipHash` in time window)
- Record keeping

| Field | Type | Notes |
|---|---|---|
| `id` | `String (cuid)` | Primary key |
| `name` | `String` | Submitter name |
| `email` | `String` | Submitter email |
| `subject` | `String` | Message subject |
| `message` | `String` | Full message text |
| `ipHash` | `String` | SHA-256 hash of submitter IP |
| `createdAt` | `DateTime` | Submission timestamp |

Indexes: `(ipHash, createdAt)` for rate-limit queries, `(createdAt)` for admin queries.

### `Project` *(future)*

Project showcase entries. Fields: slug, title, summary, descriptionMd, year, tags, published, sortOrder.

### `Article` *(future)*

Written pieces / blog posts. Fields: slug, title, excerpt, contentMd, category, tags, published.

### `NewsletterSubscriber` *(future)*

Email subscribers. Fields: email (unique), confirmed, createdAt.

### `TutoringEnquiry` *(future)*

Dedicated tutoring booking flow. Fields: name, email, phone, subject, yearLevel, message, ipHash.

## Operations

```bash
# Push schema to database (development / initial setup)
npx prisma db push

# Generate a named migration (use for production schema changes)
npx prisma migrate dev --name add-field-name

# Apply pending migrations in production
npx prisma migrate deploy

# Open Prisma Studio (GUI browser for data)
npx prisma studio
```

## Rate Limiting Strategy

The contact API uses the database for rate limiting rather than in-memory state.
This works correctly across Vercel's serverless invocations (stateless per request).

```sql
-- Equivalent of the Prisma rate-limit check
SELECT COUNT(*) FROM "ContactSubmission"
WHERE "ipHash" = $1 AND "createdAt" >= NOW() - INTERVAL '1 hour'
```

Maximum 3 submissions per unique IP hash per 60-minute window.
