/**
 * Next.js middleware — intentionally pass-through.
 *
 * x402 payment gating was moved from here to src/app/api/analyze/route.ts
 * because Next.js middleware runs exclusively in Edge Runtime, which lacks
 * the Node.js crypto APIs required by @x402/evm/exact/server.
 * The withX402 wrapper in route.ts runs in Node.js runtime and works correctly.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [], // no routes intercepted — x402 gating is in the route handler
};
