const SIZE_MAP: Record<string, string> = {
  "size-6": "24px",
  "size-8": "32px",
  "size-9": "36px",
  "size-10": "40px",
  "size-12": "48px",
  "size-16": "64px",
  "size-24": "96px",
  "size-32": "128px",
};

export function getSizesFromClassName(sizeClassName: string): string {
  for (const [key, value] of Object.entries(SIZE_MAP)) {
    if (sizeClassName.includes(key)) {
      return value;
    }
  }
  return "48px";
}

const ALLOWED_UNOPTIMIZED_HOSTS = [
  "utfs.io",
  "ufs.sh",
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
  "vercel-storage.com",
];

export function isUnoptimizedHost(src: string): boolean {
  try {
    const url = new URL(src);
    const protocol = url.protocol.toLowerCase();

    if (protocol !== "http:" && protocol !== "https:") {
      return true;
    }

    const hostname = url.hostname.toLowerCase();

    return ALLOWED_UNOPTIMIZED_HOSTS.some((allowed) => {
      return hostname === allowed || hostname.endsWith(`.${allowed}`);
    });
  } catch {
    return false;
  }
}
