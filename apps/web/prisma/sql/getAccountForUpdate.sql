-- @param {Int} $1:userId
-- @param {String} $2:providerId
SELECT
    id,
    access_token,
    refresh_token,
    access_token_expires_at,
    refresh_token_expires_at
FROM accounts
WHERE user_id = $1 AND provider_id = $2
FOR UPDATE;
