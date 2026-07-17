import type { ScopeEstimate } from "./scoping";

export interface InvoiceLineItem {
  type: string;
  description: string;
  credits: number;
}

export interface Invoice {
  client: string;
  projectType: string;
  lineItems: InvoiceLineItem[];
  totalCredits: number;
  estimatedHours: number;
  estimatedCost: number;
  generatedAt: string;
}

const RATE_PER_HOUR = 150; // USD

export function generateInvoice(scope: ScopeEstimate, client: string): Invoice {
  const lineItems: InvoiceLineItem[] = scope.lineItems.map((li) => ({
    type: li.type,
    description: li.label,
    credits: li.credits,
  }));

  const estimatedCost = scope.estimatedHours * RATE_PER_HOUR;

  return {
    client,
    projectType: scope.intake.projectType,
    lineItems,
    totalCredits: scope.totalCredits,
    estimatedHours: scope.estimatedHours,
    estimatedCost,
    generatedAt: new Date().toISOString(),
  };
}
