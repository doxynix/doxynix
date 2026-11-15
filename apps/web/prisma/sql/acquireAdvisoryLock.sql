-- @param {String} $1:key

-- The lock returns `void`, which the raw decoder cannot deserialize; the text cast keeps the
-- column decodable while still taking the lock.
SELECT pg_advisory_xact_lock(hashtext($1))::text;
