# Jimothy

Jimothy is a Codefair-ready, full-frame recreation of the Chrome Dino runner feel, re-themed as a monochrome alley sprint starring a raccoon. Jump trash cans and dumpsters, duck pigeons, and chase a global Codefair score.

## Controls

- Jump: Space, Arrow Up, click, or tap
- Duck: hold Arrow Down, or swipe down and keep holding on touch
- Restart: Space, click, or tap after a collision
- Leaderboard: Global Top 10 button or `L`

## Development

```bash
npm install
npm run dev
```

Required checks:

```bash
npm run lint
npm run check
npm run test
npm run build
```

`npm run build:vercel` validates the native Next.js build used by Vercel. The default build keeps the Sites-compatible Vinext output.

## Codefair leaderboard contract

Jimothy does not invent a second login system. When embedded, it requests the signed-in Codefair user and global rankings from the parent frame:

```ts
{ type: "codefair:leaderboard:request", version: 1, game: "jimothy" }
```

Codefair responds with:

```ts
{
  type: "codefair:leaderboard:state",
  version: 1,
  game: "jimothy",
  user: { id: "user-id", displayName: "Player" } | null,
  entries: [{ rank: 1, userId: "user-id", displayName: "Player", score: 1234 }]
}
```

Completed authenticated runs are submitted to the parent:

```ts
{
  type: "codefair:leaderboard:submit",
  version: 1,
  game: "jimothy",
  score: 1234,
  runId: "uuid",
  durationMs: 84210
}
```

The host owns authentication, anti-abuse validation, persistence, and global ranking. Standalone play remains fully functional with the browser-local high score, while anonymous completed runs show `log in to save your score`.

## Deployment

The repository is intended to be connected directly to the Vercel project named `Jimothy`. Pull requests receive preview deployments; merges to `main` deploy production. Submit the resulting production URL to Codefair as a sandboxed landscape project.
