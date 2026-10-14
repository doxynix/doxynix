-- @param {String} $1:userId
-- @param {String} $2:providerId
-- `FOR UPDATE` needs the heap row, not the columns. Raw SQL bypasses
-- fieldEncryptionExtension's $allOperations hook, so the token columns come back as ciphertext.
SELECT id
FROM accounts
WHERE user_id = $1::uuid AND provider_id = $2
FOR UPDATE;
