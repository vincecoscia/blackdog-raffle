# Blackdog Raffle

The weekly draw for the Blackdog team. Everyone who turns in their timesheet gets
one entry; hit **Draw a winner** and the reel does the rest.

Built with Next.js 16 (Pages Router), React 19, Tailwind CSS 4, next-auth (Google
sign-in) and MongoDB via Mongoose.

## How it works

- **The reel** — a slot-machine strip of everyone in the draw. The draw itself
  happens on the server (`POST /api/raffle`) using `crypto.randomInt`, and the
  win is recorded in the same request, so what lands on the payline is always
  what's in the database. The client just animates toward the result:
  accelerate → cruise → constant-friction deceleration with the last few names
  ticking past → a spring "detent" bounce as it stops. Sound is synthesised
  with the Web Audio API (no audio files) and can be muted; motion respects
  `prefers-reduced-motion`.
- **The roster** — flip a teammate *in* once their timesheet is in, or *out* if
  they're sitting the week out. "Everyone in / Everyone out" resets the whole
  team in one write. Changes are optimistic and save in the background.
- **Profiles** — win history per teammate, plus editing and removal.
- **Access** — Google sign-in restricted to the suffixes in `EMAIL_WHITELIST`.
  Every API route requires a session.

## Running locally

```bash
cp .env.example .env   # then fill it in
npm install
npm run dev
```

Open <http://localhost:3000>. `npm run build && npm start` for a production
build; `npm run lint` runs ESLint.

## Project layout

```
pages/            routes (index = sign-in or dashboard, employee/*, api/*)
components/       UI — RaffleSlotMachine (the reel), WinnerReveal, Employees…
hooks/            useEmployees (optimistic roster state)
lib/              auth, data access (shared by API routes and SSR), reel maths,
                  sound, confetti, formatting
db/               Mongoose connection (cached for serverless) and models
styles/           Tailwind 4 theme tokens, keyframes and reusable classes
```

## API

All routes need a signed-in session.

| Method | Route                     | Purpose                                      |
| ------ | ------------------------- | -------------------------------------------- |
| GET    | `/api/employees`          | Roster, sorted by first name                 |
| POST   | `/api/employees`          | Add a teammate (`inDraw` defaults to true)   |
| GET    | `/api/employees/:id`      | Profile + win history                        |
| PUT    | `/api/employees/:id`      | Edit details, or `{ inDraw: true/false }`    |
| DELETE | `/api/employees/:id`      | Remove teammate and their wins               |
| PUT    | `/api/reset-entries`      | `{ inDraw }` for everyone at once            |
| GET    | `/api/raffle`             | Recent winners (`?limit=`)                   |
| POST   | `/api/raffle`             | Draw and record a winner                     |
| DELETE | `/api/raffles/:id`        | Strike a win from the record                 |
| GET    | `/api/hello`              | Unauthenticated health check                 |

> The `entries` field on employees is kept as `0`/`1` for compatibility with
> the original data; the app treats it as an in/out flag.
