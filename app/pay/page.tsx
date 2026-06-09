import { Suspense } from "react";
import { PaymentCheckout } from "@/components/PaymentCheckout";
import "./checkout.css";

export default function PayPage() {
  return (
    <Suspense fallback={<div className="checkout-shell">Loading request...</div>}>
      <PaymentCheckout />
    </Suspense>
  );
}
