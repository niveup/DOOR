# Desktop regression verification

- Desktop/base CSS before the mobile marker is whitespace-normalized equivalent to pre-mobile commit `5c539520d9756d2f4118b77ee71e4f2e0c2e4ceb`.
- Bottom tabs default to `display: none` and become visible only inside `@media (max-width: 900px)`.
- Content clearance and safe-area padding are mobile-only.
- The pre-existing horizontal navigation remains available from 901px through 1023px; the desktop sidebar remains unchanged at the original `lg` breakpoint.
- Frontend `npx tsc --noEmit` passes in CI.
