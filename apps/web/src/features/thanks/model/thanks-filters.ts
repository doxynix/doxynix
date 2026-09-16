import type { AuthorGroup } from "./thanks.types";

export function filterAuthorGroups(groups: AuthorGroup[], search: string): AuthorGroup[] {
  const s = search.trim().toLowerCase();
  if (!s) {
    return groups;
  }

  return groups
    .map((group) => {
      const isAuthorMatch = group.author.toLowerCase().includes(s);

      const matchingPackages = group.packages.filter((pkg) => pkg.name.toLowerCase().includes(s));

      return {
        ...group,
        packages: isAuthorMatch ? group.packages : matchingPackages,
      };
    })
    .filter((group) => group.packages.length > 0);
}
