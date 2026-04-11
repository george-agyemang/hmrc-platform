# HMRC MTD Digital Reporting Platform

A lightweight, production-ready platform for submitting nil and dormant returns
via HMRC's Making Tax Digital APIs.

---

## Architecture

```
hmrc-platform/
├── backend/                        Node.js + Express API
│   ├── prisma/schema.prisma        Database schema (PostgreSQL)
│   └── src/
│       ├── config/
│       │   ├── db.js               Prisma client singleton
│       │   └── hmrc.js             HMRC API config & validation
│       ├── middleware/
│       │   ├── fraudPrevention.js  HMRC mandatory fraud headers
│       │   └── requireAuth.js      Platform session guard
│       ├── routes/
│       │   ├── auth.js             HMRC OAuth flow
│       │   ├── users.js            Platform register/login
│       │   ├── businesses.js       Business CRUD
│       │   └── submissions.js      Obligations + submission endpoints
│       └── services/
│           ├── hmrcAuth.service.js    Token exchange & refresh
│           ├── hmrcClient.service.js  Authenticated HMRC API client
│           ├── tokenStore.service.js  DB token storage with auto-refresh
│           ├── obligations.service.js VAT & ITSA obligation lookups
│           ├── submission.service.js  Nil VAT & dormant CT builders
│           └── platformAuth.service.js User auth (bcrypt + JWT)
│
└── frontend/                       React + Vite + Tailwind
    └── src/
        ├── components/
        │   └── ProtectedRoute.jsx  Auth guard wrapper
        ├── hooks/
        │   └── useAuth.js          Auth context + session restore
        ├── pages/
        │   ├── Auth.jsx            Login + Register
        │   ├── ConnectHmrc.jsx     HMRC OAuth connect UI
        │   ├── AuthCallbacks.jsx   Success / Error pages
        │   ├── Dashboard.jsx       Main dashboard
        │   ├── AddBusiness.jsx     Business registration form
        │   └── SubmitReturn.jsx    Manual submission form
        └── services/
            └── api.js              Axios client for all endpoints
```

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL (local or cloud — Supabase free tier works well)

### 2. Environment setup

```bash
cd backend
cp .env.example .env
# Fill in: HMRC_CLIENT_ID, HMRC_CLIENT_SECRET, DATABASE_URL, JWT_SECRET

cd ../frontend
cp .env.example .env.local
# VITE_API_URL is pre-set to http://localhost:3001
```

### 3. Install & migrate

```bash
# Backend
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate

# Frontend
cd ../frontend
npm install
```

### 4. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:3000

---

## User Journey

1. **Register** at `/register` → platform account created
2. **Connect HMRC** at `/connect` → OAuth redirect to HMRC sandbox
3. **Authenticate** with HMRC sandbox test user credentials
4. **Add businesses** at `/businesses/new` → enter VRN / UTR / CRN
5. **View obligations** on dashboard → outstanding VAT periods loaded from HMRC
6. **Submit returns** — one click nil VAT, or full form at `/businesses/:id/submit`
7. **View history** — all submissions with HMRC receipt IDs on dashboard

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | /auth/hmrc?userId= | Initiate HMRC OAuth |
| GET | /auth/callback | HMRC redirect handler |
| GET | /auth/status | Check HMRC connection |
| POST | /auth/logout | Clear session |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /users/register | ✗ | Create account |
| POST | /users/login | ✗ | Login |
| GET | /users/me | ✓ | Profile + HMRC status |
| POST | /users/logout | ✓ | Clear session |

### Businesses
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /businesses | ✓ | List businesses |
| POST | /businesses | ✓ | Add business |
| GET | /businesses/:id | ✓ | Get business + submissions |
| PUT | /businesses/:id | ✓ | Update business |

### Submissions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /submissions/obligations/vat/:businessId | ✓ | Outstanding VAT periods |
| POST | /submissions/vat/nil | ✓ | Submit nil VAT return |
| POST | /submissions/ct/dormant | ✓ | Submit dormant CT return |
| GET | /submissions/:businessId | ✓ | Submission history |
| GET | /submissions/receipt/:id | ✓ | Single submission detail |

---

## HMRC Sandbox Testing

1. Log into https://developer.service.hmrc.gov.uk
2. Go to **Test User** → Create a test organisation
3. Note the test VRN and credentials
4. Register at `/register`, then connect HMRC at `/connect`
5. Use the test credentials on the HMRC login page
6. Add a business with the test VRN — obligations will load from sandbox

---

## What's Complete

- [x] HMRC OAuth 2.0 flow with CSRF protection
- [x] Token exchange, storage, and auto-refresh
- [x] HMRC fraud prevention headers (mandatory)
- [x] Platform user registration and login (bcrypt)
- [x] Protected routes with JWT session cookies
- [x] Business management (Sole Trader, Ltd, Partnership)
- [x] VAT obligations lookup from HMRC
- [x] Nil VAT return submission
- [x] Dormant CT return submission
- [x] Duplicate submission prevention
- [x] Full submission audit trail in database
- [x] Dashboard with obligations and history
- [x] Add Business form with identifier validation
- [x] Manual Submit Return form
- [x] Auth success/error handling pages
- [x] Rate limiting, Helmet security headers

## What's Next (Production Checklist)

- [ ] ITSA (Income Tax) obligation lookup and submission
- [ ] Email notifications for upcoming deadlines
- [ ] Multi-user support (accountant managing multiple clients)
- [ ] Stripe subscription billing
- [ ] HMRC compatibility testing (required before going live)
- [ ] Apply to HMRC recognised software list
- [ ] Migrate state store from Map to Redis (for auth CSRF tokens)
- [ ] Add HTTPS + production domain
- [ ] ICO registration for data processing
