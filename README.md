# OS

A personal life-management app. Black navbar, light board-based workspace.

Tabs: **Home**, **Todo**, **Projects**, **Calendar**, **Focus**, **Check-in** (more to come).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Auth.js (NextAuth v5) with Google sign-in
- SQLite (`better-sqlite3`) — the database lives at `data/os.db`, no server to run
- `marked` for the project markdown, rendered through a small allow-list sanitizer
- Plain CSS, no UI framework, light/dark via CSS variables

## Setup

1. `npm install`

2. Create Google OAuth credentials:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create a project (or pick one) → **Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Under **OAuth consent screen**, publishing status can stay in *Testing*; add your own
     Gmail address as a test user.

3. Put the client ID and secret into `.env.local`:

   ```
   AUTH_GOOGLE_ID="....apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="...."
   ```

   `AUTH_SECRET` is already generated. `ALLOWED_EMAILS` is an allow-list — only those Google
   accounts can sign in; empty means anyone with a Google account can.

4. `npm run dev` → http://localhost:3000

### Looking around before OAuth is set up

`.env.local` has a commented `OS_DEV_EMAIL` line. Uncomment it and the app skips Google
sign-in locally, treating you as that email. It is ignored in production builds — comment it
back out once real sign-in works. Data created under it is keyed by email, so it carries over
to your real Google login.

## Running it like a Mac app

The server runs in the background from login, so there is no terminal step day to day.

```bash
npm run app:install
```

That builds for production and installs a LaunchAgent
(`~/Library/LaunchAgents/com.sepehr.lifeos.plist`) which:

- starts the server at login and restarts it if it ever dies,
- binds **127.0.0.1 only**, so nothing on your network can reach it,
- logs to `logs/server.log`.

Then put it in the Dock:

- **Chrome**: open http://localhost:3000 → ⋮ menu → *Cast, save & share* → *Install page as
  app* → name it **LifeOS**.
- **Safari**: open it → Share → *Add to Dock*.

You get a standalone LifeOS window with its own icon, in ⌘-Tab, no browser chrome.

| command | what it does |
| --- | --- |
| `npm run app` | rebuild after code changes and restart the background server |
| `npm run app:status` | is the agent loaded, is the port answering |
| `npm run app:logs` | tail the server log |
| `npm run app:uninstall` | stop it and remove it from login |
| `npm run dev` | the usual dev server on top of the same database |
| `npm run icons` | regenerate the app icons in `public/` |

`npm run dev` and the background server both want port 3000 — stop one before starting the
other (`npm run app:uninstall`, or just use the background one).

## How it works

### Home

The date, and a GitHub-style heatmap of your days. Click any square for that day: the score
broken into its parts, every todo you finished (with the project colour and which box it was
in), what else happened, and that day's check-in.

The shade is a 0–115 score built from **your own metrics and your own weights**.

Every scored metric carries a weight you set in the Metrics tab, in whatever units suit you —
45/20/15/20 and 9/4/3/4 behave identically, because the weights are normalised against their
own total and split a fixed 100 points between them. On top of that sits a **volume bonus** of
up to 15 for beating your 30-day median of completed todos.

Out of the box: *Productivity* 45, *Deep work* 20, *Did everything I needed* 15, *Todos done*
20. So a day you graded well with deep work is already green without any task arithmetic — a
pile of small todos can never carry a day on its own. Because 100 is the most the metrics can
give and the darkest shade starts at 105, a maxed check-in alone always lands one step short:
it can always be better.

Details worth knowing:

- **No check-in** → an empty outline, never a zero.
- A weighted metric you leave **blank** scores 0 but keeps its share, so skipping questions
  costs you. The day panel marks those rows *not filled in*.
- *Todos done* is filled in by the app, not by you. On a day with **nothing** in your Today
  boxes it drops out of the split entirely rather than scoring zero, and the other metrics
  scale up to 100 between them.
- Number and duration metrics need a **target** to be scorable — sleep with a target of 480
  minutes scores 7 hours as 0.875 of its share.
- New metrics start at weight 0: tracked, but not moving the score until you say so.
- The shade cut-offs live in `src/lib/scoring.ts`.

### Focus

A timer with an optional project. Start it and it keeps running server-side, so reloading or
walking away and coming back picks up the same session — only one can run at a time. *Discard*
throws a session away instead of recording it; anything under half a minute is dropped
automatically.

*Add time by hand* covers the sessions you didn't time: `90`, `1h30`, `1.5h` and `45m` all
parse, with a date and an optional note. Below that, the week broken down by project and the
last seven days of sessions.

Focus time shows up in Check-in → Insights. It does **not** feed the heatmap score yet — that
stays purely check-in and todos until there is enough logged time to calibrate against.

### Check-in

Three inner tabs:

- **Today** — one row per metric, saved the moment you touch it, with the running score.
- **Insights** — the score over time, focus time, each metric charted, and totals for the
  window (30 / 60 / 180 days). Gaps in a line mean nothing was logged, not zero.
- **Metrics** — define what you track and how much it counts: name, type (scale, yes/no,
  number, duration, note), weight, and a target where one is needed. Each row shows its live
  share of the score. *Todos done*, *Productivity*, *Deep work* and *Did everything I needed*
  are built in; they can be renamed and reweighted, but not deleted.

### ⌘K

Anywhere in the app, ⌘K (or Ctrl-K) opens quick capture. Type a todo and pick which box it
lands in, or type nothing and jump to a tab or a project. Arrow keys move, Enter picks, Escape
closes.

### Boards

Each tab is a dotted whiteboard. Everything on it is a window: drag by the header, resize
from the right/bottom edge or the corner, minimize with `–`, rename by double-clicking the
title. Right-click a window (or the `⋯` button) for its menu; right-click empty board space
to drop a new window right there. Position, size, stacking order and minimized state are all
saved per user.

**Loose text** goes straight on any board — *Add text*, or right-click → *Add text here*.
No window around it: hover for the grip to move it, the right edge to set its width.

### Theme

The sun/moon button in the navbar flips light ↔ dark; the choice is remembered and applied
before first paint. First visit follows your OS preference.

### Todo

- **Today** boxes are tied to the day. When the date rolls over (your local date, including
  while the tab stays open), one-off items are cleared and **recurring** items come back
  unchecked.
- Mark an item in a Today box recurring with the `↻` button on its row — it gets a colored tint and a
  colored left edge so the stuff you do every day is visible at a glance. The box menu has
  *Make all recurring*.
- **General** boxes never reset.
- Right-click a box → *Add todo*. Enter adds another line, Escape stops. Click text to edit,
  `×` to delete, checkbox to complete.
- The first time you open the tab you get one Today and one General box to start from.
- **Deadlines** are optional: right-click any todo → *Set deadline*. Quick picks (today /
  tomorrow / next week) or a date field. The row then shows a chip — red when overdue, bold
  on the day itself.
- **Add deadlines** drops a roll-up window that gathers every todo with a deadline, from
  every box *and* every project, soonest first, with the project colour and where it lives.
  Ticking one there completes the real todo. It is a view, so nothing is added directly into
  it.

### Projects

The board holds one window per project: name, dim description, progress bar. Click one to
open its page. Every project gets a fixed colour when it is created — shown as a bullet
before its name, and carried by any of its todos that you send to the Todo tab.

**Inside a project** there is no board — a plain white workspace instead:

- **Left rail**: every todo in the project, wherever it was created. Click the text to
  rename it, drag the grip on the left to reorder, star one (`☆`) to make it a *milestone*.
  Milestones sort into their own section at the top. Drag the divider to resize the rail; the
  width is remembered.
- **Progress**, under the top bar, has two modes. *Manual* — drag the bar to whatever
  percentage you want. *Milestones* — the bar is computed from completed milestones
  (`50% · 1/2`) and can't be dragged. The board window shows the same number either way.
- **Send to the Todo tab**: right-click a project todo → *Send a copy to* → one of your todo
  boxes. The original stays in the project; the copy carries the project's colour and stays
  linked, so ticking it off in either place ticks off the other (and moves the milestone
  progress bar). An arrow (`↗`) marks todos that have been sent. Deleting the project todo
  removes its copies; a copy sent to a *daily* box clears with everything else at midnight
  unless you mark it recurring.
- **Right pane**: switches between **Notes** and **Map**.
  - *Notes* is a markdown editor for everything about the project. *Write* / *Preview*
    toggle, autosaves as you type. GFM — tables, task lists, code fences, quotes, links.
  - *Map* is a board of the project's own, like the Todo tab: add **groups** to arrange
    todos, and loose text anywhere. It lives on its own tab (`project:<id>`) and behaves like
    every other board — drag, resize, minimise, rename, right-click.

**Rail and map are the same todos.** Anything added to a group on the map is created in the
project's list at the same time; ticking it off in either place ticks it off in both, and so
does renaming. Rail todos that are not on the map yet get a *Put on the map* section in their
right-click menu, listing every group. A `↗` marks the todos that are on the map (or on the
Todo tab).

Deleting differs by intent: a group's right-click menu deletes only the grouping, a todo's
*Take off the board* removes it from the map but keeps it in the project, and *Delete from the
project* removes it everywhere.

### Calendar

A read-only embed of your Google Calendar (week / month / agenda). It renders the calendar of
the Google account you are signed into *in the browser* — if the frame says you need
permission, sign in to that account in the same browser, or use **Open in Google**.

### History

Every todo event is written to an append-only `item_events` table — created, completed,
unchecked, deleted, and expired-at-midnight — with the box, the project, the text, and the
local day. The rows outlive the todos, so a task you finished and cleared still belongs to
its day. Nothing surfaces this yet; it is the foundation for the heatmap and the stats tab.

## Data

Everything is in `data/os.db`. `npm run app:install` also schedules a **nightly backup at
03:00** into `data/backups/`, keeping the last 14 days; `npm run backup` takes one now.
Deleting the database resets the app.

`OS_DB_PATH` points an instance at a different database file — useful for trying things out
without touching the real one.
