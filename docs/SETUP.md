# Deployment setup

1. **Database** — create a Postgres database (Supabase: Project → Database → connection string, use the pooled one). Set `DATABASE_URL`, then run `npm run db:migrate` and `npm run db:seed:reference` against it. Never run `db:seed:demo` in production (it refuses non-local databases).
2. **Auth** — set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to the public origin.
3. **Storage** — create a public bucket on an S3-compatible service and implement/enable the S3 driver in `src/lib/storage/index.ts` (`STORAGE_DRIVER=s3`, `S3_*`). Until then the app refuses to store images in production.
   - **MOTORNA Care documents** need a second, **private** bucket (Supabase: `care-private`, not public, 5 MB, `application/pdf` and `image/webp`). Set `S3_PRIVATE_BUCKET=care-private` in Vercel. It uses the same S3 keys; the files are only streamed through `/api/care/credentials/[id]` after an auth check.
4. **Email** — add a provider in `src/lib/email.ts` and set `EMAIL_PROVIDER`.
5. **Hosting** — Vercel: import the repo, framework Next.js, add the env vars above.
6. **First admin** — sign up, then `UPDATE users SET role = 'admin' WHERE email = 'you@…';`.

## Email (Resend)

Password recovery, listing approved/rejected, and service-center status emails use Resend.

| Variable | Example | Notes |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | Anything else on Vercel means **no emails are sent** (and nothing sensitive is logged). |
| `RESEND_API_KEY` | `re_…` | Secret. Add it in Vercel only, never in code or chat. Use "Sending access" for this domain only. |
| `EMAIL_FROM` | `MOTORNA <no-reply@mail.yourdomain.com>` | Must use a domain verified in Resend. |

Resend only sends to arbitrary recipients from a **domain you own and have verified** (DNS records: SPF, DKIM, and optionally DMARC). `motorna.vercel.app` can't be verified. Until a domain is verified, Resend's test sender delivers only to the Resend account's own email.

Without these variables, the forgot-password page tells people that email reset isn't available yet, and moderation emails are skipped. The actions themselves still work.
