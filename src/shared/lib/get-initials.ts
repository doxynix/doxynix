export function getInitials(name?: string | null, email?: string | null): string {
  if (name != null) {
    const parts = name.trim().split(" ").filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    if (parts.length === 1) {
      return parts[0].substring(0, 1).toUpperCase();
    }
  }

  if (email != null) {
    return email.substring(0, 1).toUpperCase();
  }

  return "U";
}
