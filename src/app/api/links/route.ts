import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { errorResponse, validationError } from "@/lib/http";
import { createLink, listLinks } from "@/lib/links/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tag = new URL(request.url).searchParams.get("tag") ?? undefined;
  const links = await listLinks({ tag });
  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json");
  }
  try {
    const link = await createLink(body);
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }
}
