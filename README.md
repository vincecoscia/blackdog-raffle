# Blackdog Raffle

The weekly draw for the Blackdog team. Everyone who turns in their timesheet gets
one entry; hit **Draw a winner** and the dog fetches the winner's bone.

Built with Next.js 16 (Pages Router), React 19, Tailwind CSS 4, next-auth (Google
sign-in) and MongoDB via Mongoose.

## How it works

- **The draw is server-side.** `POST /api/raffle` picks uniformly at random
  from everyone in the draw with `crypto.randomInt` and records the win in the
  same request. The animation only acts out a result that's already decided
  and saved.
- **The animation** ([components/DogFetch.js](components/DogFetch.js)) — a 2D
  SVG scene: a black dog next to a pile of bones, one per teammate. Each draw
  shuffles the pile and plays one of six random routines (dig, around the
  back, fake-out, sniffer, cannonball, zoomies); the dog brings back a mystery
  "?" bone and flips it over to reveal the name. Nothing on screen hints at the
  winner before the flip. Sound (drumroll, scratches, fanfare) is synthesised
  with the Web Audio API and can be muted; `prefers-reduced-motion` gets a
  simple name shuffle instead.
- **Big screen** — the expand button next to the sound toggle makes the stage
  full screen for drawing live in a meeting. Space draws, Esc exits.
- **Seasonal skins** — picked by date (see `CALENDAR` in DogFetch.js):
  New Year (Jan 1–7), Valentine's (Feb 1–14), St. Patrick's (Mar 10–17),
  spring (Apr–May), summer (Jun–Aug), Halloween (Oct), autumn (Nov) and
  holiday (Dec); the brand look otherwise.
- **Fairness** — [/fairness](pages/fairness.js) explains the draw in plain
  language (why repeat winners are normal) and runs 100,000 live test draws
  through the real pick function. The pick itself lives in
  [lib/draw.js](lib/draw.js), shared by the draw, the page and the tests.
- **Winner card** — each draw gets a shareable 1200×630 PNG
  (`/api/card/:id?sig=…`): the pup holding a bone with the winner's name, in
  the seasonal skin that was on screen. The URL is public so Google Chat can
  fetch it, but signed so cards can't be generated for arbitrary draws.
  "Save card" downloads it; "Share to Google Chat" posts it (once per draw)
  when `GOOGLE_CHAT_WEBHOOK_URL` is set.
- **Preview/testing params** — `?theme=<name>|none` forces a skin and
  `?variant=dig|around|fakeout|sniffer|cannonball|zoomies` forces a routine.
  Note that every draw is recorded, so delete test wins from the teammate's
  profile page afterwards.
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

`npm test` runs the fairness tests ([tests/fairness.test.js](tests/fairness.test.js)):
millions of draws through the real pick function, checking every entry is
equally likely, that draws are independent (no streaks, no "avoid the last
winner"), and that the numbers quoted on the fairness page match simulation.
Each check uses a 1-in-10,000 significance level, so a rare failure is worth
re-running once before investigating.

### Google Chat

A space manager creates an incoming webhook (space name → Apps & integrations →
Webhooks → Add webhook) and the URL goes in `GOOGLE_CHAT_WEBHOOK_URL` (Vercel
env). Requires a Google Workspace org that allows incoming webhooks. If the
space rejects card messages, the post falls back to text with the image link.

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
| POST   | `/api/raffles/:id/share`  | Post the winner card to Google Chat (once)   |
| GET    | `/api/fairness`           | Run test draws (`?n=&draws=`), nothing saved |
| GET    | `/api/card/:id?sig=`      | Winner card PNG (public, signed)             |
| GET    | `/api/hello`              | Unauthenticated health check                 |

> The `entries` field on employees is kept as `0`/`1` for compatibility with
> the original data; the app treats it as an in/out flag.
