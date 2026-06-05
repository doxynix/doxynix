import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

import { appLogger } from "@/server/core/app-logger";

export const GET = async () => {
  try {
    const filePath = path.join(process.cwd(), "public", "openapi.json");
    const fileContents = await fs.readFile(filePath, "utf8");
    const openApiDocument = JSON.parse(fileContents);

    return NextResponse.json(openApiDocument);
  } catch (error) {
    appLogger.error({ error, msg: "OpenAPI static serving error" });
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: "Failed to load generated OpenAPI spec",
      },
      { status: 500 }
    );
  }
};
