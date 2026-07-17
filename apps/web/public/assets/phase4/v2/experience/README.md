# Phase 4 v2 experience assets

These files are original TankQuest Academy assets created for Phase 5.1. No
third-party textures, samples, logos, or character artwork are included.

## Ground textures

The three source images were generated with OpenAI's built-in image generation
tool on 2026-07-18, then resized to 512 x 512 and encoded with `cwebp -q 72`.
The prompts requested orthographic, low-contrast, seamless, child-friendly game
ground textures with no text, logos, characters, buildings, large objects,
directional lighting, or baked shadows:

- `training-base-ground-v2.webp`: olive academy yard, compacted soil, concrete
  seams, tire scuffs, safety marks, and sparse gravel.
- `forest-camp-ground-v2.webp`: mossy packed soil, leaf litter, pine needles,
  worn paths, stones, and embedded roots.
- `snow-field-ground-v2.webp`: blue-white packed snow, wind streaks, compressed
  tracks, frosted pebbles, and faint ice patches.

## Audio

All `.ogg` files were synthesized locally from sine waves and generated noise
with FFmpeg `lavfi`, then encoded as Opus-in-Ogg. They contain no recorded or
downloaded samples. Combat cues are shorter than 650 ms; environment loops are
four seconds and intentionally quiet. Audio is an optional enhancement and the
game keeps its visual and localized-text feedback when decoding or playback is
unavailable.

The repository asset catalog records the exact SHA-256 digest and byte length of
every shipped file. `npm run assets:verify` checks JSON, WebP, and Ogg signatures
as well as the catalog dependency graph.
