# Project memory

## Product intent & audience

- Internal community/workspace platform with staff management, real-time chat, radio/music, WebRTC calling, events, loans, support tickets, suggestions, announcements, and admin moderation.
- Audience: community members and staff (administrators, moderators, support, loan officers, events team).

## Brand personality & voice

- Professional, production-grade, polished — explicitly not cookie-cutter.
- Feature-rich interfaces with attention to detail (timers, sliders, animated tiles, hierarchy displays, role badges).

## Visual design & UX direction

- Styling: Tailwind CSS utility classes; no external UI theme packages.
- Icons: `lucide-react` only.
- Calling UI: professional layout with call timer, volume slider, animated participant tiles.
- Staff page: department cards with color coding (DEPT_COLORS), hierarchy notes (DEPT_HIERARCHY), role badges, detail drawer.
- Chat: presence sidebar showing real member handles; mention/reply notification wiring.
- Admin: moderation panel with ban/timeout forms and active list controls.
- Radio: music playback with synced useEffect + volume initialization; song request system removed.

## Decisions, constraints & rationale

- Stack: Vite + React, Supabase (auth, DB, storage), Tailwind, Lucide React.
- Import alias `@/` → `src/`.
- Database: 28 tables, RLS enabled, SECURITY DEFINER functions, indexes, FK constraints, storage bucket. Applied via 5 migrations.
- Seeded departments: Support Team, Junior Administrator, Moderator, Loan Center Management, Events.
- Department name in DB is `'Moderator'` (not `'Moderation'`).
- Loan Officer is a subordinate position under Loan Center Management.
- User roles stored in Supabase `raw_app_meta_data`; primary + secondary role pattern (e.g. Administrator + Project Team).
- Auth user: hamdanh1978@gmail.com, ID `5e1f0a3e-0632-44c5-8584-404853f73f92`, profile HamdanHanif, verified.
- Notification helpers: mention, reply, ban, timeout, unban, timeout removal, role change.
- Build: typecheck 0 errors; ~524KB JS / 47KB CSS / 1663 modules.

## Open questions & assumptions

- WebRTC calling untested — requires two authenticated accounts on separate devices.
- `.env` may point to original Supabase project, not current workspace DB; URL/key may need updating.
- User may need password reset via Forgot Password link.
- `.bolt/prompt` contains authoritative global instructions; not restated here.