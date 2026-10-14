import { NextResponse } from "next/server";
import { MissingKeyError, ProviderError } from "./ai";
import { NotFound } from "./learning";

/** Turn thrown errors into short, friendly JSON errors. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      return NextResponse.json(await fn(...args));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof MissingKeyError) return NextResponse.json({ error: e.message }, { status: 503 });
  if (e instanceof NotFound) return NextResponse.json({ error: e.message }, { status: 404 });
  if (e instanceof ProviderError) return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : 503 });
  console.error(e);
  // Show the real reason, so problems can be understood and reported.
  const reason = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: `Something went wrong: ${reason.slice(0, 300)}. Try again.` }, { status: 500 });
}

export type Ctx = { params: Promise<{ id: string }> };

export async function body<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}
