# Booking System

Fullstack booking system built with Bun + Cloudflare Pages + TiDB (MySQL).

## Project Structure

```
├── dist/                  # Built frontend files
├── functions/             # Cloudflare Pages Functions (API)
│   └── api/[[route]].ts   # All API routes
├── src/                   # React frontend source
├── src/db/                # Database scripts (run locally only)
├── .dev.vars              # Local environment variables (gitignored)
└── wrangler.toml          # Cloudflare config
```

## Setup

1. Install dependencies:
```bash
bun install
```

2. Create `.dev.vars` for local development:
```bash
DB_URL=mysql://user:pass@host:port/database
JWT_SECRET=your-secret-min-32-chars
ALLOWED_ORIGIN=*
```

3. Initialize database (first time only):
```bash
DB_USER=xxx DB_PASS=xxx ADMIN_PASSWORD=YourSecurePassword123 bun run db:setup
```

4. Run locally:
```bash
bun run dev      # Frontend dev server
bun run api      # API server (in another terminal)
```

## Production Deployment

1. Build frontend:
```bash
bun run build
```

2. Set secrets in Cloudflare (NEVER commit these):
```bash
wrangler secret put DB_URL
wrangler secret put JWT_SECRET
```

3. Deploy:
```bash
bun run deploy
```

## Security Features

- **Password Hashing**: PBKDF2 with 100k iterations
- **JWT Authentication**: Stateless tokens (6-hour expiry)
- **Rate Limiting**: Login (5/min), Bookings (10/min)
- **Input Validation**: Email format, string length limits
- **CORS**: Configurable allowed origins
- **No Hardcoded Secrets**: All credentials via environment variables

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_URL` | TiDB/MySQL connection string | Yes |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) | Yes |
| `ALLOWED_ORIGIN` | CORS allowed origins (comma-separated, or `*`) | No |

## URLs

- Student booking: `/`
- Staff portal: `/staff`

## API Endpoints

### Public
- `GET /api/subjects` - List active subjects
- `GET /api/slots/:subjectId` - Get available slots
- `POST /api/bookings` - Create a booking
- `POST /api/login` - Staff login

### Protected (requires Bearer token)
- `GET /api/staff/data` - Dashboard data
- `GET /api/staff/stats` - Statistics
- `POST /api/staff/subjects` - Create subject
- `PUT /api/staff/subjects/:id` - Update subject
- `DELETE /api/staff/subjects/:id` - Delete subject
- `GET /api/staff/slots` - List slots with filters
- `POST /api/staff/slots/generate` - Generate slots
- `PUT /api/staff/slots/:id` - Update slot
- `DELETE /api/staff/slots/:id` - Delete slot
- `POST /api/staff/slots/bulk-delete` - Bulk delete slots
- `GET /api/staff/users` - List users
- `POST /api/staff/users` - Create user
- `PUT /api/staff/users/:id` - Update user
- `DELETE /api/staff/users/:id` - Delete user
- `PUT /api/staff/bookings/:id` - Update booking status
- `DELETE /api/staff/bookings/:id` - Cancel booking


## Email Notifications Setup (Optional)

The system can send confirmation emails via Google Apps Script + Gmail.

### Setup Steps:

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Copy the code from `docs/google-apps-script.js`
4. Change `API_SECRET` to a secure random string
5. Click Deploy > New deployment > Web app
6. Set "Execute as" to your account
7. Set "Who has access" to "Anyone"
8. Deploy and copy the URL

### Add secrets to Cloudflare:
```bash
wrangler secret put EMAIL_API_URL    # The Apps Script URL
wrangler secret put EMAIL_API_SECRET # The API_SECRET you set
```

### For local development:
Add to `.dev.vars`:
```
EMAIL_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
EMAIL_API_SECRET=your-secret-key
```
