-- Data fix: avatar URLs stored as empty string ("") fail ZenStack's @url
-- validation, which breaks any later user update:
--   "denied by policy: user entities failed 'postUpdate' check ... Incorrect link to avatar at 'image'"
-- Invariant: image must be a valid URL or NULL.
UPDATE "users" SET "image" = NULL WHERE "image" = '';
UPDATE "accounts" SET "image" = NULL WHERE "image" = '';