export const TOTP_CODE_LENGTH = 6;

// Better Auth default: ten random characters rendered as `XXXXX-XXXXX`.
export const BACKUP_CODE_LENGTH = 11;

export const codeLengthFor = (isBackupMode: boolean) =>
  isBackupMode ? BACKUP_CODE_LENGTH : TOTP_CODE_LENGTH;
