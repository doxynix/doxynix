export function getInitials(name?: null | string, email?: null | string): string {
  const [first, second] = name?.trim().split(/\s+/) ?? [];

  if (first != null && second != null) {
    return (first.charAt(0) + second.charAt(0)).toUpperCase();
  }

  if (first != null) {
    return first.charAt(0).toUpperCase();
  }

  if (email?.trim() != null && email.trim() !== "") {
    return email.trim().charAt(0).toUpperCase();
  }

  return "U";
}
