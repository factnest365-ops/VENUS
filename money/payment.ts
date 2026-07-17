import type { Invoice } from "./invoice";

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";

export interface Payment {
  id: string;
  invoiceId: string;
  client: string;
  amountUsd: number;
  credits: number;
  status: PaymentStatus;
  method: PaymentMethod;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export type PaymentMethod = "stripe" | "crypto" | "manual" | "invoice";

let paymentCounter = 0;

function generatePaymentId(): string {
  paymentCounter++;
  return `pay_${Date.now()}_${paymentCounter}`;
}

/**
 * Create a payment record from an invoice.
 */
export function createPayment(invoice: Invoice, method: PaymentMethod): Payment {
  return {
    id: generatePaymentId(),
    invoiceId: `inv_${invoice.generatedAt}`,
    client: invoice.client,
    amountUsd: invoice.estimatedCost,
    credits: invoice.totalCredits,
    status: "pending",
    method,
    createdAt: Date.now(),
  };
}

/**
 * Simulate payment processing (placeholder for real integration).
 */
export async function processPayment(payment: Payment): Promise<Payment> {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 100));

  // For now: always succeed unless amount is 0
  if (payment.amountUsd <= 0) {
    return {
      ...payment,
      status: "failed",
      error: "Amount must be positive",
      completedAt: Date.now(),
    };
  }

  return {
    ...payment,
    status: "completed",
    completedAt: Date.now(),
  };
}

export function getPaymentSummary(payments: Payment[]): {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  totalRevenueUsd: number;
} {
  const completed = payments.filter((p) => p.status === "completed");
  const pending = payments.filter((p) => p.status === "pending" || p.status === "processing");
  const failed = payments.filter((p) => p.status === "failed");

  return {
    total: payments.length,
    completed: completed.length,
    pending: pending.length,
    failed: failed.length,
    totalRevenueUsd: completed.reduce((sum, p) => sum + p.amountUsd, 0),
  };
}
