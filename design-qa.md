# Design QA: consistent score typography

## Visual truth

- Source first-run screenshot: `C:/Users/jleon/Documents/Codex/2026-07-20/local-files-create-a-new-project/.codex-remote-attachments/019f81dd-4fd3-76d2-8dc1-8433a2879074/36f253d1-640f-43dd-a0f4-68c1a9f9985e/1-Photo-1.jpg`
- Source GAME OVER screenshot: `C:/Users/jleon/Documents/Codex/2026-07-20/local-files-create-a-new-project/.codex-remote-attachments/019f81dd-4fd3-76d2-8dc1-8433a2879074/36f253d1-640f-43dd-a0f4-68c1a9f9985e/2-Photo-2.jpg`
- Implementation screenshots: `C:/Users/jleon/AppData/Local/Temp/jimothy-score-waiting.png`, `C:/Users/jleon/AppData/Local/Temp/jimothy-score-dead.png`, and `C:/Users/jleon/AppData/Local/Temp/jimothy-score-restarted.png`
- Combined source/implementation comparison: `C:/Users/jleon/AppData/Local/Temp/jimothy-score-comparison.png`
- Viewport: 390×844, light color scheme, reduced motion enabled
- States: initial waiting screen, GAME OVER, and a restarted run

## Findings

- No actionable P0, P1, or P2 differences remain.
- The inconsistent first-run size was caused by an invalid canvas font declaration that contained an unresolved CSS variable. The canvas initially retained its 10px default, then retained the valid 22px restart-glyph font after GAME OVER.
- Score rendering now uses an explicit canvas-safe 22px font stack on every frame, independent of game state or previously drawn UI.
- Direct pixel inspection found identical score bounds in all three tested states: x=581–775, y=21–34, 195×14 internal canvas pixels.
- The score remains right aligned in its original position and the game-only layout is unchanged.
- The local high score remains visible after restart.
- No framework overlay, page error, unexpected UI, or browser console error was detected.

## Fidelity surfaces

- Fonts and typography: Score and `HI` use the larger requested size consistently; GAME OVER and waiting copy keep their intended independent sizes.
- Spacing and layout rhythm: Score alignment, canvas dimensions, and the centered game strip remain unchanged.
- Colors and visual tokens: The paper background and gray game ink remain unchanged.
- Image quality and asset fidelity: Sprite rendering and nearest-neighbor scaling are unaffected.
- Copy and content: No game copy changed.

## Comparison evidence

- The combined comparison places both user screenshots beside the corrected initial, GAME OVER, and restart states.
- Enlarged score crops show the original size mismatch at left and the corrected consistent size across all implementation states at right.
- Programmatic canvas-pixel measurement independently confirms the three corrected score renderings have identical bounds.

## Comparison history

1. The first corrected implementation comparison showed the larger score in all three game states with identical measured glyph bounds, so no additional P0/P1/P2 correction loop was required.

## Final result

passed
