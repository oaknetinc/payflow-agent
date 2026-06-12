import Image from "next/image";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}
      src="/payflow-logo.png"
      alt="PayFlow"
      width={945}
      height={264}
      priority
    />
  );
}
