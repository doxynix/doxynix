export function getInitials(name?: null | string, email?: null | string): string {
  if (name != null && name.length > 0) {
    const parts = name.trim().split(" ").filter(Boolean);

    if (parts.length >= 2) {
      const first = parts[0]?.[0];
      const second = parts[1]?.[0];
      if (first != null && second != null) {
        return (first + second).toUpperCase();
      }
    }

    if (parts.length === 1) {
      const firstChar = parts[0]?.slice(0, 1);
      return (firstChar != null ? firstChar : "U").toUpperCase();
    }
  }

  if (email != null && email.length > 0) {
    return email.slice(0, 1).toUpperCase();
  }

  return "U";
}
