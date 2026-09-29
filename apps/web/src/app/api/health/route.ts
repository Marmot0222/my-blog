import { createHealthPayload } from "./health";
import { checkPublishingHealth } from "@ting-lab/database";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.CONTENT_SOURCE === "database") {
    try {
      await checkPublishingHealth();
    } catch {
      return Response.json(
        { status: "unavailable" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }
  }
  return Response.json(createHealthPayload(), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
