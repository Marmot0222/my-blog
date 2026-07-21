import { NextResponse } from "next/server";

import { siteSearchIndex } from "@/lib/search";

const MAX_QUERY_LENGTH = 120;

function headers(): HeadersInit {
  return {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    Vary: "Accept-Encoding",
  };
}

export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { code: "INVALID_QUERY", message: `搜索词不能超过 ${MAX_QUERY_LENGTH} 个字符。` },
      { status: 400, headers: headers() },
    );
  }

  return NextResponse.json(
    { query, results: query ? siteSearchIndex.search(query) : [] },
    { headers: headers() },
  );
}
