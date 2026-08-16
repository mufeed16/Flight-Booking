# Flight Booking Module

A full-stack flight booking system built as a take-home assignment. Users can search flights, book seats with passenger details, pay via Stripe, and cancel for a refund. Admins can manage flights and view a dashboard.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, PostgreSQL, JWT, Stripe, Zod
- **Frontend:** React, TypeScript, Vite, React Router
- **Architecture:** MVC + Services layer (thin controllers, business logic in services)

## Project Structure

```
flight-booking/
├── backend/
│   ├── src/
│   │   ├── config/         # Env config
│   │   ├── db/             # Pool, schema, migrate, seed
│   │   ├── middleware/     # auth, error
│   │   ├── modules/
│   │   │   ├── auth/       # register, login, refresh, logout
│   │   │   ├── flights/    # search, get
│   │   │   ├── bookings/   # create, list, cancel, Stripe webhook
│   │   │   └── admin/      # flight CRUD, dashboard, all bookings
│   │   ├── utils/          # response, errors, asyncHandler, validate
│   │   ├── app.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── pages/          # Login, Register, Search, Booking, MyBookings, Admin*
    │   ├── context/        # AuthContext
    │   ├── api.ts          # fetch wrapper with auth header
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Stripe account (test keys)

### 1. Database

```bash
createdb flight_booking
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT secrets, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
npm install
npm run migrate     # creates tables (runs ts-node src/db/migrate.ts)
npm run seed        # inserts 10 mock flights + 2 users
npm run dev         # starts on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev         # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend.

### 4. Stripe webhook (for local testing)

```bash
stripe listen --forward-to localhost:4000/api/bookings/stripe/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` in `.env`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 4000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `JWT_ACCESS_TTL` | Access token TTL (default `15m`) |
| `JWT_REFRESH_TTL` | Refresh token TTL (default `7d`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `CANCELLATION_CUTOFF_HOURS` | Hours before departure when cancellation is allowed (default 24) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_...`) |

## Test Credentials

After seeding:

- **Admin:** `admin@jadwelny.com` / `admin123`
- **User:** `user@jadwelny.com` / `user123`

## API Endpoints

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create account, returns tokens + user data |
| POST | `/login` | — | Login, returns tokens + user data |
| POST | `/refresh` | — | Rotate refresh token |
| POST | `/logout` | — | Revoke refresh token |
| GET | `/me` | Bearer | Current user |

### Flights (`/api/flights`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Bearer | Search (`origin`, `destination`, `date`, `passengers`, `page`, `limit`) |
| GET | `/:id` | Bearer | Flight detail |

### Bookings (`/api/bookings`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Bearer | Create pending booking, returns Stripe `clientSecret` |
| GET | `/` | Bearer | List my bookings |
| GET | `/:id` | Bearer | Booking detail |
| POST | `/:id/cancel` | Bearer | Cancel + refund |
| POST | `/:id/simulate-payment` | Bearer | Simulate Stripe webhook delivery (demo) |
| POST | `/stripe/webhook` | Stripe sig | Webhook handler |

### Admin (`/api/admin`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/flights` | Admin | Create flight |
| PUT | `/flights/:id` | Admin | Update flight |
| DELETE | `/flights/:id` | Admin | Delete flight (refuses if active bookings) |
| GET | `/dashboard` | Admin | Stats: bookings/revenue today + total + cancellation rate |
| GET | `/bookings` | Admin | All bookings with filters |

## Architectural Decisions

### 1. MVC + Services

Controllers are thin — they parse input, call a service, and format the response. Business logic (validation, transactions, third-party calls) lives in services. This keeps routes readable and makes services unit-testable in isolation.

### 2. Flight data abstraction

`flight.service.ts` exposes `searchFlights`, `getFlightById`, `tryReserveSeats`, `releaseSeats`. Today it reads from PostgreSQL; tomorrow it could read from an external GDS (Amadeus, Sabre) or a cache without touching controllers.

### 3. Atomic seat reservation

Seat reservation uses a conditional UPDATE:

```sql
UPDATE flights
SET seats_available = seats_available - $1
WHERE id = $2 AND seats_available >= $1
```

If `rowCount === 0`, the flight is sold out. This is race-safe under concurrent bookings — no explicit lock needed.

### 4. Server-side refresh token revocation

Refresh tokens are stored in `refresh_tokens` with a `revoked` flag. On every refresh, the old token is marked revoked and a new pair is issued. Logout revokes the current refresh token. This means a stolen refresh token can be invalidated without waiting for expiry.

### 5. Stripe webhook as source of truth

Booking confirmation happens via `payment_intent.succeeded` webhook, not the client return. This handles network failures, abandoned checkouts, and retries correctly. The webhook handler is idempotent — re-delivery is safe.

### 6. Cancellation policy

Cancellations are blocked within `CANCELLATION_CUTOFF_HOURS` of departure (default 24h). Admins bypass this. Refunds are issued via Stripe and seats are released atomically with `SELECT ... FOR UPDATE` to prevent double-release.

## Trade-offs & Known Limitations

- **No seat selection map.** Seats are fungible; we only track count. A real product would let users pick seats.
- **No email notifications.** Booking confirmations and refund receipts are not sent.
- **No background job queue.** Webhook retries rely on Stripe's retry policy. A production system would use Bull/BullMQ for things like refund reconciliation.
- **No tests.** Time-boxed assignment; manual smoke testing only. The service layer is structured for easy unit testing.
- **Frontend payment is simulated.** The booking page collects card details in a form but does not call `stripe.confirmCardPayment` with Elements. In production, swap the form for `<Elements>` + `<PaymentElement>` from `@stripe/react-stripe-js`. The backend webhook flow is real.
- **No rate limiting on bookings.** Only auth endpoints are rate-limited. A real system would also throttle booking creation per user.
- **No pagination on admin bookings beyond `limit`.** Deep pagination would need cursor-based queries.

## Running Smoke Test

1. `npm run migrate && npm run seed` in `backend/`
2. `npm run dev` in `backend/` (port 4000)
3. `npm run dev` in `frontend/` (port 5173)
4. Open http://localhost:5173
5. Login as `user@jadwelny.com` / `user123`
6. Search `DEL` → `BOM`, pick a flight, fill passenger details, pay with test card `4242 4242 4242 4242`
7. Verify booking appears in "My Bookings" with status `confirmed`
8. Login as `admin@jadwelny.com` / `admin123`, visit `/admin` to see dashboard stats
