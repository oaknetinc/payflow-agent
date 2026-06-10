import { NextResponse } from "next/server";
import {
  autonomousWorkerStatus,
  runAutonomousWorker,
} from "@/lib/autonomousWorker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret &&
      request.headers.get("authorization") === `Bearer ${secret}`,
  );
}

export async function GET() {
  try {
    return NextResponse.json(await autonomousWorkerStatus(), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not inspect autonomous worker.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runAutonomousWorker());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Autonomous worker failed.",
      },
      { status: 500 },
    );
  }
}
