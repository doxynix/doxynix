export function generateBranchName() {
  const now = new Date();

  const year = String(now.getUTCFullYear()).slice(-2);
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");

  const salt = Math.random().toString(36).slice(2, 6);

  return `doxynix/${year}${month}${day}-${hours}${minutes}-${salt}`;
}
