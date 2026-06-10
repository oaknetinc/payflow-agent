import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain";
import { invoiceRegistryAbi } from "@/lib/celo";
import { jobMarketplaceAbi, loadJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET() {
  const marketplace = process.env
    .NEXT_PUBLIC_JOB_MARKETPLACE_ADDRESS as `0x${string}` | undefined;
  const registry = process.env
    .NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const jobBlock = BigInt(
    process.env.NEXT_PUBLIC_JOB_MARKETPLACE_DEPLOYMENT_BLOCK ?? "0",
  );
  const registryBlock = BigInt(
    process.env.NEXT_PUBLIC_REGISTRY_DEPLOYMENT_BLOCK ?? "0",
  );
  if (!marketplace || !registry || jobBlock === BigInt(0)) {
    return NextResponse.json(
      { error: "Autonomous activity is not configured." },
      { status: 503 },
    );
  }

  try {
    const jobs = await loadJobs();
    const job = jobs.find(
      (item) =>
        item.status === "completed" &&
        item.verification === "invoice" &&
        Boolean(item.metadata.invoiceKey),
    );
    if (!job?.metadata.invoiceKey) {
      return NextResponse.json({ activity: null });
    }
    const [accepted, completed, paid] = await Promise.all([
      publicClient.getContractEvents({
        address: marketplace,
        abi: jobMarketplaceAbi,
        eventName: "JobAccepted",
        args: { jobId: BigInt(job.id) },
        fromBlock: jobBlock,
        strict: true,
      }),
      publicClient.getContractEvents({
        address: marketplace,
        abi: jobMarketplaceAbi,
        eventName: "JobCompleted",
        args: { jobId: BigInt(job.id) },
        fromBlock: jobBlock,
        strict: true,
      }),
      publicClient.getContractEvents({
        address: registry,
        abi: invoiceRegistryAbi,
        eventName: "InvoicePaid",
        args: { invoiceId: job.metadata.invoiceKey },
        fromBlock: registryBlock,
        strict: true,
      }),
    ]);
    return NextResponse.json(
      {
        activity: {
          job: {
            ...job,
            rewardRaw: job.rewardRaw.toString(),
          },
          transactions: {
            accepted: accepted.at(-1)?.transactionHash,
            paid: paid.at(-1)?.transactionHash,
            completed: completed.at(-1)?.transactionHash,
          },
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load autonomous activity.",
      },
      { status: 500 },
    );
  }
}
