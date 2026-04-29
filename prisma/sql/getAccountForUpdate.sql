-- @param {Int} $1:userId
-- @param {String} $2:provider
SELECT id, access_token, refresh_token, expires_at
FROM accounts
WHERE user_id = $1 AND provider = $2
FOR UPDATE;
