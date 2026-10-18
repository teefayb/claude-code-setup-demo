import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Consistent error body for every API route: { error: string, details?: unknown }. */
export function errorResponse(status: number, error: string, details?: unknown) {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status });
}

export function validationError(err: ZodError) {
  return errorResponse(400, "invalid_request", err.issues);
}
