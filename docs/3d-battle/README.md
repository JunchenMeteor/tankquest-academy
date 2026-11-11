# 3D battle view

The battle screen uses Three.js by default. Add `?renderer=2d` to any URL to
use the Phaser scene instead, then pick a mission and start training.

## What it does

- Full-screen battlefield: an expanded field with meaningful height variation,
  deterministic extra cover, obstacles casting shadows, a PBR tank model on high
  quality, and procedural rigs on lower tiers. Tanks and cameras follow the
  terrain instead of hovering at their spawn height.
- Walls, raised platforms, the boundary, and the terrain itself stop both player
  and enemy shells at the nearest contact. Cover never applies hull or ammo-rack
  damage; a clear line to the tank is still required for a damaging hit.
- Running gear follows measured wheel radii and track contact. The authored and
  procedural rigs use separate idler, road-wheel and sprocket roles, visible
  sprocket teeth, return rollers and closed-loop track animation; see
  `docs/3d-battle/tank-model.md` for the exact contract.
- Information lives on the sides: mission and live counters on the left,
  the graded question on the right.
- Camera toggle (the button under the view): a chase camera that follows tank
  position without automatically rotating with the hull, or a first-person
  camera on the turret roof following the view.
- Aiming follows the pointer in third person and the view direction in first
  person. The turret and gun aim at the nearest live tank or ground point hit by
  the reticle ray, using maximum shell range only when nothing is hit. Holding
  the right mouse button locks the turret so the camera can look around; the
  camera keeps its chosen direction when the button is released.
- The explicit **Lock mouse** button enables Pointer Lock and a bounded virtual
  reticle, so the physical cursor no longer stops at the browser edge. The lock
  button never fires; later left clicks do. **Esc**, answering a question, mission
  UI, focus loss, and disposal release the pointer and clear every held input.
  Unlocked right-drag uses Pointer Capture when Pointer Lock is unavailable.
- The chase camera shortens or lifts its boom around obstacles and stays above
  the terrain instead of entering the ground, scenery, or player hull.
- Turret traverse speed comes from mobility (`turretTraverseSpeed`), so scouts
  swing faster than heavies.
- Every shot scatters: the shell lands anywhere inside a circle whose radius is
  the tank's `dispersionRadius` (bigger guns scatter more), sampled evenly.
- Driving uses the same input controller as the Phaser scene (`WASD`, arrows, on
  screen touch controls). Configured acceleration smooths launch, braking, and
  reverse, while steering ramps up and settles instead of changing instantly.
  The visible fence uses the same playfield bounds as tank movement, so there is
  no separate invisible boundary in front of it.
- Firing spends a round from a five-round magazine. A correct answer loads the
  ammo the backend granted; a wrong answer adds a reload penalty instead of
  taking a round away, so the child is never blocked.
- Enemies reload on their own timer, fire inside range and drain hull integrity.
  At zero the existing defeat card takes over with restart and return.
- Hull health, directional armour, penetration, damage, projectile speed,
  reload time, and mobility come from the selected tank and enemy presets.
- Incoming shells carry the firing tank's penetration and launch from its actual
  elevated, pitched muzzle. Both shell directions resolve the first contact point
  and use the same absolute impact-angle, effective-armour, ricochet, blocked,
  penetration, and damage rules; armour is not just a flat reduction.
- Penetrating critical hits damage the ammo rack without removing hull health.
  A depleted rack explodes and destroys the tank; blocked shots and ricochets
  never damage it. Both sides use the same module rules and localized feedback.
- Enemy turrets and guns track the player independently of their hulls, with
  per-tank traverse and elevation speeds; enemies fire only when aligned.
- Scouts use alternating side/rear lanes and switch flanks when their firing
  line is blocked, mediums preserve formation spacing, and heavies close the
  distance while facing the player to engage with frontal armour. Tactical
  movement detours through clear padded corners instead of stopping at walls.
- Backend-seeded `flank-drill` and `heavy-line` missions provide focused mixed-
  role tactical practice alongside the existing campaign and wave objectives.
- Hull-to-hull impacts reuse the 2D ram rules: relative speed and mass determine
  two-way damage, armour mitigates it, and each tank pair has a 650 ms cooldown.
  Ram kills count toward mission objectives and trigger subsequent waves.
- Shell impacts show localized damage, armour-zone, blocked-shot, and ricochet
  feedback at the hit point; ram impacts show their damage as well. Brief gun
  recoil and destruction flashes affect only rendering, never aim or ballistics.
- The seeded `target-range` mission places six passive targets at different
  distances and elevations for reproducible aiming and damage checks.

## Screens

| Third person                      | First person                      |
| --------------------------------- | --------------------------------- |
| ![Third person](third-person.png) | ![First person](first-person.png) |

| English challenge                         | Defeat                |
| ----------------------------------------- | --------------------- |
| ![English question](english-question.png) | ![Defeat](defeat.png) |

## Code map

| File                                              | Role                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/game/three/battle-scene-model.ts`   | Field-to-world mapping, placements, camera poses, clamped movement |
| `apps/web/src/game/three/battle-cover.ts`         | Deterministic cover placement that avoids spawns and objectives    |
| `apps/web/src/game/three/battle-combat.ts`        | Magazine, shell flight, hit resolution, enemy fire, hull damage    |
| `apps/web/src/game/three/battle-input.ts`         | Input snapshot and keyboard mapping                                |
| `apps/web/src/game/three/battle-pointer-input.ts` | Pointer Lock, virtual reticle, capture and input cleanup           |
| `apps/web/src/game/three/battle-view.ts`          | Three.js scene, tank meshes, render loop                           |
| `apps/web/src/game/three/battle-effects.ts`       | Timed effects, shell meshes, effect resource cleanup               |
| `apps/web/src/game/three/battle-hit-feedback.ts`  | Localized hit text, impact sprites, feedback resource cleanup      |
| `apps/web/src/game/three/Battle3DCanvas.tsx`      | React host, camera and pointer-lock toggles, ammo badge            |

The pure modules carry the tests; the renderer is exercised through screenshots
from the preview deployment.

## Known limits

- The first-person camera follows tank steering, not free mouse look.
- The 3D renderer ships beside Phaser, so the web performance budget covers both
  until Phaser is retired.
