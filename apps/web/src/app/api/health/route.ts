import { createHealthPayload } from "./health";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(createHealthPayload(), {
    headers: {
      "cache-control": "no-store",
    },
  });
}
