# Jimothy

Jimothy is a Codefair-ready, full-frame recreation of the Chrome Dino runner feel, re-themed as a monochrome alley sprint starring a raccoon. Jump trash cans and dumpsters, duck pigeons, and chase a device-local high score.

## Controls

- Jump: Space, Arrow Up, click, or tap anywhere in the game
- Duck: hold Arrow Down, or swipe down anywhere and keep holding on touch
- Restart: Space, click, or tap after a collision

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

## Score storage

The current score and `HI` score live inside the game canvas. The high score is stored only on the current device with the `jimothy_highscore` browser key. Jimothy has no leaderboard, login prompt, or account flow.

## Deployment

The repository is intended to be connected directly to the Vercel project named `Jimothy`. Pull requests receive preview deployments; merges to `main` deploy production. Submit the resulting production URL to Codefair as a sandboxed landscape project.
