import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/server/core/uploadthing";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
