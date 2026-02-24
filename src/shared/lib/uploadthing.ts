import { generateReactHelpers } from "@uploadthing/react";

// eslint-disable-next-line boundaries/element-types
import type { OurFileRouter } from "@/server/lib/core";

export const { uploadFiles, useUploadThing } = generateReactHelpers<OurFileRouter>();
