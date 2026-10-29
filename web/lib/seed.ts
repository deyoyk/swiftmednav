import { db } from "@/lib/db";
import { Ambulance, Incident, User } from "@/models";
import { hashPw } from "@/lib/auth";

export async function seed() {
  await db();
  await Promise.all([User.deleteMany({}), Ambulance.deleteMany({}), Incident.deleteMany({})]);
  const mk = async (email: string, role: string, name: string) =>
    User.create({ email, passwordHash: await hashPw("demo1234"), role, name, districtId: "chennai-central", status: "active" });
  await mk("super@demo.local", "super_admin", "Super Admin");
  await mk("dispatch@demo.local", "dispatcher", "Dispatcher");
  await mk("driver-a@demo.local", "driver", "Driver A");
  await mk("driver-b@demo.local", "driver", "Driver B");
  await mk("emt@demo.local", "emt", "EMT");
  await mk("hosp@demo.local", "hospital_coordinator", "Kilpauk Coordinator");
  await mk("citizen@demo.local", "citizen", "Citizen");
  await Ambulance.create([
    { vehicleId: "AMB-A", type: "BLS", capabilities: ["oxygen", "ventilator"], status: "available", districtId: "chennai-central", nodeId: "A-base", homeBase: { lng: 80.209, lat: 13.087 } },
    { vehicleId: "AMB-B", type: "ALS", capabilities: ["oxygen", "ventilator"], status: "available", districtId: "chennai-central", nodeId: "B-base", homeBase: { lng: 80.228, lat: 13.095 } },
    { vehicleId: "AMB-C", type: "BLS", capabilities: ["oxygen"], status: "available", districtId: "chennai-central", nodeId: "N1", homeBase: { lng: 80.212, lat: 13.089 } },
  ]);
  await Incident.create({
    code: "INC-DEMO-001", category: "accident", priority: "critical", status: "pending",
    contactPhone: "+91-98400-00001", addressText: "Anna Nagar 2nd Ave (SIMULATED)",
    loc: { type: "Point", coordinates: [80.221, 13.088] }, requiredCapabilities: ["ventilator"],
    districtId: "chennai-central", simulationOnly: true, idempotencyKey: "demo-001",
    timeline: [{ at: new Date(), by: "seed", event: "created", detail: "Anna Nagar simulated accident" }],
  });
  return { ok: true };
}
