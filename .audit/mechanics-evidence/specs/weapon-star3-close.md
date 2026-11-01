# Unit weapon-star3-close: ★3 behaviors for seven close-range weapons

Read the shared rules first: /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/specs/weapon-star3-common.md

Your weapons and the pattern files you own:

| Weapon | Pattern | Suggested ★3 behavior (pick a better one if the pattern code fits it better) |
|---|---|---|
| Frying Pan (`src/content/items/pan.ts`) | `sweep` | The sweep covers the full 360°. |
| Spray Bottle (`spray.ts`) | `cone` | Enemies hit are soaked (apply the existing Wet status). |
| Leaf Blower (`leafblower.ts`) | `cone` | Enemies blown into a wall or shelf are stunned briefly. If walls are not tracked, knock back twice as far and slow briefly instead. |
| Blender (`blender.ts`) | `aura` | The aura pulls enemies slightly inward. |
| Mop (`mop.ts`) | `puddle` | Puddles last twice as long. |
| Snow Cone (`snowcone.ts`) | `puddle` | The first time an enemy enters a puddle it freezes briefly (use the existing freeze or stun status). |
| Vacuum (`vacuum.ts`) | `pulse` | Doubled coin pickup radius while it pulses. Its shop text should present it as a utility weapon. |

Pattern files you own: the files under `src/engine/patterns/` that implement `sweep`, `cone`, `aura`, `puddle` and `pulse`. The other unit owns `toast`, `burst`, `ricochet`, `popcorn`, `zap` and `mortar`.

Spray and Leaf Blower share `cone`, and Mop and Snow Cone share `puddle`. Gate each behavior on the weapon's own tune so the other weapon on the same pattern is unaffected.
