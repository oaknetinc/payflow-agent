import { NextResponse } from "next/server";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/chain";
import {
  getStablecoinByAddress,
  invoiceRegistryAbi,
  stablecoins,
} from "@/lib/celo";
import { StablecoinSymbol } from "@/lib/types";

export const revalidate = 60;

export async function GET() {
  const registry = process.env
    .NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const deploymentBlock = BigInt(
    process.env.NEXT_PUBLIC_REGISTRY_DEPLOYMENT_BLOCK ?? "0",
  );
  if (!registry || deploymentBlock === BigInt(0)) {
    return NextResponse.json({ error: "Registry unavailable" }, { status: 503 });
  }

  try {
    const created = await publicClient.getContractEvents({
      address: registry,
      abi: invoiceRegistryAbi,
      eventName: "InvoiceCreated",
      fromBlock: deploymentBlock,
      strict: true,
    });
    const records = await Promise.all(
      created.map((event) =>
        publicClient.readContract({
          address: registry,
          abi: invoiceRegistryAbi,
          functionName: "invoices",
          args: [event.args.invoiceId],
        }),
      ),
    );
    let paymentsConfirmed = 0;
    let confirmedVolume = 0;
    const issuers = new Set<string>();
    for (const record of records) {
      const [issuer, , token, amount, , , , , status] = record;
      issuers.add(issuer);
      if (status !== 1) continue;
      paymentsConfirmed += 1;
      const tokenEntry = getStablecoinByAddress(token) as
        | [StablecoinSymbol, (typeof stablecoins)[StablecoinSymbol]]
        | undefined;
      if (tokenEntry) {
        confirmedVolume += Number(formatUnits(amount, tokenEntry[1].decimals));
      }
    }
    return NextResponse.json({
      invoicesCreated: records.length,
      paymentsConfirmed,
      confirmedVolume,
      activeIssuers: issuers.size,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load stats.",
      },
      { status: 500 },
    );
  }
}
