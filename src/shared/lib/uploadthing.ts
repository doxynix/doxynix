import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/server/lib/core";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
