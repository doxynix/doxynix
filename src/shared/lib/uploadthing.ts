import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "@/server/shared/infrastructure/uploadthing";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
