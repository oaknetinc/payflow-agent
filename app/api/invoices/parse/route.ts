import { NextResponse } from "next/server";
import { InvoiceDraft, StablecoinSymbol } from "@/lib/types";

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseDraft(prompt: string): InvoiceDraft {
  const amountMatch = prompt.match(
    /(?:\$|usd(?:c|m)?\s*)?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i,
  );
  const currencyMatch = prompt.match(/\b(USDC|USDT|USDm)\b/i);
  const clientMatch = prompt.match(
    /(?:invoice|bill)\s+(.+?)(?=\s+(?:\$|\d|for\b))/i,
  );
  const descriptionMatch = prompt.match(
    /\bfor\s+(.+?)(?=,\s*due\b|\s+due\b|$)/i,
  );
  const dueMatch = prompt.match(/\bdue\s+(.+)$/i);

  const currency =
    (currencyMatch?.[1] as StablecoinSymbol | undefined) ?? "USDC";

  return {
    client: titleCase(clientMatch?.[1] ?? "New client"),
    description: titleCase(descriptionMatch?.[1] ?? "Freelance services"),
    amount: Number((amountMatch?.[1] ?? "100").replaceAll(",", "")),
    currency:
      currency.toLowerCase() === "usdm"
        ? "USDm"
        : currency.toLowerCase() === "usdt"
          ? "USDT"
          : "USDC",
    dueDate: titleCase(dueMatch?.[1] ?? "In 7 days"),
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string };

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  return NextResponse.json(parseDraft(body.prompt));
}
