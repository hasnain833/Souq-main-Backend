# SOUQ Backend (APIs)

## Key Changes
- No separate admin server/port. Single backend on `PORT` (default 5000).
- CORS uses `FRONTEND_ORIGIN` in production; permissive in dev when not set.
- Email and Phone verification are supported and controlled via env flags.
- Real SMTP and SMS providers configurable via env.
- Added `scripts/seedAdmin.js` to seed an initial admin if none exists.

## Environment
Copy `.env.example` to `.env` and fill values:

- JWT/refresh settings
- MongoDB: `MONGODB_URI`
- CORS: `FRONTEND_ORIGIN` (prod)
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`
- Verification: `EMAIL_VERIFICATION_ENABLED=true`, `PHONE_VERIFICATION_ENABLED=true`
- SMS: `SMS_PROVIDER=twilio`, `TWILIO_SID`, `TWILIO_AUTH`, `TWILIO_PHONE`
- Admin seed (optional): `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, etc.

Keep only `.env` and `.env.example`. Remove `.env.local`.

## Seeding an initial admin
```
# .env must contain ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD
npm run seed:admin
```

## Run
```
npm install
npm start  # starts server.js on PORT
```

API base: `http://localhost:5000`
- User API: `/api/user`
- Admin API: `/api/admin`
- Health: `/health`

## Notes
- Emails: set real SMTP to avoid Ethereal fallback. `EMAIL_FROM` used as sender.
- SMS: currently Twilio only. Provide E.164 phone numbers (e.g., +1234567890).
