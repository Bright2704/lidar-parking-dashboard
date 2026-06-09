"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LAYOUTS, cloneLayout } from "@/lib/layouts";
import { Lane, Obstacle, ParkEvent, Sensor, Spot } from "@/lib/types";

// ---------- palette ----------
const GREEN = "#22c55e";
const RED = "#ef4444";
const GRAY = "#64748b";
const BLUE = "#38bdf8";
const MARKER_R = 13;

// How far behind a car its shadow reaches, as a multiple of the car's distance
// from the sensor. Derived from heights: reach = H / (H - h_car) ≈ 4.5 / (4.5 - 1.5) = 1.5.
// → far cars cast long shadows (block more); near/overhead cars barely shadow at all.
const SHADOW_REACH = 1.5;

// ---------- pure geometry helpers ----------
function spotCenter(s: Spot) {
  return { cx: s.x + s.w / 2, cy: s.y + s.h / 2 };
}

// Does segment A→B cross an axis-aligned rectangle? (Liang–Barsky)
function segHitsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - rx, rx + rw - ax, ay - ry, ry + rh - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel and outside this slab
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

// Does segment A→B cross a circle?
function segHitsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c < 0) return true; // start point already inside circle
  let disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// Is the line of sight from a sensor to a point blocked by any obstacle?
function blocked(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  obstacles: Obstacle[]
): boolean {
  for (const o of obstacles) {
    if (o.kind === "tree") {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const r = Math.min(o.w, o.h) / 2;
      if (segHitsCircle(ax, ay, bx, by, cx, cy, r)) return true;
    } else if (segHitsRect(ax, ay, bx, by, o.x, o.y, o.w, o.h)) {
      return true;
    }
  }
  return false;
}

// A parked car that can block the LiDAR's view of spots behind it.
type Car = { id: string; x: number; y: number; w: number; h: number };

// One sensor sees a spot only if it is in range AND nothing blocks the view —
// not a static obstacle (pillar/tree) and not another PARKED CAR in front of it.
function sensorSees(
  spot: Spot,
  se: Sensor,
  obstacles: Obstacle[],
  cars: Car[]
): boolean {
  const { cx, cy } = spotCenter(spot);
  const dSpot = Math.hypot(cx - se.x, cy - se.y);
  if (dSpot > se.radius) return false;
  if (blocked(se.x, se.y, cx, cy, obstacles)) return false;
  for (const c of cars) {
    if (c.id === spot.id) continue; // a car never blocks the view of its OWN spot
    if (segHitsRect(se.x, se.y, cx, cy, c.x, c.y, c.w, c.h)) {
      // The car only shadows the ground up to ~1.5× its own distance. A spot farther
      // than that is seen again (the overhead beam has cleared the car roof) — so
      // occlusion bites at far/shallow angles, not for spots right under the sensor.
      const dCar = Math.hypot(c.x + c.w / 2 - se.x, c.y + c.h / 2 - se.y);
      if (dSpot <= dCar * SHADOW_REACH) return false;
    }
  }
  return true;
}

function isCovered(
  spot: Spot,
  sensors: Sensor[],
  obstacles: Obstacle[],
  cars: Car[]
): boolean {
  return sensors.some((se) => sensorSees(spot, se, obstacles, cars));
}

// ----- "flashlight" shadows: each obstacle casts a solid umbra quad away from the sensor.
// We render these as black holes in an SVG mask over the lit disc → crisp, stable shadows.
function shadowQuad(se: Sensor, o: Obstacle, reach?: number): string | null {
  // `reach` = absolute far distance for the umbra (used by cars for a LIMITED shadow).
  // Obstacles (pillar/tree) project well past the disc; the mask clips to the circle.
  const big = reach ?? se.radius * 2 + 400;
  if (o.kind === "tree") {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const r = Math.min(o.w, o.h) / 2;
    const dist = Math.hypot(cx - se.x, cy - se.y);
    if (dist <= r) return null; // sensor inside the tree
    const base = Math.atan2(cy - se.y, cx - se.x);
    const off = Math.asin(Math.min(0.999, r / dist));
    const L = Math.sqrt(Math.max(0, dist * dist - r * r)); // dist to tangent points
    const a1 = base - off;
    const a2 = base + off;
    const t1x = se.x + L * Math.cos(a1);
    const t1y = se.y + L * Math.sin(a1);
    const t2x = se.x + L * Math.cos(a2);
    const t2y = se.y + L * Math.sin(a2);
    const f1x = se.x + big * Math.cos(a1);
    const f1y = se.y + big * Math.sin(a1);
    const f2x = se.x + big * Math.cos(a2);
    const f2y = se.y + big * Math.sin(a2);
    return `${t1x},${t1y} ${f1x},${f1y} ${f2x},${f2y} ${t2x},${t2y}`;
  }
  // rectangle (pillar): shadow from the two extreme-angle corners
  const corners = [
    [o.x, o.y],
    [o.x + o.w, o.y],
    [o.x + o.w, o.y + o.h],
    [o.x, o.y + o.h],
  ];
  const cxC = o.x + o.w / 2;
  const cyC = o.y + o.h / 2;
  const base = Math.atan2(cyC - se.y, cxC - se.x);
  let minA = Infinity;
  let maxA = -Infinity;
  let cMin = corners[0];
  let cMax = corners[0];
  for (const c of corners) {
    let a = Math.atan2(c[1] - se.y, c[0] - se.x) - base;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    if (a < minA) {
      minA = a;
      cMin = c;
    }
    if (a > maxA) {
      maxA = a;
      cMax = c;
    }
  }
  const dMin = Math.atan2(cMin[1] - se.y, cMin[0] - se.x);
  const dMax = Math.atan2(cMax[1] - se.y, cMax[0] - se.x);
  const fMinx = se.x + big * Math.cos(dMin);
  const fMiny = se.y + big * Math.sin(dMin);
  const fMaxx = se.x + big * Math.cos(dMax);
  const fMaxy = se.y + big * Math.sin(dMax);
  return `${cMin[0]},${cMin[1]} ${fMinx},${fMiny} ${fMaxx},${fMaxy} ${cMax[0]},${cMax[1]}`;
}
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function hexPoints(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// ---------- presentational pieces ----------
function Hex({
  cx,
  cy,
  fill,
  label,
  labelColor = "#fff",
}: {
  cx: number;
  cy: number;
  fill: string;
  label: string;
  labelColor?: string;
}) {
  return (
    <g pointerEvents="none">
      <polygon
        points={hexPoints(cx, cy, MARKER_R)}
        fill={fill}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + 4.5}
        textAnchor="middle"
        fontSize={13}
        fontWeight={800}
        fill={labelColor}
      >
        {label}
      </text>
    </g>
  );
}

function CarShape({
  s,
  color,
  ghost = false,
}: {
  s: Spot;
  color: string;
  ghost?: boolean;
}) {
  const pad = 1.5;
  const x = s.x + pad;
  const y = s.y + pad;
  const w = s.w - pad * 2;
  const h = s.h - pad * 2;
  // windshield strip near the "front" of the stall
  const glass = s.vertical
    ? { x: x + 2, y: y + 3, w: w - 4, h: Math.max(5, h * 0.22) }
    : { x: x + 3, y: y + 2, w: Math.max(5, w * 0.22), h: h - 4 };
  return (
    <g
      className={ghost ? undefined : "car-enter"}
      pointerEvents="none"
      opacity={ghost ? 0.28 : 1}
    >
      <rect x={x} y={y} width={w} height={h} rx={5} fill={color} />
      <rect
        x={glass.x}
        y={glass.y}
        width={glass.w}
        height={glass.h}
        rx={2}
        fill="rgba(255,255,255,0.45)"
      />
    </g>
  );
}

// ----- driving animation: a car follows a path (lane → stall) then parks -----
type Pt = { x: number; y: number };
type Mover = {
  key: string;
  spotId: string;
  kind: "in" | "out";
  path: Pt[];
  start: number;
  dur: number;
  dwellMs?: number;
};

function pointOnPath(pts: Pt[], p: number): { x: number; y: number; ang: number } {
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, ang: 0 };
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segs.push(d);
    total += d;
  }
  let dist = Math.max(0, Math.min(1, p)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (dist <= segs[i] || i === segs.length - 1) {
      const t = segs[i] === 0 ? 0 : dist / segs[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
        ang: (Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) * 180) / Math.PI,
      };
    }
    dist -= segs[i];
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, ang: 0 };
}

// Path a car drives to reach a stall: enter the nearest lane, drive along it, turn in.
function approachPath(spot: Spot, lanes: Lane[], width: number, height: number): Pt[] {
  const cx = spot.x + spot.w / 2;
  const cy = spot.y + spot.h / 2;
  let lane: Lane | null = null;
  let best = Infinity;
  for (const ln of lanes) {
    const d = Math.hypot(cx - (ln.x + ln.w / 2), cy - (ln.y + ln.h / 2));
    if (d < best) {
      best = d;
      lane = ln;
    }
  }
  if (!lane) {
    const edgeY = cy < height / 2 ? -40 : height + 40;
    return [{ x: cx, y: edgeY }, { x: cx, y: cy }];
  }
  const laneY = lane.y + lane.h / 2;
  return [
    { x: lane.x - 24, y: laneY }, // enter from the lane's near end
    { x: cx, y: laneY }, // drive along the lane to in front of the stall
    { x: cx, y: cy }, // turn into the stall
  ];
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type Tab = "overview" | "sensor" | "events";
type Mode =
  | "select"
  | "addSensor"
  | "addSpotV"
  | "addSpotH"
  | "addPillar"
  | "addTree";
type EditSel = { kind: "spot" | "obstacle"; id: string } | null;
type DragState = {
  kind: "move" | "radius" | "spot" | "obstacle";
  id: string;
  offX: number;
  offY: number;
  moved: boolean;
} | null;

export default function Dashboard() {
  const [layoutId, setLayoutId] = useState(LAYOUTS[0].id);
  const layout = useMemo(
    () => LAYOUTS.find((l) => l.id === layoutId) || LAYOUTS[0],
    [layoutId]
  );

  const [spots, setSpots] = useState<Spot[]>(() => cloneLayout(LAYOUTS[0]).spots);
  const [sensors, setSensors] = useState<Sensor[]>(
    () => cloneLayout(LAYOUTS[0]).sensors
  );
  const [obstacles, setObstacles] = useState<Obstacle[]>(
    () => cloneLayout(LAYOUTS[0]).obstacles
  );
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(
    LAYOUTS[0].sensors[0]?.id ?? null
  );
  const [editMode, setEditMode] = useState(false);
  const [editSel, setEditSel] = useState<EditSel>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [banner, setBanner] = useState<{ msg: string; tone: "full" | "empty" } | null>(
    null
  );
  const [showCoverage, setShowCoverage] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [carOcclusion, setCarOcclusion] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const [entered, setEntered] = useState(0);
  const [exited, setExited] = useState(0);
  const [dwell, setDwell] = useState<number[]>([]);
  const [events, setEvents] = useState<ParkEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [, setTick] = useState(0); // drives the animation re-render

  const svgRef = useRef<SVGSVGElement | null>(null);
  const spotsRef = useRef(spots);
  const sensorsRef = useRef(sensors);
  const obstaclesRef = useRef(obstacles);
  const carOcclusionRef = useRef(carOcclusion);
  const dragRef = useRef<DragState>(null);
  const newIdRef = useRef(1);
  const moversRef = useRef(movers);
  const reservedRef = useRef<Set<string>>(new Set());
  const evtId = useRef(1);
  const sessionStart = useRef(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((msg: string, tone: "full" | "empty") => {
    setBanner({ msg, tone });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1800);
  }, []);

  useEffect(() => {
    setMounted(true);
    sessionStart.current = Date.now();
  }, []);
  useEffect(() => {
    spotsRef.current = spots;
  }, [spots]);
  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);
  useEffect(() => {
    carOcclusionRef.current = carOcclusion;
  }, [carOcclusion]);
  useEffect(() => {
    obstaclesRef.current = obstacles;
  }, [obstacles]);
  useEffect(() => {
    moversRef.current = movers;
  }, [movers]);

  // Occupied cars become occluders (slightly inset = the car body, not the whole stall).
  function carsFrom(list: Spot[], on: boolean): Car[] {
    if (!on) return [];
    return list
      .filter((s) => s.occupied)
      .map((s) => ({ id: s.id, x: s.x + 3, y: s.y + 3, w: s.w - 6, h: s.h - 6 }));
  }

  // Parked cars that can occlude the LiDAR (only when the toggle is on).
  // Declared early so every derived value below (stats, beams, render) can use it.
  const cars = useMemo(
    () => carsFrom(spots, carOcclusion),
    [spots, carOcclusion]
  );

  const pushEvent = useCallback((type: ParkEvent["type"], msg: string) => {
    setEvents((prev) =>
      [{ id: evtId.current++, t: Date.now(), type, msg }, ...prev].slice(0, 80)
    );
  }, []);

  // ---------- load / reset a layout ----------
  const loadLayout = useCallback((id: string) => {
    const lay = LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
    const c = cloneLayout(lay);
    setLayoutId(id);
    setSpots(c.spots);
    setSensors(c.sensors);
    setObstacles(c.obstacles);
    setSelectedSensorId(lay.sensors[0]?.id ?? null);
    setEditSel(null);
    setEntered(0);
    setExited(0);
    setDwell([]);
    setEvents([]);
    setMode("select");
    sessionStart.current = Date.now();
    evtId.current = 1;
  }, []);

  const resetCurrent = useCallback(() => loadLayout(layoutId), [layoutId, loadLayout]);

  // ---------- coordinate transform ----------
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }, []);

  const updateSensor = useCallback((id: string, patch: Partial<Sensor>) => {
    setSensors((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // ---------- dragging: sensors, spots, obstacles ----------
  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = clientToSvg(e.clientX, e.clientY);
      d.moved = true;
      const X = clamp(p.x - d.offX, 0, layout.width);
      const Y = clamp(p.y - d.offY, 0, layout.height);
      if (d.kind === "move") {
        updateSensor(d.id, { x: X, y: Y });
      } else if (d.kind === "radius") {
        const se = sensorsRef.current.find((s) => s.id === d.id);
        if (se) {
          const r = Math.hypot(p.x - se.x, p.y - se.y);
          updateSensor(d.id, { radius: clamp(r, 40, 640) });
        }
      } else if (d.kind === "spot") {
        setSpots((prev) =>
          prev.map((s) => (s.id === d.id ? { ...s, x: X, y: Y } : s))
        );
      } else if (d.kind === "obstacle") {
        setObstacles((prev) =>
          prev.map((o) => (o.id === d.id ? { ...o, x: X, y: Y } : o))
        );
      }
    },
    [clientToSvg, layout.width, layout.height, updateSensor]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const startSensorDrag = useCallback(
    (e: React.PointerEvent, s: Sensor, kind: "move" | "radius") => {
      e.stopPropagation();
      setSelectedSensorId(s.id);
      setEditSel(null);
      setTab("sensor");
      const p = clientToSvg(e.clientX, e.clientY);
      dragRef.current = {
        kind,
        id: s.id,
        offX: p.x - s.x,
        offY: p.y - s.y,
        moved: false,
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [clientToSvg, onPointerMove, onPointerUp]
  );

  // Generic drag for a spot or obstacle (edit mode only).
  const startElDrag = useCallback(
    (e: React.PointerEvent, kind: "spot" | "obstacle", id: string, ex: number, ey: number) => {
      e.stopPropagation();
      setEditSel({ kind, id });
      setSelectedSensorId(null);
      const p = clientToSvg(e.clientX, e.clientY);
      dragRef.current = { kind, id, offX: p.x - ex, offY: p.y - ey, moved: false };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [clientToSvg, onPointerMove, onPointerUp]
  );

  // ---------- canvas click: place a new element, or deselect ----------
  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const p = clientToSvg(e.clientX, e.clientY);
      const X = clamp(p.x, 0, layout.width);
      const Y = clamp(p.y, 0, layout.height);
      const uid = (pfx: string) => `${pfx}-${Date.now() % 100000}-${newIdRef.current++}`;

      if (mode === "addSensor") {
        const id = uid("L");
        const n = sensorsRef.current.length + 1;
        const ns: Sensor = {
          id,
          name: `LiDAR-${n}`,
          code: `S0G0${n}C0${n}A0C0${n}P1`,
          x: X,
          y: Y,
          radius: 165,
          temp: 27,
        };
        setSensors((prev) => [...prev, ns]);
        setSelectedSensorId(id);
        setEditSel(null);
        setMode("select");
        setTab("sensor");
        pushEvent("sensor", `เพิ่มเซนเซอร์ ${ns.name}`);
      } else if (mode === "addSpotV" || mode === "addSpotH") {
        const vertical = mode === "addSpotV";
        const w = vertical ? 40 : 62;
        const h = vertical ? 62 : 40;
        const id = uid("S");
        const ns: Spot = {
          id,
          x: clamp(X - w / 2, 0, layout.width - w),
          y: clamp(Y - h / 2, 0, layout.height - h),
          w,
          h,
          vertical,
          occupied: false,
        };
        setSpots((prev) => [...prev, ns]);
        setEditSel({ kind: "spot", id });
        // keep the tool active so you can place many spots in a row quickly
        pushEvent("info", `เพิ่มช่องจอด ${id}`);
      } else if (mode === "addPillar" || mode === "addTree") {
        const tree = mode === "addTree";
        const w = tree ? 44 : 22;
        const h = tree ? 44 : 24;
        const id = uid("obs");
        const ns: Obstacle = {
          id,
          x: clamp(X - w / 2, 0, layout.width - w),
          y: clamp(Y - h / 2, 0, layout.height - h),
          w,
          h,
          kind: tree ? "tree" : "pillar",
        };
        setObstacles((prev) => [...prev, ns]);
        setEditSel({ kind: "obstacle", id });
        pushEvent("info", tree ? "เพิ่มต้นไม้" : "เพิ่มเสา");
      } else {
        setSelectedSensorId(null);
        setEditSel(null);
      }
    },
    [mode, clientToSvg, layout.width, layout.height, pushEvent]
  );

  // ---------- delete whatever is selected (spot / obstacle / sensor) ----------
  const deleteSelected = useCallback(() => {
    if (editSel) {
      if (editSel.kind === "spot") {
        setSpots((prev) => prev.filter((s) => s.id !== editSel.id));
      } else {
        setObstacles((prev) => prev.filter((o) => o.id !== editSel.id));
      }
      setEditSel(null);
      pushEvent("info", "ลบองค์ประกอบที่เลือก");
    } else if (selectedSensorId) {
      const s = sensorsRef.current.find((x) => x.id === selectedSensorId);
      setSensors((prev) => prev.filter((x) => x.id !== selectedSensorId));
      setSelectedSensorId(null);
      if (s) pushEvent("sensor", `ลบเซนเซอร์ ${s.name}`);
    }
  }, [editSel, selectedSensorId, pushEvent]);

  // ---------- driving simulation: spawn a car that drives in / out ----------
  const requestCarIn = useCallback(
    (s: Spot) => {
      if (reservedRef.current.has(s.id) || s.occupied) return;
      reservedRef.current.add(s.id);
      setMovers((prev) => [
        ...prev,
        {
          key: `in-${s.id}-${Date.now()}`,
          spotId: s.id,
          kind: "in",
          path: approachPath(s, layout.lanes, layout.width, layout.height),
          start: performance.now(),
          dur: 1000,
        },
      ]);
    },
    [layout.lanes, layout.width, layout.height]
  );

  const requestCarOut = useCallback(
    (s: Spot) => {
      if (reservedRef.current.has(s.id) || !s.occupied) return;
      reservedRef.current.add(s.id);
      const dwellMs = s.enteredAt ? Date.now() - s.enteredAt : 0;
      // the stall becomes vacant immediately; the moving car carries the body out
      setSpots((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, occupied: false, enteredAt: undefined } : x))
      );
      const path = approachPath(s, layout.lanes, layout.width, layout.height).slice().reverse();
      setMovers((prev) => [
        ...prev,
        {
          key: `out-${s.id}-${Date.now()}`,
          spotId: s.id,
          kind: "out",
          path,
          start: performance.now(),
          dur: 1000,
          dwellMs,
        },
      ]);
    },
    [layout.lanes, layout.width, layout.height]
  );

  // click a stall → drive a car in (if vacant) or out (if occupied)
  const toggleSpot = useCallback(
    (s: Spot) => {
      if (reservedRef.current.has(s.id)) return;
      if (s.occupied) requestCarOut(s);
      else requestCarIn(s);
    },
    [requestCarIn, requestCarOut]
  );

  // ---------- button: drive ONE car in (random vacant spot the LiDAR sees) ----------
  const carIn = useCallback(() => {
    const sp = spotsRef.current;
    const se = sensorsRef.current;
    const obs = obstaclesRef.current;
    const cs = carsFrom(sp, carOcclusionRef.current);
    const vac = sp.filter(
      (s) => isCovered(s, se, obs, cs) && !s.occupied && !reservedRef.current.has(s.id)
    );
    if (vac.length === 0) {
      const anyDetected = sp.some((s) => isCovered(s, se, obs, cs));
      showBanner(
        anyDetected ? "ลานเต็ม — ไม่มีช่องว่างในพื้นที่ตรวจจับ" : "ยังไม่มีพื้นที่ตรวจจับ — วาง/ลาก LiDAR ก่อน",
        "full"
      );
      return;
    }
    requestCarIn(vac[Math.floor(Math.random() * vac.length)]);
  }, [showBanner, requestCarIn]);

  // ---------- button: drive ONE car out (random occupied spot the LiDAR sees) ----------
  const carOut = useCallback(() => {
    const sp = spotsRef.current;
    const se = sensorsRef.current;
    const obs = obstaclesRef.current;
    const cs = carsFrom(sp, carOcclusionRef.current);
    const occ = sp.filter(
      (s) => isCovered(s, se, obs, cs) && s.occupied && !reservedRef.current.has(s.id)
    );
    if (occ.length === 0) {
      showBanner("ไม่มีรถในพื้นที่ตรวจจับให้ออก", "empty");
      return;
    }
    requestCarOut(occ[Math.floor(Math.random() * occ.length)]);
  }, [showBanner, requestCarOut]);

  // ---------- animation loop: advance movers, commit when they arrive ----------
  useEffect(() => {
    if (movers.length === 0) return;
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const arrived = moversRef.current.filter((m) => now - m.start >= m.dur);
      if (arrived.length) {
        arrived.forEach((m) => {
          reservedRef.current.delete(m.spotId);
          if (m.kind === "in") {
            setSpots((prev) =>
              prev.map((x) =>
                x.id === m.spotId ? { ...x, occupied: true, enteredAt: Date.now() } : x
              )
            );
            setEntered((v) => v + 1);
            pushEvent("in", `รถเข้าจอดช่อง ${m.spotId}`);
          } else {
            setExited((v) => v + 1);
            if (m.dwellMs) setDwell((d) => [...d, m.dwellMs as number].slice(-120));
            pushEvent("out", `รถออกจากช่อง ${m.spotId}`);
          }
        });
        setMovers((prev) => prev.filter((m) => now - m.start < m.dur));
      }
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [movers.length, pushEvent]);

  // ---------- delete selected element with keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editSel || selectedSensorId) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === "Escape") {
        setMode("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editSel, selectedSensorId, deleteSelected]);

  // ---------- derived stats ----------
  const stats = useMemo(() => {
    const total = spots.length;
    const detected = spots.filter((s) => isCovered(s, sensors, obstacles, cars));
    const detectedCount = detected.length;
    const detOcc = detected.filter((s) => s.occupied).length;
    const detVac = detectedCount - detOcc;
    const parkedNow = spots.filter((s) => s.occupied).length;
    const coveragePct = total ? (detectedCount / total) * 100 : 0;
    const occPct = detectedCount ? (detOcc / detectedCount) * 100 : 0;
    const elapsedSec = sessionStart.current
      ? (Date.now() - sessionStart.current) / 1000
      : 0;
    const turnoverPerHr =
      elapsedSec > 45 ? exited / (elapsedSec / 3600) : null;
    const avgDwell = dwell.length
      ? dwell.reduce((a, b) => a + b, 0) / dwell.length / 1000
      : null;
    return {
      total,
      detectedCount,
      detOcc,
      detVac,
      parkedNow,
      coveragePct,
      occPct,
      turnoverPerHr,
      avgDwell,
    };
  }, [spots, sensors, exited, dwell, obstacles, cars]);

  // "flashlight" beams: each sensor = a lit disc minus solid shadow umbras (SVG mask).
  // Both static obstacles AND parked cars cast shadows.
  const beams = useMemo(
    () =>
      sensors.map((se) => ({
        id: se.id,
        x: se.x,
        y: se.y,
        r: se.radius,
        shadows: [
          ...obstacles.map((o) => shadowQuad(se, o)),
          ...cars.map((c) => {
            const dCar = Math.hypot(c.x + c.w / 2 - se.x, c.y + c.h / 2 - se.y);
            // limited shadow: only reaches ~1.5× the car's distance (distance-dependent)
            return shadowQuad(se, c as unknown as Obstacle, dCar * SHADOW_REACH);
          }),
        ].filter((s): s is string => s !== null),
      })),
    [sensors, obstacles, cars]
  );

  const selectedSensor = sensors.find((s) => s.id === selectedSensorId) || null;
  const selectedSensorSpotCount = useMemo(() => {
    if (!selectedSensor) return 0;
    return spots.filter((s) => sensorSees(s, selectedSensor, obstacles, cars))
      .length;
  }, [selectedSensor, spots, obstacles, cars]);

  // ============================================================
  return (
    <div className="min-h-screen flex flex-col">
      {/* ---------- TOP BAR ---------- */}
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0d1726]/80 backdrop-blur">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 grid place-items-center font-black text-white">
            L
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm text-white">
              LiDAR <span className="text-sky-400">ParkManager</span>
            </div>
            <div className="text-[10px] text-slate-400">
              ระบบบริหารจัดการลานจอดรถอัจฉริยะ · Prototype
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400">ผังลาน</label>
          <select
            value={layoutId}
            onChange={(e) => loadLayout(e.target.value)}
            className="bg-[#13243c] border border-white/10 rounded-md text-xs px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            {LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-slate-400 mr-1">จำลอง:</span>
          <button
            onClick={carIn}
            className="text-xs px-3 py-1.5 rounded-md font-semibold border bg-emerald-500/20 border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30"
          >
            🚗 รถเข้า
          </button>
          <button
            onClick={carOut}
            className="text-xs px-3 py-1.5 rounded-md font-semibold border bg-rose-500/20 border-rose-400/40 text-rose-100 hover:bg-rose-500/30"
          >
            ↩ รถออก
          </button>
          <button
            onClick={resetCurrent}
            className="text-xs px-3 py-1.5 rounded-md bg-[#13243c] border border-white/10 text-slate-200 hover:bg-[#1a2f4d]"
          >
            ↺ รีเซ็ต
          </button>
        </div>
      </header>

      {/* ---------- MAIN ---------- */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
        {/* ----- CANVAS COLUMN ----- */}
        <section className="relative p-3">
          <div className="text-xs text-slate-400 mb-2 px-1">
            {layout.description}
          </div>

          <div className="relative rounded-xl border border-white/10 bg-[#0a1322] overflow-hidden">
            {/* floating toolbar */}
            <div className="absolute z-10 top-3 left-3 flex flex-col gap-1.5 bg-[#0d1726]/90 backdrop-blur p-1.5 rounded-lg border border-white/10">
              <ToolBtn
                active={mode === "select"}
                title="เลือก / ลาก"
                onClick={() => setMode("select")}
              >
                ⤢
              </ToolBtn>
              <ToolBtn
                active={mode === "addSensor"}
                title="เพิ่ม LiDAR (คลิกบนผัง)"
                onClick={() =>
                  setMode((m) => (m === "addSensor" ? "select" : "addSensor"))
                }
              >
                ＋
              </ToolBtn>
              <ToolBtn
                active={editMode}
                title="โหมดแก้ไขผัง — ลากย้าย/เพิ่ม/ลบ ช่องจอด เสา ต้นไม้"
                onClick={() =>
                  setEditMode((v) => {
                    if (v) {
                      setMode("select");
                      setEditSel(null);
                    }
                    return !v;
                  })
                }
              >
                ✏️
              </ToolBtn>
              {editMode && (
                <>
                  <ToolBtn
                    active={mode === "addSpotV"}
                    title="วางช่องจอดแนวตั้ง (คลิกบนผัง วางต่อกันได้)"
                    onClick={() => setMode((m) => (m === "addSpotV" ? "select" : "addSpotV"))}
                  >
                    ▯
                  </ToolBtn>
                  <ToolBtn
                    active={mode === "addSpotH"}
                    title="วางช่องจอดแนวนอน (สำหรับมุม/เลี้ยว)"
                    onClick={() => setMode((m) => (m === "addSpotH" ? "select" : "addSpotH"))}
                  >
                    ▭
                  </ToolBtn>
                  <ToolBtn
                    active={mode === "addPillar"}
                    title="วางเสา"
                    onClick={() => setMode((m) => (m === "addPillar" ? "select" : "addPillar"))}
                  >
                    ▮
                  </ToolBtn>
                  <ToolBtn
                    active={mode === "addTree"}
                    title="วางต้นไม้"
                    onClick={() => setMode((m) => (m === "addTree" ? "select" : "addTree"))}
                  >
                    🌳
                  </ToolBtn>
                </>
              )}
              <ToolBtn
                title="ลบสิ่งที่เลือก (ปุ่ม Delete)"
                disabled={!editSel && !selectedSensorId}
                onClick={deleteSelected}
              >
                🗑
              </ToolBtn>
              <div className="h-px bg-white/10 my-0.5" />
              <ToolBtn
                active={showCoverage}
                title="แสดง/ซ่อนพื้นที่ตรวจจับ"
                onClick={() => setShowCoverage((v) => !v)}
              >
                ◎
              </ToolBtn>
              <ToolBtn
                active={showLabels}
                title="แสดง/ซ่อนรหัสช่องจอด"
                onClick={() => setShowLabels((v) => !v)}
              >
                #
              </ToolBtn>
              <ToolBtn
                active={carOcclusion}
                title="รถบัง LiDAR (occlusion) — รถที่จอดบังช่องด้านหลัง เปิด/ปิดเพื่อเทียบ"
                onClick={() => setCarOcclusion((v) => !v)}
              >
                🚙
              </ToolBtn>
            </div>

            {mode !== "select" && (
              <div className="absolute z-10 top-3 right-3 text-[11px] bg-sky-500/90 text-white px-2.5 py-1 rounded-md">
                {mode === "addSensor"
                  ? "คลิกบนผังเพื่อวาง LiDAR"
                  : mode === "addSpotV"
                  ? "คลิกวางช่องจอดแนวตั้ง (วางต่อกันได้)"
                  : mode === "addSpotH"
                  ? "คลิกวางช่องจอดแนวนอน (วางต่อกันได้)"
                  : mode === "addPillar"
                  ? "คลิกวางเสา"
                  : "คลิกวางต้นไม้"}
              </div>
            )}
            {editMode && mode === "select" && (
              <div className="absolute z-10 top-3 right-3 text-[11px] bg-amber-500/90 text-white px-2.5 py-1 rounded-md">
                โหมดแก้ไข: ลากย้ายช่อง/เสา/ต้นไม้ · คลิกเลือกแล้วกด Delete
              </div>
            )}

            {banner && (
              <div
                className={`absolute z-20 top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-bold shadow-lg ${
                  banner.tone === "full"
                    ? "bg-rose-500 text-white"
                    : "bg-slate-600 text-white"
                }`}
              >
                {banner.tone === "full" ? "🚫 " : "ℹ️ "}
                {banner.msg}
              </div>
            )}

            <svg
              ref={svgRef}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="w-full block touch-none select-none"
              style={{
                maxHeight: "68vh",
                cursor: mode !== "select" ? "crosshair" : "default",
              }}
              onPointerDown={onCanvasPointerDown}
            >
              {/* background */}
              <rect x={0} y={0} width={layout.width} height={layout.height} fill="#0a1322" />
              {/* lanes */}
              {layout.lanes.map((ln, i) => (
                <rect
                  key={`ln-${i}`}
                  x={ln.x}
                  y={ln.y}
                  width={ln.w}
                  height={ln.h}
                  fill="#101e33"
                  rx={6}
                />
              ))}
              {/* obstacles — pillars (เสา) & trees (ต้นไม้): both block LiDAR line-of-sight.
                  In edit mode they become draggable and selectable. */}
              {obstacles.map((ob, i) => {
                const obInteractive = editMode && mode === "select";
                const obSel =
                  editSel?.kind === "obstacle" && editSel.id === (ob.id ?? `ob-${i}`);
                const obId = ob.id ?? `ob-${i}`;
                const handlers = obInteractive
                  ? {
                      style: { cursor: "move" as const },
                      onPointerDown: (e: React.PointerEvent) =>
                        startElDrag(e, "obstacle", obId, ob.x, ob.y),
                      onClick: (e: React.MouseEvent) => e.stopPropagation(),
                    }
                  : { pointerEvents: "none" as const };
                if (ob.kind === "tree") {
                  const cx = ob.x + ob.w / 2;
                  const cy = ob.y + ob.h / 2;
                  const r = Math.min(ob.w, ob.h) / 2;
                  return (
                    <g key={obId} {...handlers}>
                      {obSel && (
                        <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#fbbf24" strokeWidth={2} />
                      )}
                      <circle cx={cx} cy={cy} r={r} fill="#1f6f43" stroke="#2e9d63" strokeWidth={1.5} />
                      <circle cx={cx - r * 0.28} cy={cy - r * 0.28} r={r * 0.45} fill="#2e9d63" opacity={0.8} />
                      <circle cx={cx} cy={cy} r={r * 0.18} fill="#0f3d26" />
                    </g>
                  );
                }
                return (
                  <g key={obId} {...handlers}>
                    {obSel && (
                      <rect
                        x={ob.x - 3}
                        y={ob.y - 3}
                        width={ob.w + 6}
                        height={ob.h + 6}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        rx={3}
                      />
                    )}
                    <rect
                      x={ob.x}
                      y={ob.y}
                      width={ob.w}
                      height={ob.h}
                      fill="#3a4a5f"
                      stroke="#5b7088"
                      strokeWidth={1.5}
                      rx={3}
                    />
                    <line x1={ob.x} y1={ob.y} x2={ob.x + ob.w} y2={ob.y + ob.h} stroke="#5b7088" strokeWidth={1} />
                    <line x1={ob.x + ob.w} y1={ob.y} x2={ob.x} y2={ob.y + ob.h} stroke="#5b7088" strokeWidth={1} />
                  </g>
                );
              })}

              {/* "flashlight" coverage: lit disc with solid shadow umbras cut out via mask.
                  Dashed circle = max range; the dark wedges behind pillars/trees = shadows. */}
              {showCoverage && (
                <>
                  <defs>
                    {beams.map((b) => (
                      <mask
                        key={`mask-${b.id}`}
                        id={`beam-${b.id}`}
                        maskUnits="userSpaceOnUse"
                      >
                        <circle cx={b.x} cy={b.y} r={b.r} fill="#fff" />
                        {b.shadows.map((s, i) => (
                          <polygon key={i} points={s} fill="#000" />
                        ))}
                      </mask>
                    ))}
                  </defs>
                  {beams.map((b) => {
                    const sel = b.id === selectedSensorId;
                    return (
                      <g key={`cov-${b.id}`} pointerEvents="none">
                        <circle
                          cx={b.x}
                          cy={b.y}
                          r={b.r}
                          fill={sel ? "rgba(56,189,248,0.20)" : "rgba(56,189,248,0.11)"}
                          mask={`url(#beam-${b.id})`}
                        />
                        <circle
                          cx={b.x}
                          cy={b.y}
                          r={b.r}
                          fill="none"
                          stroke={BLUE}
                          strokeOpacity={sel ? 0.5 : 0.25}
                          strokeWidth={1}
                          strokeDasharray="6 5"
                          className={sel ? "ring-selected" : undefined}
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {/* spots */}
              {spots.map((s) => {
                const { cx, cy } = spotCenter(s);
                const det = isCovered(s, sensors, obstacles, cars);
                const spotSel = editSel?.kind === "spot" && editSel.id === s.id;
                return (
                  <g
                    key={s.id}
                    className={editMode ? "cursor-move" : "cursor-pointer"}
                    pointerEvents={mode !== "select" ? "none" : "auto"}
                    onPointerDown={(e) => {
                      if (editMode) startElDrag(e, "spot", s.id, s.x, s.y);
                      else e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editMode) setEditSel({ kind: "spot", id: s.id });
                      else toggleSpot(s);
                    }}
                  >
                    {spotSel && (
                      <rect
                        x={s.x - 3}
                        y={s.y - 3}
                        width={s.w + 6}
                        height={s.h + 6}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={2}
                        rx={5}
                      />
                    )}
                    <rect
                      className="stall"
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={s.h}
                      rx={4}
                      fill="rgba(255,255,255,0.02)"
                      stroke="#2b425f"
                      strokeWidth={1.4}
                    />
                    {det && !s.occupied && (
                      <Hex cx={cx} cy={cy} fill={GREEN} label="P" />
                    )}
                    {det && s.occupied && <CarShape s={s} color={RED} />}
                    {!det && (
                      <>
                        {s.occupied && <CarShape s={s} color={GRAY} ghost />}
                        <Hex cx={cx} cy={cy} fill={GRAY} label="?" />
                      </>
                    )}
                    {showLabels && (
                      <text
                        x={s.x + 3}
                        y={s.y + 11}
                        fontSize={8}
                        fill="#7e93ad"
                        pointerEvents="none"
                      >
                        {s.id}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* driving cars (in / out) — follow the lane path then park */}
              {movers.map((m) => {
                const p = easeInOut(
                  Math.max(0, Math.min(1, (performance.now() - m.start) / m.dur))
                );
                const pos = pointOnPath(m.path, p);
                const color = m.kind === "in" ? RED : "#f59e0b";
                return (
                  <g
                    key={m.key}
                    transform={`translate(${pos.x} ${pos.y}) rotate(${pos.ang})`}
                    pointerEvents="none"
                  >
                    <rect x={-19} y={-11} width={38} height={22} rx={6} fill={color} />
                    <rect x={3} y={-8} width={11} height={16} rx={2} fill="rgba(255,255,255,0.55)" />
                    <circle cx={16} cy={-5} r={2} fill="#fde68a" />
                    <circle cx={16} cy={5} r={2} fill="#fde68a" />
                  </g>
                );
              })}

              {/* sensor nodes */}
              {sensors.map((se) => {
                const sel = se.id === selectedSensorId;
                return (
                  <g key={`node-${se.id}`}>
                    {/* node */}
                    <g
                      style={{ cursor: "grab" }}
                      onPointerDown={(e) => startSensorDrag(e, se, "move")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <circle
                        cx={se.x}
                        cy={se.y}
                        r={13}
                        fill="#0b2740"
                        stroke={sel ? "#7dd3fc" : BLUE}
                        strokeWidth={sel ? 3 : 2}
                      />
                      <line x1={se.x - 7} y1={se.y} x2={se.x + 7} y2={se.y} stroke={BLUE} strokeWidth={1.5} />
                      <line x1={se.x} y1={se.y - 7} x2={se.x} y2={se.y + 7} stroke={BLUE} strokeWidth={1.5} />
                      <circle cx={se.x} cy={se.y} r={2.5} fill={BLUE} />
                      <text
                        x={se.x}
                        y={se.y - 18}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={700}
                        fill="#bfe3ff"
                        pointerEvents="none"
                      >
                        {se.name}
                      </text>
                    </g>
                    {/* radius handle (with guide line so it reads as a radius control) */}
                    {sel && (
                      <g
                        style={{ cursor: "ew-resize" }}
                        onPointerDown={(e) => startSensorDrag(e, se, "radius")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <line
                          x1={se.x}
                          y1={se.y}
                          x2={se.x + se.radius}
                          y2={se.y}
                          stroke="#7dd3fc"
                          strokeOpacity={0.5}
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          pointerEvents="none"
                        />
                        <circle
                          cx={se.x + se.radius}
                          cy={se.y}
                          r={8}
                          fill="#7dd3fc"
                          stroke="#0b2740"
                          strokeWidth={2}
                        />
                        <circle cx={se.x + se.radius} cy={se.y} r={2.5} fill="#0b2740" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-slate-300 border-t border-white/10 bg-[#0d1726]">
              <Legend color={GREEN} label="ว่าง (ตรวจจับได้)" />
              <Legend color={RED} label="เต็ม (มีรถ)" />
              <Legend color={GRAY} label="จุดบอด (LiDAR มองไม่เห็น)" />
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full border"
                  style={{ borderColor: BLUE, background: "rgba(56,189,248,0.15)" }}
                />
                พื้นที่ตรวจจับ LiDAR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#1f6f43" }} />
                เสา/ต้นไม้ (บัง LiDAR เกิดเงา)
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  carOcclusion ? "text-amber-300" : "text-slate-500"
                }`}
              >
                🚙 รถบัง LiDAR: {carOcclusion ? "เปิด" : "ปิด"}
              </span>
              <span className="ml-auto text-slate-500">
                ลากไอคอน LiDAR เพื่อย้าย · ลากจุดฟ้าเพื่อปรับรัศมี · คลิกช่องเพื่อรถเข้า/ออก
              </span>
            </div>
          </div>
        </section>

        {/* ----- RIGHT PANEL ----- */}
        <aside className="border-l border-white/10 bg-[#0d1726] flex flex-col max-h-[calc(100vh-58px)]">
          <div className="flex border-b border-white/10 text-xs">
            {([
              ["overview", "ภาพรวม"],
              ["sensor", "เซนเซอร์"],
              ["events", "เหตุการณ์"],
            ] as [Tab, string][]).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex-1 py-2.5 font-semibold ${
                  tab === k
                    ? "text-sky-300 border-b-2 border-sky-400 bg-white/5"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto thin-scroll p-3">
            {tab === "overview" && (
              <OverviewTab
                stats={stats}
                entered={entered}
                exited={exited}
                sensorCount={sensors.length}
                mounted={mounted}
              />
            )}
            {tab === "sensor" && (
              <SensorTab
                sensor={selectedSensor}
                spotCount={selectedSensorSpotCount}
                onRadius={(r) => selectedSensor && updateSensor(selectedSensor.id, { radius: r })}
                onRename={(name) => selectedSensor && updateSensor(selectedSensor.id, { name })}
                onDelete={() => {
                  if (!selectedSensor) return;
                  const s = selectedSensor;
                  setSensors((p) => p.filter((x) => x.id !== s.id));
                  setSelectedSensorId(null);
                  pushEvent("sensor", `ลบเซนเซอร์ ${s.name}`);
                }}
                onAdd={() => setMode("addSensor")}
              />
            )}
            {tab === "events" && <EventsTab events={events} mounted={mounted} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- small UI atoms ----------
function ToolBtn({
  children,
  onClick,
  active,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded-md grid place-items-center text-base ${
        disabled
          ? "opacity-30 cursor-not-allowed text-slate-400"
          : active
          ? "bg-sky-500 text-white"
          : "bg-[#13243c] text-slate-200 hover:bg-[#1a2f4d]"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rotate-0"
        style={{
          background: color,
          clipPath:
            "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        }}
      />
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-[#13243c] border border-white/10 p-2.5">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-xl font-extrabold ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Bar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamp(pct, 0, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function OverviewTab({
  stats,
  entered,
  exited,
  sensorCount,
  mounted,
}: {
  stats: any;
  entered: number;
  exited: number;
  sensorCount: number;
  mounted: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="รถในลานตอนนี้" value={`${stats.parkedNow}`} sub={`จาก ${stats.total} ช่อง`} accent="text-sky-300" />
        <StatCard label="ช่องว่าง (ตรวจจับได้)" value={`${stats.detVac}`} accent="text-emerald-300" />
        <StatCard label="รถเข้าสะสม" value={`${entered}`} sub="คัน" accent="text-emerald-300" />
        <StatCard label="รถออกสะสม" value={`${exited}`} sub="คัน" accent="text-rose-300" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="หมุนเวียน / ชม."
          value={stats.turnoverPerHr != null ? stats.turnoverPerHr.toFixed(0) : "—"}
          sub="คันต่อชั่วโมง (จำลอง)"
          accent="text-amber-300"
        />
        <StatCard
          label="เวลาจอดเฉลี่ย"
          value={stats.avgDwell != null ? `${stats.avgDwell.toFixed(0)}s` : "—"}
          sub="ต่อคัน (เวลาจำลอง)"
        />
      </div>

      <div className="rounded-lg bg-[#13243c] border border-white/10 p-3 space-y-3">
        <Bar label="อัตราครอบครอง (ของพื้นที่ตรวจจับ)" pct={stats.occPct} color="#f59e0b" />
        <Bar label="พื้นที่ตรวจจับ LiDAR" pct={stats.coveragePct} color={BLUE} />
        <div className="text-[11px] text-slate-400">
          LiDAR มองเห็น <b className="text-sky-300">{stats.detectedCount}</b> / {stats.total} ช่อง
          {stats.coveragePct < 100 && (
            <span className="text-amber-300">
              {" "}
              · มีจุดบอด {stats.total - stats.detectedCount} ช่อง — ลองเพิ่ม/ขยับ LiDAR
            </span>
          )}
        </div>
      </div>

      <div className="text-[11px] text-slate-500">
        เซนเซอร์ทั้งหมด {sensorCount} ตัว · ตัวเลขสถิติคำนวณจากสิ่งที่ LiDAR “มองเห็น” เท่านั้น
        ซึ่งสะท้อนว่าตำแหน่งเซนเซอร์ดีพอหรือยัง
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-white/5">
      <span className="text-slate-400">{k}</span>
      <span className="text-slate-100 font-medium text-right">{v}</span>
    </div>
  );
}

function SensorTab({
  sensor,
  spotCount,
  onRadius,
  onRename,
  onDelete,
  onAdd,
}: {
  sensor: Sensor | null;
  spotCount: number;
  onRadius: (r: number) => void;
  onRename: (n: string) => void;
  onDelete: () => void;
  onAdd: () => void;
}) {
  if (!sensor) {
    return (
      <div className="text-sm text-slate-400 space-y-3">
        <p>ยังไม่ได้เลือกเซนเซอร์</p>
        <p className="text-xs">
          คลิกไอคอน LiDAR บนผังเพื่อดูรายละเอียด หรือกดปุ่มด้านล่างเพื่อเพิ่มตัวใหม่
        </p>
        <button
          onClick={onAdd}
          className="text-xs px-3 py-2 rounded-md bg-sky-500 text-white font-semibold"
        >
          ＋ เพิ่มเซนเซอร์ LiDAR
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg bg-[#0b2740] border border-sky-500/30 p-3">
        <div className="text-sky-300 font-bold mb-2">รายละเอียดเซนเซอร์</div>
        <Row k="ID" v={sensor.id} />
        <Row k="Code" v={sensor.code} />
        <div className="flex justify-between items-center gap-3 py-1 border-b border-white/5">
          <span className="text-slate-400">Name</span>
          <input
            value={sensor.name}
            onChange={(e) => onRename(e.target.value)}
            className="bg-[#13243c] border border-white/10 rounded px-2 py-0.5 text-right text-slate-100 w-40"
          />
        </div>
        <Row k="Type" v="Parking (overhead)" />
        <Row k="Temperature" v={`${sensor.temp} °C`} />
        <Row k="ตรวจจับช่องจอด" v={`${spotCount} ช่อง`} />
      </div>

      <div className="rounded-lg bg-[#13243c] border border-white/10 p-3 space-y-2">
        <div className="flex justify-between text-slate-300">
          <span>รัศมีตรวจจับ</span>
          <span className="font-semibold text-sky-300">{Math.round(sensor.radius)} px</span>
        </div>
        <input
          type="range"
          min={40}
          max={400}
          value={Math.round(sensor.radius)}
          onChange={(e) => onRadius(Number(e.target.value))}
          className="w-full accent-sky-400"
        />
        <div className="text-[11px] text-slate-500">
          ปรับรัศมีให้ครอบช่องจอดได้มากที่สุดโดยไม่ทับซ้อนเซนเซอร์อื่นมากเกินไป
          (หรือจะลากจุดฟ้าบนผังก็ได้)
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <ColorChip color={GREEN} label="ว่าง" />
        <ColorChip color={RED} label="เต็ม" />
        <ColorChip color={GRAY} label="บอด" />
        <ColorChip color={BLUE} label="LiDAR" />
      </div>

      <button
        onClick={onDelete}
        className="w-full text-xs px-3 py-2 rounded-md bg-rose-500/15 border border-rose-400/40 text-rose-200 font-semibold hover:bg-rose-500/25"
      >
        🗑 ลบเซนเซอร์นี้ (หรือกดปุ่ม Delete)
      </button>
    </div>
  );
}

function ColorChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="w-5 h-5 rounded" style={{ background: color }} />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  );
}

function EventsTab({
  events,
  mounted,
}: {
  events: ParkEvent[];
  mounted: boolean;
}) {
  if (!mounted) return null;
  if (events.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        ยังไม่มีเหตุการณ์ · กดปุ่ม “รถเข้า/รถออก” ด้านบน หรือคลิกช่องจอดบนผัง
      </div>
    );
  }
  const color = (t: ParkEvent["type"]) =>
    t === "in" ? GREEN : t === "out" ? RED : t === "sensor" ? BLUE : "#94a3b8";
  return (
    <div className="space-y-1">
      {events.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-2 text-[11px] py-1 border-b border-white/5"
        >
          <span
            className="mt-1 w-2 h-2 rounded-full shrink-0"
            style={{ background: color(e.type) }}
          />
          <span className="text-slate-300 flex-1">{e.msg}</span>
          <span className="text-slate-500 tabular-nums">
            {new Date(e.t).toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
