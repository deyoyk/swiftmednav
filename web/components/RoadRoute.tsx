"use client";
import { useEffect, useState } from "react";
import { Polyline, useMap } from "react-leaflet";

interface Props {
  // [lng, lat] waypoints, e.g. ambulance -> incident -> hospital
  waypoints: [number, number][];
  onSummary?: (s: { distanceM: number; timeS: number }) => void;
  onError?: () => void;
}

// Google-Maps-style road-snapped route via OSRM (free, OSM-based, no key).
// Plain fetch + AbortController: no plugin lifecycle races, safe under remounts.
export default function RoadRoute({ waypoints, onSummary, onError }: Props) {
  useMap(); // ensure we render inside a MapContainer
  const [line, setLine] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (waypoints.length < 2) {
      setLine(null);
      return;
    }
    const ctl = new AbortController();
    let live = true;
    (async () => {
      try {
        const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
        const r = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
          { signal: ctl.signal }
        );
        if (!r.ok) throw new Error(`osrm ${r.status}`);
        const j = (await r.json()) as {
          code?: string;
          routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
        };
        const route = j?.routes?.[0];
        const geom = route?.geometry?.coordinates;
        if (!route || !geom?.length) throw new Error("no route");
        if (!live) return;
        setLine(geom.map(([lng, lat]) => [lat, lng]));
        onSummary?.({ distanceM: route.distance ?? 0, timeS: route.duration ?? 0 });
      } catch (e) {
        if (live && (e as Error)?.name !== "AbortError") {
          setLine(null);
          onError?.();
        }
      }
    })();
    return () => {
      live = false;
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(waypoints)]);

  if (!line || line.length < 2) return null;
  return (
    <>
      <Polyline positions={line} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
      <Polyline positions={line} pathOptions={{ color: "#ef4444", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }} />
    </>
  );
}
