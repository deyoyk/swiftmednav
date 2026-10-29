import mongoose from "mongoose";

const user = new mongoose.Schema({ email: { type: String, unique: true }, passwordHash: String, role: String, name: String, phone: String, orgId: String, districtId: String, lang: { type: String, default: "en" }, status: { type: String, default: "active" }, lastLoginAt: Date }, { timestamps: true });
const ambulance = new mongoose.Schema({ vehicleId: { type: String, unique: true }, type: String, capabilities: [String], status: { type: String, default: "available" }, districtId: String, driverId: String, homeBase: { lng: Number, lat: Number }, nodeId: String, maintenanceDueAt: Date }, { timestamps: true });
const incident = new mongoose.Schema({
  code: { type: String, unique: true }, category: String, priority: String,
  status: { type: String, default: "pending" }, callerId: String, contactPhone: String,
  loc: { type: { type: String, default: "Point" }, coordinates: [Number] }, addressText: String,
  requiredCapabilities: [String], districtId: String, simulationOnly: { type: Boolean, default: true },
  idempotencyKey: { type: String, unique: true }, timeline: [{ at: Date, by: String, event: String, detail: String }],
}, { timestamps: true });
incident.index({ status: 1 }); incident.index({ loc: "2dsphere" });
const assignment = new mongoose.Schema({ incidentId: { type: String, unique: true }, ambulanceId: String, strategy: String, candidates: [Object], chosenId: String, status: String, proposedBy: String, approvedBy: String, overrideReason: String }, { timestamps: true });
const route = new mongoose.Schema({ incidentId: String, assignmentId: String, path: [String], coords: [[Number]], costSec: Number, distanceKm: Number, nodesExplored: Number, execMs: Number, altCosts: [Number], heuristic: String, valid: Boolean }, { timestamps: true });
const audit = new mongoose.Schema({ at: { type: Date, default: Date.now }, actorId: String, role: String, action: String, entity: String, entityId: String, detail: String }, { timestamps: false });
audit.index({ entity: 1, entityId: 1 });

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyM = mongoose.Model<any>;
export const User: AnyM = (mongoose.models.User as AnyM | undefined) ?? mongoose.model<AnyM>("User", user);
export const Ambulance: AnyM = (mongoose.models.Ambulance as AnyM | undefined) ?? mongoose.model<AnyM>("Ambulance", ambulance);
export const Incident: AnyM = (mongoose.models.Incident as AnyM | undefined) ?? mongoose.model<AnyM>("Incident", incident);
export const Assignment: AnyM = (mongoose.models.Assignment as AnyM | undefined) ?? mongoose.model<AnyM>("Assignment", assignment);
export const RouteM: AnyM = (mongoose.models.Route as AnyM | undefined) ?? mongoose.model<AnyM>("Route", route);
export const Audit: AnyM = (mongoose.models.Audit as AnyM | undefined) ?? mongoose.model<AnyM>("Audit", audit);
