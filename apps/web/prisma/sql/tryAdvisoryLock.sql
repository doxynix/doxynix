-- @param {String} $1:key

SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked;
