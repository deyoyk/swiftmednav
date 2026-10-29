// Anna Nagar demo fixture: 8 nodes, directed edges. Corridor N2->N4 congested (A's route), B's route free.
import type { GraphEdge, GraphNode } from "@/lib/graph";

export const demoNodes = new Map<string, GraphNode>([
  ["A-base", { id: "A-base", lng: 80.2090, lat: 13.0870 }],
  ["N1", { id: "N1", lng: 80.2120, lat: 13.0890 }],
  ["N2", { id: "N2", lng: 80.2160, lat: 13.0900 }],
  ["N3", { id: "N3", lng: 80.2200, lat: 13.0910 }],
  ["B-base", { id: "B-base", lng: 80.2280, lat: 13.0950 }],
  ["N4", { id: "N4", lng: 80.2180, lat: 13.0850 }],
  ["INC", { id: "INC", lng: 80.2210, lat: 13.0880 }],
  ["HOSP", { id: "HOSP", lng: 80.2250, lat: 13.0820 }],
]);

function km(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function sec(a: string, b: string, kph = 36): number {
  const n1 = demoNodes.get(a)!, n2 = demoNodes.get(b)!;
  return Math.round((km(n1.lng, n1.lat, n2.lng, n2.lat) / kph) * 3600);
}
function both(a: string, b: string, segId: string, kph = 36, extra: Partial<GraphEdge> = {}): GraphEdge[] {
  return [
    { from: a, to: b, segId, baseSec: sec(a, b, kph), ...extra },
    { from: b, to: a, segId, baseSec: sec(b, a, kph), ...extra },
  ];
}

// A corridor A-base->N1->N2->INC is short but N2->INC will be marked high congestion at runtime.
// B corridor B-base->N3->INC is longer distance but free-flowing.
export const demoEdges: GraphEdge[] = [
  ...both("A-base", "N1", "seg-a1"),
  ...both("N1", "N2", "seg-a2"),
  ...both("N2", "INC", "seg-a3-congested"),
  ...both("B-base", "N3", "seg-b1"),
  ...both("N3", "INC", "seg-b2"),
  ...both("N1", "N4", "seg-c1"),
  ...both("N4", "INC", "seg-c2"),
  ...both("INC", "HOSP", "seg-h1", 40),
  { from: "N2", to: "N4", segId: "seg-oneway", baseSec: sec("N2", "N4"), oneWay: true },
];
