import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Liveness + DB connectivity probe (used by Docker/Nginx health checks). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down" },
      { status: 503 },
    );
  }
}
