export type ParsedGitUrl = {
  full_name: string;
  href: string;
  name: string;
  owner: string;
  port: number | null;
  protocol: string;
  resource: string;
};

const SHORTHAND_REGEX = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
const SCP_REGEX = /^(?:([a-zA-Z0-9._-]+)@)?([a-zA-Z0-9.-]+):([^0-9/][^:]*)$/;

export function parseGitUrl(input: string): ParsedGitUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Field cannot be empty");
  }

  const shorthandMatch = SHORTHAND_REGEX.exec(trimmed);
  const rawOwner = shorthandMatch?.[1];
  const rawName = shorthandMatch?.[2];

  if (rawOwner && rawName) {
    const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;
    return {
      full_name: `${rawOwner}/${name}`,
      href: `https://github.com/${rawOwner}/${name}.git`,
      name,
      owner: rawOwner,
      port: null,
      protocol: "https",
      resource: "github.com",
    };
  }

  let normalized = trimmed;
  let isScp = false;

  if (!normalized.includes("://") && normalized.includes(":")) {
    const scpMatch = SCP_REGEX.exec(normalized);
    const host = scpMatch?.[2];
    const pathPart = scpMatch?.[3];

    if (host && pathPart) {
      const user = scpMatch[1];
      const userPart = user ? `${user}@` : "";
      normalized = `ssh://${userPart}${host}/${pathPart}`;
      isScp = true;
    } else {
      throw new Error("Invalid Git URL format");
    }
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw new Error("Invalid Git URL format");
  }

  const resource = parsedUrl.hostname;
  if (!resource) {
    throw new Error("Invalid Git URL format: missing host");
  }

  let cleanPath = parsedUrl.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (cleanPath.endsWith(".git")) {
    cleanPath = cleanPath.slice(0, -4);
  }
  cleanPath = cleanPath.replace(/\/+$/, "");

  if (cleanPath.startsWith("scm/")) {
    cleanPath = cleanPath.slice(4);
  }

  const parts = cleanPath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid Git URL format: must contain owner and repository name");
  }

  const name = parts.at(-1);
  const owner = parts.slice(0, -1).join("/");

  if (!owner || !name) {
    throw new Error("Invalid Git URL format: owner or name is empty");
  }

  const port = parsedUrl.port ? Number(parsedUrl.port) : null;
  const protocol = isScp ? "ssh" : parsedUrl.protocol.replace(/:$/, "");

  return {
    full_name: `${owner}/${name}`,
    href: trimmed,
    name,
    owner,
    port,
    protocol,
    resource,
  };
}
