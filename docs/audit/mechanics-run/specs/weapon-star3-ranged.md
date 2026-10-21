# Unit weapon-star3-ranged: ★3 behaviors for six ranged weapons

Read the shared rules first: /private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/specs/weapon-star3-common.md

Your weapons and the pattern files you own:

| Weapon | Pattern | Suggested ★3 behavior (pick a better one if the pattern code fits it better) |
|---|---|---|
| Toaster (`src/content/items/toaster.ts`) | `toast` | Fires a second toast at a different target. |
| Nail Gun (`nailgun.ts`) | `burst` | Nails pierce one extra enemy. |
| Fizz (`fizz.ts`) | `ricochet` | Each bounce seeks the nearest enemy not yet hit. |
| Popcorn (`popcorn.ts`) | `popcorn` | Kernels that land without a hit pop once more for half damage. |
| Microwave (`microwave.ts`) | `zap` | The zap arcs to one more enemy near the target. |
| Pressure Cooker (`cooker.ts`) | `mortar` | Lobs a second, smaller shell at another target. |

Pattern files you own: the files under `src/engine/patterns/` that implement `toast`, `burst`, `ricochet`, `popcorn`, `zap` and `mortar`. The other unit owns `sweep`, `cone`, `aura`, `puddle` and `pulse`.
