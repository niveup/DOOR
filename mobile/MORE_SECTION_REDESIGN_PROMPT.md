# DOOR mobile — More screen redesign brief

## Use this as the implementation prompt

Redesign the **More** tab in `mobile/app/(tabs)/profile.tsx` so it feels like a calm, premium productivity app settings area. It must look intentional and trustworthy, not colourful, playful, or like a collection of unrelated feature cards.

The current screen is functional, but it uses a different coloured icon tile for almost every row (emerald, violet, amber, cyan, rose). Remove that visual noise. The redesign should use a restrained, enterprise-quality visual system with neutral row icons and one clear primary accent.

Do not make changes outside the mobile app unless they are strictly required for this screen.

## Non-negotiable constraints

1. Preserve all existing behaviour, state, API requests, mutation logic, and confirmations. Do not delete `openSheet(...)` actions, `handleClearCache`, `handleLockDevice`, `testBackendPing`, info dialogs, or the existing bottom-sheet forms.
2. Keep the implementation in React Native/Expo. Do not add a UI library or a new dependency.
3. Use the existing theme provider and design tokens from `mobile/src/theme/tokens.ts`. Do not edit the global theme tokens.
4. Use the existing DOOR icon entry point: `@/src/components/app-icon`. Do not import a new icon package or use emoji.
5. The screen must work in both dark and light themes. Do not hard-code a rainbow palette. The user specifically wants the dark More screen to become calmer too.
6. Keep all touch targets at least 44 × 44 px. Keep the current bottom navigation clearance.
7. Do not change the data model, backend contracts, navigation structure, passcode flow, or the meaning of any setting.
8. Fix any existing mojibake in text that you touch: use `·` and `–`, never `Â·` or `â€“`.

## Desired visual direction

Think “high-quality fintech/productivity settings”, not “gaming dashboard”. The UI should have quiet surfaces, clear type hierarchy, predictable rows, and colour only where it communicates state.

### Colour rules

- **Default settings icon:** neutral, using `theme.textMuted` on a neutral tile. It must not be emerald, violet, amber, cyan, or rose by default.
- **Default icon tile background:** `theme.surfaceSubtle` in both themes, with either no border or a very subtle `theme.border` border.
- **Primary action / selected control:** `theme.accent` (emerald) only. Use it sparingly—one key action per section at most.
- **Positive status:** use the existing success/emerald token only for a real healthy/active/connected state.
- **Warning:** use the warning token only for a real warning, not as decoration.
- **Destructive action:** use the error/rose token only for **Lock & Sign Out** and its confirmation state.
- Never use gradients, glowing cards, neon outlines, multicolour icon backgrounds, or different decorative colours per row.

### Surface and spacing rules

- Screen horizontal padding: 16 px.
- Section label margin: 28 px above a group and 8 px below it.
- Section label: 11 px, uppercase, semibold/bold, muted text, modest letter spacing.
- Group container: `theme.surface`, 1 px `theme.border`, 16 px radius, no heavy shadow.
- Standard row: 60–64 px tall, 14–16 px horizontal padding, 12 px icon/text gap.
- Row separator: hairline divider inset to align with the text column, not full width.
- Standard icon tile: 36 × 36 px, 10 px radius.
- Row title: 14–15 px, semibold. Row subtitle: 12 px, regular/medium, one line where possible.
- Chevron and static value text: muted, never coloured unless the row is destructive.
- Press state: change the row background very slightly or reduce opacity; do not animate colour explosions.

## Information architecture

Replace the current six long, technical-looking groups with the following calmer order. Do not remove functionality: move each existing action to the row named below.

### 1. Profile & exam

Use the profile summary at the top, followed by this group.

| New row label | Existing data/action to preserve | Notes |
| --- | --- | --- |
| Target exam | `openSheet("exam_year")` | Show exam and year as the subtitle. |
| Discipline & stage | `openSheet("stream_level")` | Show stream and stage as the subtitle. |
| Target benchmark | `openSheet("target_rank")` | Show current target rank. |
| Edit profile | `openSheet("name")` | Include only if the compact profile summary does not make editing the name obvious. |

### 2. Study plan

| New row label | Existing data/action to preserve | Notes |
| --- | --- | --- |
| Daily study goal | `openSheet("daily_goal")` and `adjustDailyHours(...)` | Keep the existing fast +/- stepper, but make its buttons neutral outlined controls. The value uses normal text, not amber. |
| Sleep & wake | `openSheet("sleep_routine")` | Keep the actual schedule in the subtitle. |
| Daily fitness | `openSheet("fitness")` | Keep the configured habit in the subtitle. |
| Review study plan | `openSheet("full_cockpit")` | This replaces “Full Cockpit Setup”. It is a normal navigational row, not a bright green feature card. |

### 3. Routine & progress

| New row label | Existing data/action to preserve | Notes |
| --- | --- | --- |
| Score formula | `openSheet("score_weights")` and the existing info dialog | Keep the current percentage summary. |
| Streak freeze | `openSheet("streak_freeze")` and the existing info dialog | Use a small muted status/value; only use warning if the state genuinely needs attention. |
| Comeback mode | `openSheet("comeback_protocol")` and the existing info dialog | Keep threshold and Auto/Manual summary. |
| Review routine setup | `openSheet("full_engine")` | This replaces “Full Engine Setup”; make it a normal row. |

### 4. AI & insights

This section should be concise. The user does not need to see vendor names as the main content of a settings screen.

| New row label | Existing content to preserve | Notes |
| --- | --- | --- |
| AI assistant | Existing AI reasoning engine status | Subtitle should say “Active” or “Available”, not “OpenRouter / Cerebras / NVIDIA”. If the provider detail is required, place it in a secondary, non-prominent detail line or an info dialog. |
| Weekly insights | Existing Weekly Jujum Analysis status | Subtitle: “Weekly performance summary”. Right-side value: “Daily” or the real cadence. |

These rows are currently informational. Keep them informational unless a real existing navigation/action is available; do not invent one.

### 5. App, privacy & data

| New row label | Existing data/action to preserve | Notes |
| --- | --- | --- |
| Connection status | `testBackendPing` and `backendUrl` | Default to a simple status label. Put “Test connection” as a compact neutral text action on the right. Do not display “Express API Gateway” as the main title. |
| Privacy | Existing encrypted session and minimal permissions information | Show “Encrypted on this device” as the primary summary. Keep the exact technical details accessible in the subtitle or a lightweight details view. |
| Clear offline cache | `handleClearCache` | Keep the existing confirmation behaviour. This is a neutral maintenance action, not an amber row. |

### 6. Danger zone

Place this at the bottom, clearly separated from normal settings.

- Section label: `DANGER ZONE`.
- Single row: `Lock & Sign Out` using `handleLockDevice`.
- This is the only row permitted to use rose/error text and icon colour.
- Keep the existing destructive confirmation dialog exactly functional.

### Diagnostics (collapsed by default)

The current database and API implementation details are useful during development but make a user-facing More screen feel unfinished. Move them into a collapsed **Diagnostics** disclosure below App, privacy & data or above the footer.

- Default state: collapsed.
- Disclosure label: `Diagnostics` with a normal chevron.
- Expanded content may contain the current backend URL, test-ping control, and “Primary database” detail.
- Keep it plain, compact, and neutral. Do not use coloured status tiles.
- Implement this with local React state; do not add a package.

## Top profile summary

Replace the large “Settings & Hub / Academic cockpit · Private & local” treatment with a compact, useful header.

1. Change the screen title to **More**.
2. Use the subtitle **Profile, preferences & app settings**. Avoid internal terms such as “cockpit”, “engine”, or implementation jargon.
3. Keep a compact profile summary card at the top:
   - 48–52 px neutral avatar with initials.
   - Name in 17–18 px semibold/bold text.
   - Exam/year and discipline/stage in muted text.
   - A subtle `Edit` text affordance or visible tap target for the existing name editor.
   - Remove decorative green “online” effects unless they represent an actual, meaningful online state.
4. Keep the three useful metrics (daily goal, sleep, target rank), but present them as a simple three-column inset summary with identical neutral styling. Do not give sleep a violet value or target rank a cyan value. The values should use the normal primary text colour; only a currently selected/tapped item may use the accent briefly.
5. The profile card must be visually quieter than the content below it, not a colourful hero block.

## Reusable row implementation

Refactor repeated row markup into a small local component or a component under `mobile/src/components/profile/`, for example `SettingsRow`.

The component should support:

```ts
type SettingsRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  accessory?: "chevron" | "none" | ReactNode;
  destructive?: boolean;
  status?: "success" | "warning" | "error" | "neutral";
  children?: ReactNode; // for the study-goal stepper or test button
};
```

Implementation expectations:

1. Import `Ionicons` and `IconName` from `@/src/components/app-icon`.
2. Apply neutral icon tile styles inside the component; do not pass arbitrary per-row decorative colours.
3. Use an optional `destructive` prop for the single danger-zone row.
4. Use a status prop only where it conveys live information. Do not use it merely to make a row colourful.
5. Use `Pressable` only where a row is actionable. Informational rows should not look tappable.
6. Keep the existing `InfoButton` working in the title area for score formula, streak freeze, and comeback mode.
7. Ensure titles truncate safely and long subtitles do not overlap an accessory.

## Exact cleanup work required

1. Remove the repeated per-row objects such as:

   ```ts
   backgroundColor: "rgba(139, 92, 246, 0.12)"
   borderColor: "rgba(139, 92, 246, 0.25)"
   ```

   Do this for emerald, violet, amber, cyan, and rose variants. Do not replace them with a different rainbow.

2. Delete or replace the existing colour-driven `iconTile` usage so every regular row uses the neutral icon treatment.
3. Remove coloured “feature row” backgrounds from Full Cockpit Setup and Full Engine Setup.
4. Make status pills visually small and neutral by default. Only the text or a tiny dot should carry a semantic colour when warranted.
5. Use normal text colours for all metric values and stepper values. Do not colour a value based on which setting it is.
6. Replace overly technical or theatrical labels:
   - `Settings & Hub` → `More`
   - `Academic Cockpit & Discipline` → `Profile & Exam`
   - `Exam Tracker & Routine Engine` → `Routine & Progress`
   - `AI Mentor & Intelligence` → `AI & Insights`
   - `System Health & Network` → `App & Privacy` or move content to Diagnostics
   - `Data & Actions` → `Data Management`
   - `Full Cockpit Setup` → `Review study plan`
   - `Full Engine Setup` → `Review routine setup`
7. Remove or replace the footer’s engineering stack marketing (`React Native`, `Expo SDK`, etc.) with a quiet `DOOR` version line, or place engineering detail under Diagnostics.

## Bottom-sheet consistency

The main work is the More list, but make any directly touched bottom-sheet UI follow the same restraint:

- Use the primary emerald accent for selected chips, save action, and focus state.
- Keep unselected chips neutral.
- Retain semantic colours only for real error/warning/success messages.
- Do not add colourful setting icons or decorative banners inside sheets.
- Do not change any input values, option arrays, save mutation, or cancellation logic.

## Accessibility and interaction checks

1. Every interactive row, icon button, stepper button, and disclosure meets the 44 px minimum touch target.
2. Use `accessibilityRole="button"` and clear `accessibilityLabel` values for custom interactive controls where missing.
3. Maintain readable contrast in both themes. Muted text must remain legible.
4. Do not convey state by colour alone: “Active”, “Offline”, or “Locked” must be written as text.
5. Preserve visible focus/pressed feedback without relying on hover.
6. Confirm the long page scrolls cleanly on a 360–390 px wide device and is not hidden under the tab bar.

## Implementation sequence

Follow these steps in order.

1. Read the full current `mobile/app/(tabs)/profile.tsx` before editing. List every existing action and its handler so none is lost.
2. Create the neutral reusable settings-row component (or a local equivalent) and prove it supports a chevron, a trailing value, a custom accessory, a destructive row, and an informational row.
3. Update the screen title/subtitle and rebuild the compact profile summary.
4. Reorganize the existing rows using the six sections and action mapping above. Preserve all existing `openSheet` IDs and handlers.
5. Add the collapsed Diagnostics disclosure and move technical backend/database detail into it without deleting the test-ping capability.
6. Remove all decorative per-row colour tiles and special full-row coloured backgrounds.
7. Apply the neutral styling rules to default icons, rows, group containers, separators, metrics, and stepper controls.
8. Keep only true semantic success/warning/error colour. Review every non-neutral colour in the More screen and justify it by state, not decoration.
9. Correct any `Â·`/`â€“` text encoding in edited content.
10. Run `npx tsc --noEmit` from `D:\DOOR\mobile`.
11. Run the mobile app and inspect More in both dark and light themes. Test every existing row action, the score/streak/comeback info buttons, the daily-goal +/- controls, cache clear confirmation, connection test, Diagnostics disclosure, and Lock & Sign Out confirmation.

## Acceptance checklist

The work is complete only when all statements below are true.

- The More screen reads as one coherent settings page, not six colourful dashboards.
- Regular icons are neutral and visually identical in treatment.
- Emerald is reserved for primary/success meaning; rose is reserved for the destructive action; warning is shown only for an actual warning.
- Every existing setting remains reachable and functional.
- API/database implementation details are no longer front-and-centre for a normal user.
- No new dependencies, no global token changes, no backend/data model changes.
- Dark and light themes both look restrained and readable.
- `npx tsc --noEmit` passes.
