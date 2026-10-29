import { z } from "zod";

export const incidentSchema = z.object({
  category: z.enum(["accident", "cardiac", "maternal", "pediatric", "respiratory", "trauma", "other"]),
  priority: z.enum(["critical", "urgent", "routine"]).default("urgent"),
  lng: z.number().min(-180).max(180).optional(),
  lat: z.number().min(-90).max(90).optional(),
  addressText: z.string().min(3).max(300).optional(),
  contactPhone: z.string().min(7).max(20),
  description: z.string().max(2000).optional(),
  requiredCapabilities: z.array(z.string()).default([]),
}).refine((v) => (v.lng !== undefined && v.lat !== undefined) || v.addressText, { message: "location (gps or address) required" });

export const statusOrder = ["pending", "assigned", "acknowledged", "enroute", "onscene", "onboard", "athospital", "handover", "completed"] as const;
export type IncidentStatus = (typeof statusOrder)[number] | "cancelled" | "rejected";

const allowed: Record<string, string[]> = {
  pending: ["assigned", "cancelled"],
  assigned: ["acknowledged", "rejected", "assigned", "cancelled"],
  acknowledged: ["enroute", "cancelled"],
  enroute: ["onscene", "cancelled"],
  onscene: ["onboard", "cancelled"],
  onboard: ["athospital", "cancelled"],
  athospital: ["handover", "cancelled"],
  handover: ["completed", "cancelled"],
  rejected: ["assigned"],
  completed: [], cancelled: [],
};
export function canTransition(from: string, to: string): boolean {
  return allowed[from]?.includes(to) ?? false;
}
