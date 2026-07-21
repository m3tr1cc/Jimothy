# AGENTS.md

## Project identity

Jimothy is a production, customer-facing Codefair game: a full-frame monochrome endless runner starring a raccoon in an urban alley. Treat this repository as real product code for real players, not a disposable prototype, landing page, or visual-only mock.

## Core stack

Stay on this stack unless a task explicitly changes it:

- Next.js 16 App Router source, built locally with Vinext for Sites compatibility
- React 19 and TypeScript
- Canvas 2D for gameplay and sprite rendering
- Web Audio API for synthesized sound effects
- Plain CSS for the full-frame application shell
- Node test runner for deterministic rules and rendered-output checks
- Vercel deployment linked to GitHub, with preview deployments for every pull request

Do not add a game engine, animation framework, component library, authentication flow, background music, copyrighted Chrome assets, or browser-exposed secrets. Keep dependencies focused and preserve the supplied Jimothy art direction.

## Product invariants

This is a real playable game. Never ship fake controls, decorative buttons that do nothing, app chrome around the game, frame-dependent physics, blurry sprites, or placeholder game states.

- The app fills the Codefair project frame and starts directly in the game.
- Space, Arrow Up, click, and a tap anywhere in the game shell jump. Arrow Down ducks; on touch, swipe down anywhere and hold to duck until release. Space restarts after a collision.
- Canvas uses an 800×200 internal resolution, nearest-neighbor scaling, time-based animation, and delta-time physics.
- Player collision boxes remain tighter than the sprite; pigeons ignore wing tips.
- Trash cans remain the most common obstacle, dumpsters unlock at 400, and animated pigeons are mixed into runs from the start at duck-required heights. Pigeons use the dedicated supplied atlas and flap through its raised-, mid-, and down-wing poses without artificial vertical bobbing.
- Speed begins at 6 px/frame, increases by 0.25 every 100 points, and caps at 13 px/frame.
- `jimothy_highscore` remains the device-local high-score key.
- The game is the entire interface: no header, footer, leaderboard, authentication, login prompt, score-submission flow, or surrounding controls.
- Score and `HI` remain visible inside the canvas. After a collision, Space, click, or tap starts a fresh run.
- Audio stays minimal, synthesized, user-initiated, and silent by default until interaction. No background music.

## Supabase migrations

For every task, explicitly decide whether the change requires Supabase schema, RLS, function, trigger, index, seed, or policy work. Jimothy intentionally uses only browser-local high-score storage, so do not add Supabase speculatively.

If Supabase becomes necessary:

- keep all database access server-side
- create a real migration under `supabase/migrations`
- enable and verify RLS; never expose a service-role key to the browser
- link the dedicated Jimothy Supabase project
- run database linting when available
- push required migrations before finishing
- verify application code against the deployed schema and policies
- report migration status in the final handoff

Do not leave required database work as TODOs, dashboard-only edits, or unapplied migrations.

## Required checks

Before finishing every task, run:

```bash
npm run lint
npm run check
npm run test
npm run build
```

For user-facing changes, also verify the affected flow in a real browser, check framework error overlays and console errors, exercise keyboard and pointer controls, confirm the game-only shell and restart flow, and respect `prefers-reduced-motion`.

## Pull request handoff

Every task must end in a pull request. Commit only intended files, push the task branch, create or update a PR, confirm the required checks, and verify its Vercel preview deployment. A task is not complete until the PR exists and its preview is healthy.
