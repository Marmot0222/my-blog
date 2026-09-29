import { NextResponse } from "next/server";

import { getSiteSearchIndex } from "@/lib/search";

const MAX_QUERY_LENGTH = 120;

function headers(): HeadersInit {
  return {
    "Cache-Control": "no-store",
    Vary: "Accept-Encoding",
  };
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { code: "INVALID_QUERY", message: `搜索词不能超过 ${MAX_QUERY_LENGTH} 个字符。` },
      { status: 400, headers: headers() },
    );
  }

  try {
    return NextResponse.json(
      { query, results: query ? (await getSiteSearchIndex()).search(query) : [] },
      { headers: headers() },
    );
  } catch {
    return NextResponse.json(
      { code: "CONTENT_UNAVAILABLE", message: "内容暂时不可用，请稍后重试。" },
      { status: 503, headers: headers() },
    );
  }
}
