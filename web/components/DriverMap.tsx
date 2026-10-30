"use client";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../components/map.css";

export interface RoadStep { at: number; text: string; location: [number, number] }
export interface RoadGeometry { line: [number, number][]; steps: RoadStep[]; distanceM: number; durationS: number }

interface Props {
  // [lng, lat] waypoints: ambulance base -> pickup -> hospital
  waypoints: [number, number][];
  pos: [number, number] | null;
  onRoute?: (g: RoadGeometry | null) => void;
  // [lng, lat] maneuver points dotted along the route; next one highlighted
  maneuverDots?: [number, number][];
  nextManeuver?: [number, number] | null;
  // [lat, lng] road-snapped route line to draw (white casing + red core)
  roadLine?: [number, number][] | null;
  // meters already driven along roadLine; the trail behind fades out Uber-style
  traveledM?: number;
}

const ambIcon = L.divIcon({
  className: "smn-divicon",
  html: `<div class="smn-driver"><span class="smn-driver-core"></span></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});
const pickupIcon = L.divIcon({
  className: "smn-divicon",
  html: `<div class="smn-stop smn-stop-1"><span class="smn-stop-n">1</span><span class="smn-stop-pin"></span></div>`,
  iconSize: [34, 44],
  iconAnchor: [17, 40],
});
const hospIcon = L.divIcon({
  className: "smn-divicon",
  html: `<div class="smn-stop smn-stop-2"><span class="smn-stop-n">2</span><span class="smn-stop-pin"></span></div>`,
  iconSize: [34, 44],
  iconAnchor: [17, 40],
});

function Follow({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, Math.max(map.getZoom(), 15), { animate: true });
  }, [map, pos]);
  return null;
}

function Loader({ waypoints, onRoute }: { waypoints: [number, number][]; onRoute: Props["onRoute"] }) {
  useEffect(() => {
    if (waypoints.length < 2) {
      onRoute?.(null);
      return;
    }
    const ctl = new AbortController();
    let live = true;
    (async () => {
      try {
        const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
        const r = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
          { signal: ctl.signal }
        );
        if (!r.ok) throw new Error(`osrm ${r.status}`);
        const j = await r.json();
        const route = j?.routes?.[0];
        const geom: [number, number][] | undefined = route?.geometry?.coordinates;
        if (!route || !geom?.length) throw new Error("no route");
        // flatten legs' steps into [lng,lat] checkpoints with maneuver text
        const steps: RoadStep[] = [];
        let acc = 0;
        const legs = route.legs ?? [];
        for (const leg of legs) {
          for (const s of leg.steps ?? []) {
            const loc = s?.maneuver?.location as [number, number] | undefined;
            if (!loc) { acc += s?.distance ?? 0; continue; }
            steps.push({ at: acc, text: speakable(s?.maneuver?.type, s?.maneuver?.modifier, s?.name), location: loc });
            acc += s?.distance ?? 0;
          }
        }
        if (!live) return;
        onRoute?.({
          line: geom.map(([lng, lat]) => [lat, lng]),
          steps,
          distanceM: route.distance ?? 0,
          durationS: route.duration ?? 0,
        });
      } catch (e) {
        if (live && (e as Error)?.name !== "AbortError") onRoute?.(null);
      }
    })();
    return () => {
      live = false;
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(waypoints)]);
  return null;
}

function speakable(type?: string, modifier?: string, name?: string): string {
  const onto = name ? ` onto ${name}` : "";
  switch (type) {
    case "turn": return `Turn ${modifier ?? ""}${onto}`.trim();
    case "new name": return `Continue${onto}`;
    case "continue": return `Continue straight${onto}`;
    case "roundabout":
    case "rotary": return `At the roundabout, take the exit${onto}`;
    case "roundabout turn": return `At the roundabout, turn ${modifier ?? ""}${onto}`.trim();
    case "merge": return `Merge${onto}`;
    case "on ramp": return `Take the ramp${onto}`;
    case "off ramp": return `Take the exit${onto}`;
    case "fork": return `Keep ${modifier ?? "straight"}${onto}`.trim();
    case "end of road": return `At the end of the road, turn ${modifier ?? ""}${onto}`.trim();
    case "notification": return `Continue${onto}`;
    case "enter roundabout": return "Enter the roundabout";
    case "exit roundabout":
    case "exit rotary": return `Exit the roundabout${onto}`;
    case "arrive": return "You have arrived";
    case "depart": return "Head out";
    case "uturn": return `Make a U-turn${onto}`;
    default: return modifier ? `${capitalize(modifier)}${onto}` : name ? `Follow ${name}` : "Continue";
  }
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Split a [lat,lng] route into driven (dimmed) and remaining (bright) parts. */
function splitLine(line: [number, number][], d: number): { done: [number, number][]; todo: [number, number][] } {
  const done: [number, number][] = [];
  if (line.length === 0) return { done, todo: [] };
  done.push(line[0]!);
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const seg = haversineM(a[0], a[1], b[0], b[1]);
    if (acc + seg >= d) {
      const f = seg === 0 ? 0 : (d - acc) / seg;
      const cut: [number, number] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      done.push(cut);
      return { done, todo: [cut, ...line.slice(i + 1)] };
    }
    acc += seg;
    done.push(b);
  }
  return { done, todo: [line[line.length - 1]!] };
}

export default function DriverMap({ waypoints, pos, onRoute, maneuverDots, nextManeuver, roadLine, traveledM = 0 }: Props) {
  const [hasRoad, setHasRoad] = useState(false);
  const pickup = waypoints[1];
  const hosp = waypoints[2];
  const center: [number, number] = pos ?? (pickup ? [pickup[1]!, pickup[0]!] : [13.088, 80.221]);
  const nextKey = nextManeuver ? `${nextManeuver[0]},${nextManeuver[1]}` : null;
  const split = roadLine && roadLine.length > 1 ? splitLine(roadLine, Math.max(0, traveledM)) : null;
  const doneLine = split && split.done.length > 1 ? split.done : null;
  const todoLine = split ? split.todo : null;
  const handleRoute = (g: RoadGeometry | null) => {
    setHasRoad(!!g && (g.line?.length ?? 0) > 1);
    onRoute?.(g);
  };
  const fallback: [number, number][] | null = !hasRoad && waypoints.length >= 2
    ? waypoints.map(([lng, lat]) => [lat, lng] as [number, number])
    : null;
  return (
    <MapContainer center={center} zoom={15} scrollWheelZoom={false} dragging={false} zoomControl={false} attributionControl style={{ height: "100%", width: "100%" }}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Loader waypoints={waypoints} onRoute={handleRoute} />
      <Follow pos={pos} />
      {fallback && fallback.length > 1 && (
        <>
          <Polyline positions={fallback} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={fallback} pathOptions={{ color: "#ef4444", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }} />
        </>
      )}
      {roadLine && roadLine.length > 1 && todoLine && todoLine.length > 1 && (
        <>
          <Polyline positions={todoLine} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
          <Polyline positions={todoLine} pathOptions={{ color: "#ef4444", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }} />
        </>
      )}
      {doneLine && doneLine.length > 1 && (
        <Polyline positions={doneLine} pathOptions={{ color: "#94a3b8", weight: 4, opacity: 0.45, lineCap: "round", lineJoin: "round", dashArray: "1 7" }} />
      )}
      {pickup && (
        <Marker position={[pickup[1]!, pickup[0]!]} icon={pickupIcon} interactive={false}>
        </Marker>
      )}
      {hosp && <Marker position={[hosp[1]!, hosp[0]!]} icon={hospIcon} interactive={false} />}
      {(maneuverDots ?? []).map((m, i) => {
        const isNext = nextKey === `${m[0]},${m[1]}`;
        return (
          <CircleMarker key={`${m[0]}-${m[1]}-${i}`} center={[m[1], m[0]]} radius={isNext ? 7 : 3.5}
            pathOptions={isNext
              ? { color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }
              : { color: "#ffffff", fillColor: "#ffffff", fillOpacity: 0.9, weight: 1.5 }}
            interactive={false} />
        );
      })}
      {pos && <Marker position={pos} icon={ambIcon} interactive={false} zIndexOffset={500} />}
    </MapContainer>
  );
}
