"use client";
import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "./map.css";
import RoadRoute from "./RoadRoute";

interface Props {
  nodes: { id: string; lng: number; lat: number }[];
  routeCoords: [number, number][];
  exploredOrder: string[];
  incident: { lng: number; lat: number } | null;
  ambulances: { vehicleId: string; lng: number; lat: number; label: string }[];
  // [lng, lat] road waypoints (ambulance -> incident -> hospital); OSRM-snapped
  roadWaypoints?: [number, number][];
  showAstar?: boolean;
  selectedId?: string | null;
  onRoadSummary?: (s: { distanceM: number; timeS: number } | null) => void;
}

function unitLetter(vehicleId: string): string {
  const m = vehicleId.match(/([A-Z])\s*$/);
  return m?.[1] ?? vehicleId.slice(0, 1);
}

function ambIcon(vehicleId: string, selected: boolean) {
  return L.divIcon({
    className: "smn-divicon",
    html: `<div class="smn-amb${selected ? " smn-amb-sel" : ""}">${unitLetter(vehicleId)}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

const incidentIcon = L.divIcon({
  className: "smn-divicon",
  html: `<div class="smn-inc"><span class="smn-inc-core"></span></div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const hospIcon = L.divIcon({
  className: "smn-divicon",
  html: `<div class="smn-hosp">H</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function DispatchMap({ nodes, routeCoords, exploredOrder, incident, ambulances, roadWaypoints, showAstar, selectedId, onRoadSummary }: Props) {
  const [roadFailed, setRoadFailed] = useState(false);
  const center: [number, number] = incident ? [incident.lat, incident.lng] : [13.088, 80.218];
  const explored = new Set(exploredOrder);
  const routeLatLng = routeCoords.map(([lng, lat]) => [lat, lng] as [number, number]);
  const useRoad = !!roadWaypoints && roadWaypoints.length >= 2 && !roadFailed;
  return (
    <MapContainer center={center} zoom={14} scrollWheelZoom style={{ height: 380, width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | routing by <a href="https://router.project-osrm.org/">OSRM</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      {nodes.filter((n) => n.id !== "HOSP").map((n) => (
        <CircleMarker key={n.id} center={[n.lat, n.lng]} radius={explored.has(n.id) ? 5 : 3}
          pathOptions={{ color: explored.has(n.id) ? "#22c55e" : "#64748b", fillColor: explored.has(n.id) ? "#22c55e" : "#64748b", fillOpacity: explored.has(n.id) ? 0.85 : 0.5, weight: 1.5 }}>
          <Tooltip>{n.id}{explored.has(n.id) ? " · explored" : ""}</Tooltip>
        </CircleMarker>
      ))}
      {nodes.filter((n) => n.id === "HOSP").map((n) => (
        <Marker key={n.id} position={[n.lat, n.lng]} icon={hospIcon}>
          <Popup>Receiving hospital (SIMULATED)</Popup>
        </Marker>
      ))}
      {useRoad ? (
        <RoadRoute
          waypoints={roadWaypoints!}
          onSummary={(s) => { setRoadFailed(false); onRoadSummary?.(s); }}
          onError={() => { setRoadFailed(true); onRoadSummary?.(null); }}
        />
      ) : (
        <>
          {routeLatLng.length > 1 && <Polyline positions={routeLatLng} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9, lineCap: "round", lineJoin: "round" }} />}
          {routeLatLng.length > 1 && <Polyline positions={routeLatLng} pathOptions={{ color: "#ef4444", weight: 4, opacity: 1, lineCap: "round", lineJoin: "round" }} />}
        </>
      )}
      {showAstar && routeLatLng.length > 1 && useRoad && (
        <Polyline positions={routeLatLng} pathOptions={{ color: "#22c55e", weight: 2, dashArray: "2 7", opacity: 0.9, lineCap: "round" }} />
      )}
      {incident && (
        <Marker position={[incident.lat, incident.lng]} icon={incidentIcon}>
          <Popup>Incident (SIMULATED)</Popup>
        </Marker>
      )}
      {ambulances.map((a) => (
        <Marker key={a.vehicleId} position={[a.lat, a.lng]} icon={ambIcon(a.vehicleId, a.vehicleId === selectedId)}>
          <Popup><b>{a.vehicleId}</b> — {a.label}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
