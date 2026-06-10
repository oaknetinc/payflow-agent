import { NextResponse } from "next/server";
import { jobMarketplaceConfigured, loadJobs } from "@/lib/jobs";

export const revalidate = 30;

export async function GET() {
  if (!jobMarketplaceConfigured()) {
    return NextResponse.json(
      { configured: false, jobs: [] },
      { status: 503 },
    );
  }
  try {
    const jobs = await loadJobs();
    return NextResponse.json({
      configured: true,
      contract: process.env.NEXT_PUBLIC_JOB_MARKETPLACE_ADDRESS,
      chainId: 42220,
      jobs: jobs.map((job) => ({
        ...job,
        rewardRaw: job.rewardRaw.toString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        error: error instanceof Error ? error.message : "Could not load jobs.",
        jobs: [],
      },
      { status: 500 },
    );
  }
}
