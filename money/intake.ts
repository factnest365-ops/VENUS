import { z } from "zod";

export const IntakeSchema = z.object({
  name: z.string().min(1, "Client name required"),
  projectType: z.string().min(1, "Project type required"),
  budget: z.number().positive("Budget must be positive"),
  timeline: z.string().min(1, "Timeline required"),
});

export type Intake = z.infer<typeof IntakeSchema>;

export function createIntake(data: {
  name: string;
  projectType: string;
  budget: number;
  timeline: string;
}): Intake {
  return IntakeSchema.parse(data);
}

export function validateIntake(data: unknown): Intake {
  return IntakeSchema.parse(data);
}
