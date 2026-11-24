/*
# Add member profile image fields

1. New columns
- `profiles.avatar_url`: publicly displayable profile image URL for the member.
- `profiles.cover_url`: publicly displayable profile banner URL for the member.

2. Modified table
- `profiles`: adds nullable image URL fields only; all existing profile data is preserved.

3. Security
- Existing authenticated profile SELECT and owner/admin UPDATE policies remain in place.
- No new public write access is granted.
- Image files are stored through the existing authenticated `attachments` storage policies, scoped to the uploading user's folder.

4. Important notes
- Existing members remain valid because both fields are nullable.
- The application only permits the signed-in member to change their own image fields.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_url text;
