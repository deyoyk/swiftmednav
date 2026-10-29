"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";

interface Props {
  // [lng, lat] waypoints, e.g. ambulance -> incident -> hospital
  waypoints: [number, number][];
  onSummary?: (s: { distanceM: number; timeS: number }) => void;
  onError?: () => void;
}

// Google-Maps-style road-snapped route via OSRM (free, OSM-based, no key).
// Falls back to the caller rendering a straight corridor line when offline.
export default function RoadRoute({ waypoints, onSummary, onError }: Props) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length < 2) return;
    let control: L.Routing.Control | null = null;
    try {
      control = L.Routing.control({
        waypoints: waypoints.map(([lng, lat]) => L.latLng(lat, lng)),
        router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1" }),
        lineOptions: {
          styles: [
            { color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" },
            { color: "#ef4444", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" },
          ],
          extendToWaypoints: true,
          missingRouteTolerance: 50,
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        createMarker: () => null,
      } as L.Routing.RoutingControlOptions);
      control.on("routesfound", (e: L.Routing.RoutingResultEvent) => {
        const r = e.routes?.[0];
        if (r?.summary) onSummary?.({ distanceM: r.summary.totalDistance, timeS: r.summary.totalTime });
      });
      control.on("routingerror", () => onError?.());
      control.addTo(map);
    } catch {
      onError?.();
    }
    return () => {
      try {
        if (control) map.removeControl(control);
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(waypoints)]);
  return null;
}
