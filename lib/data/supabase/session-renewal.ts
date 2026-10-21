import "server-only";
import type { NextRequest, NextResponse } from "next/server";

// The proxy's renewal on Supabase (phase B decision 4, amendment 4). Task 6 writes its body and tests: renewalClient
// (lib/supabase/renewal.ts) renews the session, and the new cookies and Supabase's no-store headers go on the request
// and the response. Nothing calls it until Task 6 adds proxy.ts.

export async function renewFromProxy(request: NextRequest): Promise<NextResponse> {
  void request;
  throw new Error("renewFromProxy() is written by phase B's Task 6");
}
