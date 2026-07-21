# Design QA: supplied pigeon flap sprites

## Visual truth

- Source: `C:/Users/jleon/Documents/Codex/2026-07-20/local-files-create-a-new-project/.codex-remote-attachments/019f81dd-4fd3-76d2-8dc1-8433a2879074/343b9623-46e5-4e2c-8cd2-c5694cb5bf93/1-Photo-1.jpg`
- Implementation: local Vinext dev server at `http://localhost:4173`
- Viewport: 390×844, light color scheme, reduced motion enabled
- State: deterministic running game with the first pigeon fully visible

## Comparison evidence

- Combined full-view and focused comparison: `C:/Users/jleon/AppData/Local/Temp/jimothy-pigeon-design-comparison.png`
- The comparison places the source sheet's three-pigeon row directly above three distinct frames sampled from the live game canvas.
- Live samples measured 42×29, 40×29, and 38×29 dark-pixel bounds inside the shared 48×33 render slot.

## Findings

- The implementation reproduces all three supplied silhouettes: downstroke, mid-stroke, and raised wings.
- Each frame faces Jimothy, preserves the monochrome source pixels, and renders with nearest-neighbor scaling.
- The obstacle keeps a fixed flight slot; the sprite art changes without an artificial vertical translation.
- No clipping, stretching, game-shell overflow, framework error overlay, or browser error was observed.

## Comparison history

1. Initial capture confirmed the supplied row but caught the pigeon entering the viewport.
2. The sampling window was moved later in the deterministic run and shortened to 45 ms intervals.
3. Final comparison captured all three complete live poses alongside the source row.

## Final result

passed
