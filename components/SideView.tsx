"use client";

import { useMemo, useRef, useState } from "react";
import { Spot, Sensor, Obstacle } from "@/lib/types";
import { LIDAR_MODELS, getModel, type LidarModel } from "@/lib/lidarModels";

/**
 * SideView — มุมมองด้านข้าง (cross-section) ของ LiDAR ลานจอดรถ
 *  - โหมด "จากผัง": ตัดภาพตัดตามทิศ (azimuth) จากเซนเซอร์จริงในผัง top view → จำลองเหมือนจริง
 *  - โหมด "ตั้งเอง": สร้างแถวรถจำลองเองเพื่อทดลอง
 *  - เลือกรุ่น LiDAR (บังคับขีดจำกัด) + ภาพ illustration ตามฟอร์มจริง
 */

const SKY = "#0a1322";
const BEAM = "#38bdf8";
const GREEN = "#22c55e";
const RED = "#ef4444";
const GRAY = "#64748b";
const AMBER = "#f59e0b";
const D2R = Math.PI / 180;

const CAR_TYPES = [
  { label: "เก๋ง", h: 1.45 },
  { label: "เก๋งสปอร์ต", h: 1.35 },
  { label: "SUV", h: 1.72 },
  { label: "กระบะ", h: 1.82 },
  { label: "รถตู้", h: 2.05 },
];
const CAR_LEN = 4.4;
const FIRST_X = 5;
const STALL_LEN_M = 5.0; // ความยาวช่องจอดมาตรฐาน (ใช้คำนวณสเกล px→m)
const STALL_W_M = 2.5;

type Slot = { occupied: boolean; typeIdx: number; h?: number };
type Rect = { x0: number; x1: number; h: number; kind: "car" | "pillar"; item: number; label: string };
type Hit = { t: number; kind: "ground" | "range" | "obj"; objIndex: number };
type SlotStatus = "free" | "full" | "blind";
type DisplayItem = {
  key: string;
  kind: "car" | "pillar";
  x0: number; // m (ขอบใกล้)
  x1: number; // m (ขอบไกล)
  h: number; // m (สเกลแล้ว)
  baseH: number; // m (ก่อนสเกล)
  occupied: boolean;
  label: string;
  typeIdx: number;
  spotId?: string; // โหมดจากผัง
  slotIndex?: number; // โหมดตั้งเอง
};

const STATUS_COLOR: Record<SlotStatus, string> = { free: GREEN, full: RED, blind: GRAY };
const STATUS_LABEL: Record<SlotStatus, string> = { free: "ว่าง", full: "เต็ม", blind: "จุดบอด" };

function hash(i: number, seed: number) {
  let x = ((i + 1) * 2654435761) ^ (seed * 40503 + 12345);
  x = (x ^ (x >>> 13)) >>> 0;
  return x;
}
function strHash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function genSlots(n: number, seed: number): Slot[] {
  return Array.from({ length: n }, (_, i) => {
    const hv = hash(i, seed);
    return { occupied: (hv >>> 5) % 4 !== 0, typeIdx: hv % CAR_TYPES.length };
  });
}
const randomSlot = (): Slot => ({ occupied: true, typeIdx: Math.floor(Math.random() * CAR_TYPES.length) });

function rayRectEntry(ox: number, oy: number, dx: number, dy: number, r: Rect): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < r.x0 || ox > r.x1) return null;
  } else {
    let ta = (r.x0 - ox) / dx;
    let tb = (r.x1 - ox) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    tmin = Math.max(tmin, ta);
    tmax = Math.min(tmax, tb);
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < 0 || oy > r.h) return null;
  } else {
    let ta = (0 - oy) / dy;
    let tb = (r.h - oy) / dy;
    if (ta > tb) [ta, tb] = [tb, ta];
    tmin = Math.max(tmin, ta);
    tmax = Math.min(tmax, tb);
  }
  if (tmax < Math.max(tmin, 0)) return null;
  const t = tmin > 1e-6 ? tmin : tmax;
  return t > 1e-6 ? t : null;
}

// =================================================================
// LiDAR illustration ตามฟอร์มจริง (spinning puck / dome)
// =================================================================
export function LidarIllustration({ model, size = 56 }: { model: LidarModel; size?: number }) {
  const w = size;
  const h = size;
  return (
    <svg viewBox="0 0 64 64" width={w} height={h} aria-label={`${model.brand} ${model.model}`}>
      <defs>
        <linearGradient id={`mg-${model.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      {model.formFactor === "spinning" ? (
        <g>
          {/* ฐาน */}
          <rect x="18" y="44" width="28" height="10" rx="2" fill="#334155" />
          {/* กระบอกหมุน */}
          <rect x="16" y="18" width="32" height="28" rx="6" fill={`url(#mg-${model.id})`} stroke="#1e293b" strokeWidth="1.5" />
          {/* แถบเลนส์ */}
          <rect x="16" y="26" width="32" height="12" rx="2" fill="#0ea5e9" opacity="0.85" />
          <line x1="16" y1="32" x2="48" y2="32" stroke="#082f49" strokeWidth="1" />
          {/* ฝาบน */}
          <ellipse cx="32" cy="18" rx="16" ry="4" fill="#94a3b8" stroke="#1e293b" strokeWidth="1" />
        </g>
      ) : (
        <g>
          {/* dome / กล่องเล็ก (Livox) */}
          <rect x="20" y="40" width="24" height="14" rx="2" fill="#334155" />
          <path d="M20 40 q12 -22 24 0 Z" fill={`url(#mg-${model.id})`} stroke="#1e293b" strokeWidth="1.5" />
          <ellipse cx="32" cy="36" rx="7" ry="4" fill="#0ea5e9" opacity="0.85" />
        </g>
      )}
    </svg>
  );
}

// ใช้รูปจริงถ้ามี (public/lidar/<id>.jpg) ไม่งั้น fallback เป็น illustration — ไม่ทำให้โค้ดพัง
export function LidarVisual({ model, size = 56 }: { model: LidarModel; size?: number }) {
  const [err, setErr] = useState(false);
  if (model.imageUrl && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={model.imageUrl} alt={`${model.brand} ${model.model}`} width={size} height={size} style={{ objectFit: "contain" }} onError={() => setErr(true)} />;
  }
  return <LidarIllustration model={model} size={size} />;
}

// =================================================================
// HOOK
// =================================================================
export function useSideView(opts?: {
  spots?: Spot[];
  sensors?: Sensor[];
  obstacles?: Obstacle[];
  selectedSensorId?: string | null;
  layoutW?: number;
  layoutH?: number;
  onToggleSpot?: (id: string, occ: boolean) => void;
}) {
  const spots = opts?.spots ?? [];
  const sensors = opts?.sensors ?? [];
  const obstacles = opts?.obstacles ?? [];
  const layoutW = opts?.layoutW ?? 700;
  const layoutH = opts?.layoutH ?? 400;
  const hasLayout = sensors.length > 0 && spots.length > 0;

  // ---- LiDAR ----
  const [height, setHeight] = useState(4.5);
  const [tilt, setTilt] = useState(12);
  const [vfov, setVfov] = useState(30);
  const [range, setRange] = useState(35);
  const [modelId, setModelIdRaw] = useState(LIDAR_MODELS[0].id);
  const model = getModel(modelId);
  const setModelId = (id: string) => {
    const md = getModel(id);
    setModelIdRaw(id);
    setRange((r) => Math.min(Math.max(r, Math.ceil(md.minRange)), md.maxRange));
    setVfov((v) => Math.min(v, md.vfov));
    setHeight((h) => Math.max(h, md.recMount[0]));
  };
  const setRangeClamped = (v: number) => setRange(Math.min(v, model.maxRange));
  const setVfovClamped = (v: number) => setVfov(Math.min(v, model.vfov));

  // ---- โหมดฉาก ----
  const [sceneSource, setSceneSource] = useState<"layout" | "manual">("layout");
  const effSource: "layout" | "manual" = hasLayout ? sceneSource : "manual";
  const [azimuth, setAzimuth] = useState(0); // ทิศสแกนแนวนอน (°)

  // ---- ตั้งเอง ----
  const [scale, setScale] = useState(1.0);
  const [spacing, setSpacing] = useState(5.2);
  const [pillarOn, setPillarOn] = useState(true);
  const [pillarH, setPillarH] = useState(3.2);
  const [seed, setSeed] = useState(1);
  const [slots, setSlots] = useState<Slot[]>(() => genSlots(6, 1));
  const slotX = (i: number) => FIRST_X + i * spacing;
  const baseHm = (s: Slot) => s.h ?? CAR_TYPES[s.typeIdx].h;

  // ---- ความสูงรถต่อช่อง (โหมดจากผัง) ----
  const [spotHeight, setSpotHeight] = useState<Record<string, number>>({});
  const spotTypeIdx = (id: string) => strHash(id) % CAR_TYPES.length;
  const spotBaseH = (id: string) => spotHeight[id] ?? CAR_TYPES[spotTypeIdx(id)].h;

  // ---- สเกล px→m จากขนาดช่องจริง ----
  const metersPerPx = useMemo(() => {
    if (!spots.length) return 0.05;
    const lens = spots.map((s) => (s.vertical ? s.h : s.w)).filter((v) => v > 0).sort((a, b) => a - b);
    const med = lens[Math.floor(lens.length / 2)] || 100;
    return STALL_LEN_M / med;
  }, [spots]);

  const origin = useMemo<Sensor | null>(() => {
    if (!sensors.length) return null;
    return sensors.find((s) => s.id === opts?.selectedSensorId) || sensors[0];
  }, [sensors, opts?.selectedSensorId]);

  // ---- minimap (ทิศสแกน + ช่องที่อยู่ในแนวตัด) ----
  const minimap = useMemo(() => {
    if (!origin) return null;
    const phi = azimuth * D2R;
    const dir = { x: Math.cos(phi), y: Math.sin(phi) };
    const perp = { x: -Math.sin(phi), y: Math.cos(phi) };
    const corridorHalfPx = (STALL_W_M / 2 + 0.6) / metersPerPx;
    const inSlice = (cx: number, cy: number) => {
      const rx = cx - origin.x;
      const ry = cy - origin.y;
      const fwd = rx * dir.x + ry * dir.y;
      const lat = rx * perp.x + ry * perp.y;
      return fwd > 0 && Math.abs(lat) <= corridorHalfPx;
    };
    return {
      dir, perp, corridorHalfPx,
      origin: { x: origin.x, y: origin.y, radius: origin.radius },
      spots: spots.map((s) => ({ id: s.id, x: s.x + s.w / 2, y: s.y + s.h / 2, occ: s.occupied, in: inSlice(s.x + s.w / 2, s.y + s.h / 2) })),
      obstacles: obstacles.map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2, in: inSlice(o.x + o.w / 2, o.y + o.h / 2) })),
    };
  }, [origin, azimuth, spots, obstacles, metersPerPx]);

  // ---- สร้างรายการวัตถุ (items) ----
  const items = useMemo<DisplayItem[]>(() => {
    if (effSource === "layout" && origin && minimap) {
      const phi = azimuth * D2R;
      const dir = { x: Math.cos(phi), y: Math.sin(phi) };
      const perp = { x: -Math.sin(phi), y: Math.cos(phi) };
      const corridorHalfPx = minimap.corridorHalfPx;
      const out: DisplayItem[] = [];
      spots.forEach((s) => {
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const rx = cx - origin.x;
        const ry = cy - origin.y;
        const fwd = rx * dir.x + ry * dir.y;
        const lat = rx * perp.x + ry * perp.y;
        if (fwd <= 0 || Math.abs(lat) > corridorHalfPx) return;
        const dM = fwd * metersPerPx;
        const bh = spotBaseH(s.id);
        out.push({ key: `sp-${s.id}`, kind: "car", x0: dM - CAR_LEN / 2, x1: dM + CAR_LEN / 2, h: bh, baseH: bh, occupied: s.occupied, label: CAR_TYPES[spotTypeIdx(s.id)].label, typeIdx: spotTypeIdx(s.id), spotId: s.id });
      });
      obstacles.forEach((o, k) => {
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        const rx = cx - origin.x;
        const ry = cy - origin.y;
        const fwd = rx * dir.x + ry * dir.y;
        const lat = rx * perp.x + ry * perp.y;
        if (fwd <= 0 || Math.abs(lat) > corridorHalfPx) return;
        const dM = fwd * metersPerPx;
        const ph = o.kind === "tree" ? 4.0 : 3.0;
        out.push({ key: `ob-${o.id ?? k}`, kind: "pillar", x0: dM - 0.3, x1: dM + 0.3, h: ph, baseH: ph, occupied: true, label: o.kind === "tree" ? "ต้นไม้" : "เสา", typeIdx: 0 });
      });
      return out.sort((a, b) => a.x0 - b.x0);
    }
    // manual
    const out: DisplayItem[] = [];
    slots.forEach((s, i) => {
      const x0 = slotX(i);
      const bh = baseHm(s);
      out.push({ key: `sl-${i}`, kind: "car", x0, x1: x0 + CAR_LEN, h: bh * scale, baseH: bh, occupied: s.occupied, label: CAR_TYPES[s.typeIdx].label, typeIdx: s.typeIdx, slotIndex: i });
    });
    if (pillarOn) {
      const px = FIRST_X + 2 * spacing - 1.1;
      out.push({ key: "pil", kind: "pillar", x0: px, x1: px + 0.5, h: pillarH, baseH: pillarH, occupied: true, label: "เสา", typeIdx: 0 });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effSource, origin, minimap, azimuth, spots, obstacles, metersPerPx, spotHeight, slots, spacing, scale, pillarOn, pillarH]);

  // scale ใช้กับ layout cars ด้วย (ปรับขนาดรวม)
  const scaledItems = useMemo(
    () => items.map((it) => (it.kind === "car" && effSource === "layout" ? { ...it, h: it.baseH * scale } : it)),
    [items, scale, effSource]
  );

  // ---- ray-casting ----
  const objects = useMemo<Rect[]>(() => {
    const objs: Rect[] = [];
    scaledItems.forEach((it, idx) => {
      if (it.kind === "pillar" || it.occupied) {
        objs.push({ x0: it.x0, x1: it.x1, h: it.h, kind: it.kind, item: idx, label: it.label });
      }
    });
    return objs;
  }, [scaledItems]);

  const sim = useMemo(() => {
    const aTop = tilt * D2R - (vfov * D2R) / 2;
    const aBot = tilt * D2R + (vfov * D2R) / 2;
    const N = 300;
    const endpoints: { x: number; y: number; kind: Hit["kind"] }[] = [];
    const detectedItem = new Set<number>();
    for (let i = 0; i <= N; i++) {
      const a = aTop + ((aBot - aTop) * i) / N;
      const dx = Math.cos(a);
      const dy = -Math.sin(a);
      let best: Hit = { t: range, kind: "range", objIndex: -1 };
      if (dy < -1e-6) {
        const tg = height / Math.sin(a);
        if (tg > 0 && tg < best.t) best = { t: tg, kind: "ground", objIndex: -1 };
      }
      for (let k = 0; k < objects.length; k++) {
        const t = rayRectEntry(0, height, dx, dy, objects[k]);
        if (t !== null && t < best.t) best = { t, kind: "obj", objIndex: k };
      }
      endpoints.push({ x: dx * best.t, y: height + dy * best.t, kind: best.kind });
      if (best.kind === "obj") detectedItem.add(objects[best.objIndex].item);
    }
    const nearGround = aBot > 1e-4 ? height / Math.tan(aBot) : Infinity;
    const farGround = aTop > 1e-4 ? height / Math.tan(aTop) : Infinity;
    return { aTop, aBot, endpoints, detectedItem, nearGround, farGround };
  }, [height, tilt, vfov, range, objects]);

  const litSegments = useMemo(() => {
    const segs: { x1: number; x2: number }[] = [];
    let start: number | null = null;
    let prev: number | null = null;
    for (const p of sim.endpoints) {
      if (p.kind === "ground") {
        if (start === null) start = p.x;
        prev = p.x;
      } else if (start !== null && prev !== null) {
        segs.push({ x1: start, x2: prev });
        start = prev = null;
      }
    }
    if (start !== null && prev !== null) segs.push({ x1: start, x2: prev });
    return segs;
  }, [sim]);
  const groundLit = (x: number) =>
    litSegments.some((s) => {
      const lo = Math.min(s.x1, s.x2);
      const hi = Math.max(s.x1, s.x2);
      return x >= lo - 0.3 && x <= hi + 0.3;
    });

  // ---- สถานะรายไอเทม (เฉพาะรถ) ----
  const itemInfo = scaledItems.map((it, idx) => {
    if (it.kind === "pillar") return { status: "free" as SlotStatus, seen: true };
    const seen = it.occupied ? sim.detectedItem.has(idx) : groundLit((it.x0 + it.x1) / 2);
    const status: SlotStatus = !seen ? "blind" : it.occupied ? "full" : "free";
    return { status, seen };
  });
  const carItems = scaledItems.map((it, i) => ({ it, i })).filter((x) => x.it.kind === "car");
  const cFree = carItems.filter((x) => itemInfo[x.i].status === "free").length;
  const cFull = carItems.filter((x) => itemInfo[x.i].status === "full").length;
  const cBlind = carItems.filter((x) => itemInfo[x.i].status === "blind").length;

  // ---- actions ----
  const toggleItem = (idx: number) => {
    const it = scaledItems[idx];
    if (!it || it.kind !== "car") return;
    if (effSource === "layout" && it.spotId) {
      opts?.onToggleSpot?.(it.spotId, !it.occupied);
    } else if (it.slotIndex != null) {
      setSlots((prev) => {
        const next = [...prev];
        next[it.slotIndex!] = it.occupied ? { ...next[it.slotIndex!], occupied: false } : randomSlot();
        return next;
      });
    }
  };
  const setItemHeight = (idx: number, h: number) => {
    const it = scaledItems[idx];
    if (!it) return;
    if (effSource === "layout" && it.spotId) setSpotHeight((p) => ({ ...p, [it.spotId!]: h }));
    else if (it.slotIndex != null) setSlots((prev) => { const n = [...prev]; n[it.slotIndex!] = { ...n[it.slotIndex!], h }; return n; });
  };
  const setItemType = (idx: number, typeIdx: number) => {
    const it = scaledItems[idx];
    if (!it) return;
    if (effSource === "layout" && it.spotId) setSpotHeight((p) => ({ ...p, [it.spotId!]: CAR_TYPES[typeIdx].h }));
    else if (it.slotIndex != null) setSlots((prev) => { const n = [...prev]; n[it.slotIndex!] = { ...n[it.slotIndex!], typeIdx, h: undefined }; return n; });
  };

  const driveIn = () => {
    if (effSource === "layout") {
      const empty = carItems.filter((x) => !x.it.occupied);
      if (empty.length) toggleItem(empty[Math.floor(Math.random() * empty.length)].i);
      return;
    }
    setSlots((prev) => {
      const empty = prev.map((s, i) => (!s.occupied ? i : -1)).filter((i) => i >= 0);
      if (!empty.length) return prev;
      const i = empty[Math.floor(Math.random() * empty.length)];
      const n = [...prev]; n[i] = randomSlot(); return n;
    });
  };
  const driveOut = () => {
    if (effSource === "layout") {
      const full = carItems.filter((x) => x.it.occupied);
      if (full.length) toggleItem(full[Math.floor(Math.random() * full.length)].i);
      return;
    }
    setSlots((prev) => {
      const full = prev.map((s, i) => (s.occupied ? i : -1)).filter((i) => i >= 0);
      if (!full.length) return prev;
      const i = full[Math.floor(Math.random() * full.length)];
      const n = [...prev]; n[i] = { ...n[i], occupied: false }; return n;
    });
  };
  const addSlot = () => setSlots((p) => [...p, randomSlot()]);
  const removeSlot = (i: number) => setSlots((p) => (p.length <= 1 ? p : p.filter((_, k) => k !== i)));
  const reroll = () => { const ns = seed + 1; setSeed(ns); setSlots(genSlots(slots.length, ns)); };

  // ---- recommendations ----
  const recs: string[] = [];
  const firstCar = carItems.find((x) => x.it.occupied);
  const firstX = firstCar ? firstCar.it.x0 : FIRST_X;
  if (sim.nearGround > firstX + 0.5 && firstCar)
    recs.push("ลำแสงขอบล่างเลยหัวรถคันใกล้สุด → เพิ่มองศาก้ม (tilt) หรือเพิ่ม FOV");
  if (cBlind > 0)
    recs.push(`มี ${cBlind} ช่องที่ LiDAR มองไม่เห็น (จุดบอด) → ยกเสาสูงขึ้น/เพิ่ม tilt หรือหมุน azimuth ไปเก็บมุมอื่น`);
  if (effSource === "layout" && carItems.length === 0)
    recs.push("ทิศนี้ไม่มีช่องจอดอยู่ในแนวตัด → หมุน azimuth ไปยังทิศที่มีช่องจอด");
  if (recs.length === 0) recs.push("ทิศนี้ LiDAR เห็นช่องในแนวตัดครบ ไม่มีจุดบอด ✓");

  return {
    height, setHeight, tilt, setTilt, vfov, setVfov, range, setRange,
    modelId, setModelId, model, setRangeClamped, setVfovClamped,
    sceneSource, setSceneSource, effSource, hasLayout, azimuth, setAzimuth, minimap, layoutW, layoutH, metersPerPx,
    scale, setScale, spacing, setSpacing, pillarOn, setPillarOn, pillarH, setPillarH,
    items: scaledItems, itemInfo, carItems, objects, sim, litSegments,
    cFree, cFull, cBlind, recs,
    toggleItem, setItemHeight, setItemType, driveIn, driveOut, addSlot, removeSlot, reroll,
  };
}

export type SideModel = ReturnType<typeof useSideView>;

// =================================================================
// CANVAS
// =================================================================
const VB_W = 920;
const VB_H = 380;
const M_L = 52;
const M_R = 24;
const M_T = 18;
const GROUND_Y = 320;

// ---- inset top-view: รัศมีครอบคลุมของ LiDAR (วางมุมบนซ้ายของ side view) ----
function CoverageInset({ m }: { m: SideModel }) {
  if (!m.minimap) return null;
  const o = m.minimap.origin;
  const R = o.radius;
  const pad = R * 0.18 + 12;
  const vb = `${o.x - R - pad} ${o.y - R - pad} ${2 * (R + pad)} ${2 * (R + pad)}`;
  const len = R + pad;
  const far = { x: o.x + m.minimap.dir.x * len, y: o.y + m.minimap.dir.y * len };
  const ch = m.minimap.corridorHalfPx;
  const w1 = { x: o.x + m.minimap.perp.x * ch + m.minimap.dir.x * len, y: o.y + m.minimap.perp.y * ch + m.minimap.dir.y * len };
  const w2 = { x: o.x - m.minimap.perp.x * ch + m.minimap.dir.x * len, y: o.y - m.minimap.perp.y * ch + m.minimap.dir.y * len };
  // ระยะที่ "เห็นจริง" บนพื้น (จำกัดด้วยความสูง/มุม) — วงในจางบอกขอบเขตเชิงเรขาคณิต
  const farM = isFinite(m.sim.farGround) ? m.sim.farGround : m.range;
  const effR = Math.min(R, farM / m.metersPerPx);
  return (
    <div className="absolute top-2 left-2 z-10 rounded-lg border border-white/15 bg-[#0d1726]/90 backdrop-blur p-1.5" style={{ width: 150 }}>
      <div className="text-[9px] text-slate-300 mb-0.5 px-0.5 flex items-center justify-between">
        <span>มุมมองบน · รัศมี</span><span className="font-mono text-sky-300">{(R * m.metersPerPx).toFixed(0)}m</span>
      </div>
      <svg viewBox={vb} width="100%" style={{ aspectRatio: "1 / 1", display: "block" }}>
        {/* รัศมีครอบคลุม (จาง) */}
        <circle cx={o.x} cy={o.y} r={R} fill="rgba(56,189,248,0.10)" stroke="#38bdf8" strokeOpacity={0.5} strokeWidth={R * 0.012} strokeDasharray={`${R * 0.04} ${R * 0.03}`} />
        {/* ขอบเขตที่เห็นจริงตามความสูง/มุม */}
        <circle cx={o.x} cy={o.y} r={effR} fill="rgba(34,197,94,0.10)" stroke="#22c55e" strokeOpacity={0.6} strokeWidth={R * 0.012} />
        {/* แนวตัด azimuth */}
        <polygon points={`${o.x},${o.y} ${w1.x},${w1.y} ${w2.x},${w2.y}`} fill="rgba(253,224,71,0.12)" />
        <line x1={o.x} y1={o.y} x2={far.x} y2={far.y} stroke="#fde68a" strokeWidth={R * 0.016} strokeDasharray={`${R * 0.05} ${R * 0.035}`} />
        {/* ช่องจอด */}
        {m.minimap.spots.map((sp) => (
          <circle key={sp.id} cx={sp.x} cy={sp.y} r={R * 0.03 + 2} fill={sp.in ? (sp.occ ? "#ef4444" : "#22c55e") : "#1e2f49"} stroke={sp.in ? "#fff" : "#33507d"} strokeWidth={sp.in ? R * 0.01 : 0} />
        ))}
        {/* เสา/ต้นไม้ */}
        {m.minimap.obstacles.map((ob, i) => (<rect key={i} x={ob.x - R * 0.025} y={ob.y - R * 0.025} width={R * 0.05} height={R * 0.05} fill={ob.in ? "#f59e0b" : "#3f3a2a"} />))}
        {/* sensor */}
        <circle cx={o.x} cy={o.y} r={R * 0.04 + 3} fill="#0ea5e9" stroke="#bae6fd" strokeWidth={R * 0.014} />
      </svg>
      <div className="text-[8px] text-slate-400 mt-0.5 px-0.5 leading-tight">
        <span className="text-sky-300">━━</span> รัศมีรุ่น · <span className="text-emerald-300">━━</span> เห็นจริง {(effR * m.metersPerPx).toFixed(0)}m
      </div>
    </div>
  );
}

export function SideViewCanvas({ model: m }: { model: SideModel }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<null | "height" | "tilt">(null);

  const Xmax = m.range + 6;
  const maxItemH = Math.max(2, ...m.items.map((it) => it.h));
  const maxY = Math.max(m.height, maxItemH) + 2;
  const plotW = VB_W - M_L - M_R;
  const usableH = GROUND_Y - M_T;
  const ppm = Math.min(plotW / Xmax, usableH / maxY);
  const sx = (wx: number) => M_L + wx * ppm;
  const sy = (wy: number) => GROUND_Y - wy * ppm;
  const sensor = { x: sx(0), y: sy(m.height) };

  const toWorld = (cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    const vx = ((cx - r.left) / r.width) * VB_W;
    const vy = ((cy - r.top) / r.height) * VB_H;
    return { x: (vx - M_L) / ppm, y: (GROUND_Y - vy) / ppm };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const w = toWorld(e.clientX, e.clientY);
    if (dragRef.current === "height") m.setHeight(Math.min(9, Math.max(2, parseFloat(w.y.toFixed(2)))));
    else m.setTilt(Math.min(45, Math.max(0, Math.round(Math.atan2(m.height - w.y, Math.max(w.x, 0.2)) / D2R))));
  };
  const startDrag = (k: "height" | "tilt") => (e: React.PointerEvent) => { e.stopPropagation(); dragRef.current = k; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const endDrag = (e: React.PointerEvent) => { dragRef.current = null; (e.target as Element).releasePointerCapture?.(e.pointerId); };

  const beamPath = `M ${sensor.x.toFixed(1)} ${sensor.y.toFixed(1)} ` + m.sim.endpoints.map((p) => `L ${sx(p.x).toFixed(1)} ${sy(Math.max(p.y, 0)).toFixed(1)}`).join(" ") + " Z";
  const edge = (a: number) => {
    const dx = Math.cos(a), dy = -Math.sin(a);
    let t = m.range;
    if (dy < -1e-6) { const tg = m.height / Math.sin(a); if (tg > 0 && tg < t) t = tg; }
    return { x: dx * t, y: Math.max(m.height + dy * t, 0) };
  };
  const eTop = edge(m.sim.aTop);
  const eBot = edge(m.sim.aBot);
  const ca = m.tilt * D2R;
  const tiltDist = Math.min(m.range * 0.45, isFinite(m.sim.nearGround) ? (m.sim.nearGround + (isFinite(m.sim.farGround) ? m.sim.farGround : m.range)) / 2 : m.range * 0.45);
  const tiltKnob = { x: Math.cos(ca) * tiltDist, y: Math.max(m.height - Math.sin(ca) * tiltDist, 0) };

  const xTicks: number[] = [];
  for (let mm = 0; mm <= Xmax; mm += 5) xTicks.push(mm);
  const yTicks: number[] = [];
  for (let mm = 0; mm <= maxY; mm += 2) yTicks.push(mm);

  return (
    <div>
      <div className="relative">
      {m.minimap && <CoverageInset m={m} />}
      <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full block touch-none select-none" style={{ maxHeight: "60vh" }} onPointerMove={onMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0e1c30" /><stop offset="100%" stopColor={SKY} /></linearGradient>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={BEAM} stopOpacity="0.42" /><stop offset="100%" stopColor={BEAM} stopOpacity="0.06" /></linearGradient>
        </defs>
        <rect x={0} y={0} width={VB_W} height={VB_H} fill="url(#skyGrad)" />

        {yTicks.map((mm) => (<g key={`y${mm}`}><line x1={M_L} y1={sy(mm)} x2={VB_W - M_R} y2={sy(mm)} stroke="#1e3354" strokeWidth={1} /><text x={M_L - 8} y={sy(mm) + 4} textAnchor="end" fontSize={11} fill="#64748b">{mm}</text></g>))}
        <text x={16} y={sy(maxY / 2)} fontSize={11} fill="#64748b" transform={`rotate(-90 16 ${sy(maxY / 2)})`} textAnchor="middle">ความสูง (m)</text>

        <rect x={M_L} y={GROUND_Y} width={plotW} height={VB_H - GROUND_Y} fill="#0c1830" />
        <line x1={M_L} y1={GROUND_Y} x2={VB_W - M_R} y2={GROUND_Y} stroke="#33507d" strokeWidth={2} />
        {xTicks.map((mm) => (<g key={`x${mm}`}><line x1={sx(mm)} y1={GROUND_Y} x2={sx(mm)} y2={GROUND_Y + 5} stroke="#33507d" strokeWidth={1} /><text x={sx(mm)} y={GROUND_Y + 18} textAnchor="middle" fontSize={11} fill="#64748b">{mm}</text></g>))}
        <text x={VB_W - M_R} y={GROUND_Y + 18} textAnchor="end" fontSize={11} fill="#64748b">ระยะจากเสา (m)</text>

        <path d={beamPath} fill="url(#beamGrad)" stroke="none" />
        <line x1={sensor.x} y1={sensor.y} x2={sx(eTop.x)} y2={sy(eTop.y)} stroke={BEAM} strokeWidth={1.3} strokeDasharray="5 4" opacity={0.8} />
        <line x1={sensor.x} y1={sensor.y} x2={sx(eBot.x)} y2={sy(eBot.y)} stroke={BEAM} strokeWidth={1.3} strokeDasharray="5 4" opacity={0.8} />

        {m.litSegments.map((s, i) => (<line key={`lit${i}`} x1={sx(s.x1)} y1={GROUND_Y - 1} x2={sx(s.x2)} y2={GROUND_Y - 1} stroke={GREEN} strokeWidth={4} strokeLinecap="round" opacity={0.9} />))}

        {/* items */}
        {m.items.map((it, idx) => {
          const x = sx(it.x0);
          const w = (it.x1 - it.x0) * ppm;
          if (it.kind === "pillar") {
            return (
              <g key={it.key}>
                <rect x={x} y={sy(it.h)} width={w} height={it.h * ppm} rx={1} fill="#3f3a2a" stroke={AMBER} strokeWidth={1.6} />
                <text x={x + w / 2} y={sy(it.h) - 5} textAnchor="middle" fontSize={10} fill={AMBER}>{it.label} {it.h.toFixed(1)}m</text>
              </g>
            );
          }
          const info = m.itemInfo[idx];
          const col = STATUS_COLOR[info.status];
          const blind = info.status === "blind";
          const yTop = sy(it.h);
          const hPx = it.h * ppm;
          return (
            <g key={it.key} style={{ cursor: "pointer" }} onClick={() => m.toggleItem(idx)}>
              <rect x={x} y={GROUND_Y - 5} width={w} height={5} fill={col} fillOpacity={0.3} stroke={col} strokeWidth={1.2} strokeDasharray={blind ? "3 3" : undefined} />
              {it.occupied ? (
                <g className="car-enter">
                  <rect x={x} y={yTop} width={w} height={hPx} rx={3} fill={info.status === "full" ? "#311a1a" : "#26303f"} stroke={col} strokeWidth={1.8} strokeDasharray={blind ? "4 3" : undefined} />
                  <rect x={x + w * 0.22} y={yTop} width={w * 0.5} height={hPx * 0.42} rx={2} fill={info.status === "full" ? "#5a2530" : "#374151"} />
                  <text x={x + w / 2} y={yTop - 14} textAnchor="middle" fontSize={9.5} fill={col} fontWeight="bold">{STATUS_LABEL[info.status]}</text>
                  <text x={x + w / 2} y={yTop - 4} textAnchor="middle" fontSize={8.5} fill="#94a3b8">{it.label} {it.h.toFixed(2)}m</text>
                </g>
              ) : (
                <>
                  <rect x={x} y={GROUND_Y - 14} width={w} height={9} rx={2} fill={col} fillOpacity={blind ? 0.12 : 0.18} stroke={col} strokeWidth={1} strokeDasharray="3 3" />
                  <text x={x + w / 2} y={GROUND_Y - 18} textAnchor="middle" fontSize={9} fill={col} fontWeight="bold">{STATUS_LABEL[info.status]}</text>
                </>
              )}
            </g>
          );
        })}

        {/* tilt knob */}
        <line x1={sensor.x} y1={sensor.y} x2={sx(tiltKnob.x)} y2={sy(tiltKnob.y)} stroke="#fde68a" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        <g style={{ cursor: "grab" }} onPointerDown={startDrag("tilt")}>
          <circle cx={sx(tiltKnob.x)} cy={sy(tiltKnob.y)} r={9} fill="#1d4ed8" stroke="#fde68a" strokeWidth={2} />
          <text x={sx(tiltKnob.x)} y={sy(tiltKnob.y) + 3.5} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="bold">↻</text>
          <text x={sx(tiltKnob.x)} y={sy(tiltKnob.y) - 13} textAnchor="middle" fontSize={9} fill="#fde68a">{m.tilt}°</text>
        </g>

        {/* pole + device (illustration) */}
        <rect x={sensor.x - 3} y={sensor.y} width={6} height={GROUND_Y - sensor.y} fill="#475569" rx={2} />
        <g style={{ cursor: "ns-resize" }} onPointerDown={startDrag("height")}>
          <foreignObject x={sensor.x - 16} y={sensor.y - 24} width={32} height={32}>
            {/* illustration ตัวเครื่อง */}
            <div style={{ width: 32, height: 32 }}><LidarIllustration model={m.model} size={32} /></div>
          </foreignObject>
          <rect x={sensor.x - 16} y={sensor.y - 24} width={32} height={32} fill="transparent" />
        </g>
        <text x={sensor.x} y={sensor.y - 28} textAnchor="middle" fontSize={11} fill="#7dd3fc" fontWeight="bold">{m.model.brand} {m.height.toFixed(1)}m</text>

        {isFinite(m.sim.nearGround) && m.sim.nearGround < Xmax && (<g><line x1={sx(m.sim.nearGround)} y1={GROUND_Y} x2={sx(m.sim.nearGround)} y2={GROUND_Y - 16} stroke={BEAM} strokeWidth={1} /><text x={sx(m.sim.nearGround)} y={GROUND_Y - 20} textAnchor="middle" fontSize={9} fill="#7dd3fc">ใกล้สุด {m.sim.nearGround.toFixed(1)}m</text></g>)}
        {isFinite(m.sim.farGround) && m.sim.farGround < Xmax && (<g><line x1={sx(m.sim.farGround)} y1={GROUND_Y} x2={sx(m.sim.farGround)} y2={GROUND_Y - 16} stroke={BEAM} strokeWidth={1} /><text x={sx(m.sim.farGround)} y={GROUND_Y - 20} textAnchor="middle" fontSize={9} fill="#7dd3fc">ไกลสุด {m.sim.farGround.toFixed(1)}m</text></g>)}
      </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-slate-300 border-t border-white/10 bg-[#0d1726]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(56,189,248,0.4)" }} /> ลำแสง</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 h-1 rounded" style={{ background: GREEN }} /> พื้นที่ส่องถึง</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(34,197,94,0.3)", border: `1px solid ${GREEN}` }} /> ว่าง</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.3)", border: `1px solid ${RED}` }} /> เต็ม</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ border: `1px dashed ${GRAY}` }} /> จุดบอด</span>
        <span className="ml-auto text-slate-500">{m.effSource === "layout" ? "ตัดจากผังจริง · หมุน azimuth ในแถบขวาเพื่อดูทิศอื่น" : "ลาก ↕ ปรับสูง · ลาก ↻ ปรับองศา · คลิกช่องเพื่อรถเข้า-ออก"}</span>
      </div>
    </div>
  );
}

// =================================================================
// minimap (top-view ย่อ)
// =================================================================
function MiniMap({ m }: { m: SideModel }) {
  if (!m.minimap) return null;
  const W = m.layoutW;
  const H = m.layoutH;
  const o = m.minimap.origin;
  const len = Math.max(W, H);
  const far = { x: o.x + m.minimap.dir.x * len, y: o.y + m.minimap.dir.y * len };
  const ch = m.minimap.corridorHalfPx;
  const p1 = { x: o.x + m.minimap.perp.x * ch, y: o.y + m.minimap.perp.y * ch };
  const p2 = { x: o.x - m.minimap.perp.x * ch, y: o.y - m.minimap.perp.y * ch };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border border-white/10 bg-[#0a1322]" style={{ maxHeight: 150 }}>
      <polygon points={`${o.x},${o.y} ${p1.x + m.minimap.dir.x * len},${p1.y + m.minimap.dir.y * len} ${p2.x + m.minimap.dir.x * len},${p2.y + m.minimap.dir.y * len}`} fill="rgba(56,189,248,0.12)" />
      {m.minimap.spots.map((s) => (
        <circle key={s.id} cx={s.x} cy={s.y} r={Math.max(4, W / 90)} fill={s.in ? (s.occ ? RED : GREEN) : "#1e2f49"} stroke={s.in ? "#fff" : "#33507d"} strokeWidth={s.in ? 1.5 : 0.8} />
      ))}
      {m.minimap.obstacles.map((ob, i) => (<rect key={i} x={ob.x - 4} y={ob.y - 4} width={8} height={8} fill={ob.in ? AMBER : "#3f3a2a"} />))}
      <line x1={o.x} y1={o.y} x2={far.x} y2={far.y} stroke="#fde68a" strokeWidth={2} strokeDasharray="6 4" />
      <circle cx={o.x} cy={o.y} r={Math.max(5, W / 70)} fill="#0ea5e9" stroke="#bae6fd" strokeWidth={2} />
    </svg>
  );
}

// =================================================================
// PANEL
// =================================================================
function PanelSlider({ label, val, unit, min, max, step, onChange }: { label: string; val: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void; }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-300">{label}</span>
        <span className="text-[11px] font-mono text-sky-300">{val.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-sky-400 h-1.5" />
    </label>
  );
}

export function SideViewPanel({ model: m }: { model: SideModel }) {
  return (
    <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-4">
      {/* โหมดฉาก */}
      {m.hasLayout && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">แหล่งฉาก</div>
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-[11px]">
            <button onClick={() => m.setSceneSource("layout")} className={`flex-1 py-1.5 font-semibold ${m.effSource === "layout" ? "bg-sky-500 text-white" : "bg-[#13243c] text-slate-300"}`}>จากผัง top view</button>
            <button onClick={() => m.setSceneSource("manual")} className={`flex-1 py-1.5 font-semibold ${m.effSource === "manual" ? "bg-sky-500 text-white" : "bg-[#13243c] text-slate-300"}`}>ตั้งเอง</button>
          </div>
          {m.effSource === "layout" && (
            <>
              <MiniMap m={m} />
              <PanelSlider label="หมุนทิศสแกน (azimuth)" val={m.azimuth} unit="°" min={-180} max={180} step={1} onChange={m.setAzimuth} />
              <div className="text-[10px] text-slate-500 -mt-1">เส้นเหลือง = ทิศที่กำลังตัดดู · จุดวงกลม = ช่องจอด (สว่าง=อยู่ในแนวตัด)</div>
            </>
          )}
        </div>
      )}

      {/* สรุปสถานะ */}
      <div className="rounded-lg bg-[#0a1322] border border-white/10 p-2.5">
        <div className="text-[11px] text-slate-400 mb-1.5">สถานะที่ LiDAR อ่านได้ในแนวตัดนี้</div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-md py-1" style={{ background: "rgba(34,197,94,0.15)" }}><div className="text-base font-bold text-emerald-300">{m.cFree}</div><div className="text-[9px] text-emerald-200/80">ว่าง</div></div>
          <div className="rounded-md py-1" style={{ background: "rgba(239,68,68,0.15)" }}><div className="text-base font-bold text-rose-300">{m.cFull}</div><div className="text-[9px] text-rose-200/80">เต็ม</div></div>
          <div className="rounded-md py-1" style={{ background: "rgba(100,116,139,0.18)" }}><div className="text-base font-bold text-slate-300">{m.cBlind}</div><div className="text-[9px] text-slate-400">จุดบอด</div></div>
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5">โซนพื้นที่เห็น: {isFinite(m.sim.nearGround) ? m.sim.nearGround.toFixed(1) : "0"}–{isFinite(m.sim.farGround) ? Math.min(m.sim.farGround, m.range).toFixed(1) : m.range.toFixed(0)} m</div>
      </div>

      {/* รุ่น LiDAR */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wide">ยี่ห้อ / รุ่น LiDAR</div>
        <select value={m.modelId} onChange={(e) => m.setModelId(e.target.value)} className="w-full bg-[#13243c] border border-white/10 rounded-md text-xs px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-sky-400">
          {LIDAR_MODELS.map((md) => (<option key={md.id} value={md.id}>{md.brand} {md.model} — {md.tier}</option>))}
        </select>
        <div className="rounded-lg bg-[#0a1322] border border-white/10 p-2.5 flex gap-3">
          <div className="shrink-0 rounded-md bg-[#0e1c30] p-1 grid place-items-center"><LidarVisual model={m.model} size={56} /></div>
          <div className="text-[10.5px] text-slate-300 grid grid-cols-2 gap-x-2 gap-y-0.5 flex-1">
            <div>ระยะสูงสุด: <span className="text-sky-300 font-mono">{m.model.maxRange}m</span></div>
            <div>vFOV: <span className="text-sky-300 font-mono">{m.model.vfov}°</span></div>
            <div>ชั้น: <span className="text-sky-300 font-mono">{m.model.channels || "—"}</span></div>
            <div>จุด/วิ: <span className="text-sky-300 font-mono">{(m.model.ptsPerSec / 1000).toFixed(0)}k</span></div>
            <div className="col-span-2 text-slate-400 leading-snug mt-0.5">{m.model.note}</div>
          </div>
        </div>
      </div>

      {/* LiDAR params */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wide">ค่า LiDAR (ตามขีดจำกัดรุ่น)</div>
        <PanelSlider label="ความสูงเสา" val={m.height} unit=" m" min={2} max={Math.max(9, m.model.recMount[1] + 2)} step={0.1} onChange={m.setHeight} />
        <PanelSlider label="องศาก้ม (tilt)" val={m.tilt} unit="°" min={0} max={45} step={1} onChange={m.setTilt} />
        <div><PanelSlider label="มุมเปิดแนวตั้ง (FOV)" val={m.vfov} unit="°" min={8} max={m.model.vfov} step={1} onChange={m.setVfovClamped} /><div className="text-[9.5px] text-slate-500 -mt-1">เพดานรุ่น: {m.model.vfov}°</div></div>
        <div><PanelSlider label="ระยะตรวจจับ" val={m.range} unit=" m" min={Math.max(10, Math.ceil(m.model.minRange))} max={m.model.maxRange} step={1} onChange={m.setRangeClamped} /><div className="text-[9.5px] text-slate-500 -mt-1">เพดานรุ่น: {m.model.maxRange}m</div></div>
        <PanelSlider label="สเกลความสูงรถ (×)" val={m.scale} unit="×" min={0.8} max={1.3} step={0.05} onChange={m.setScale} />
      </div>

      {/* ตั้งเอง: ตัวควบคุมฉาก */}
      {m.effSource === "manual" && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">ฉาก (ตั้งเอง)</div>
          <PanelSlider label="ระยะห่างช่อง" val={m.spacing} unit=" m" min={4.6} max={10} step={0.1} onChange={m.setSpacing} />
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer"><input type="checkbox" checked={m.pillarOn} onChange={(e) => m.setPillarOn(e.target.checked)} className="accent-amber-400" /> มีเสา/สิ่งกีดขวาง</label>
          {m.pillarOn && <PanelSlider label="ความสูงเสา" val={m.pillarH} unit=" m" min={1.5} max={6} step={0.1} onChange={m.setPillarH} />}
        </div>
      )}

      {/* รายการช่องในแนวตัด */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">ช่องในแนวตัด ({m.carItems.length})</div>
          <div className="flex gap-1">
            <button onClick={m.driveIn} className="text-[11px] px-2 py-1 rounded-md font-semibold border bg-emerald-500/20 border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30">+รถเข้า</button>
            <button onClick={m.driveOut} className="text-[11px] px-2 py-1 rounded-md font-semibold border bg-rose-500/20 border-rose-400/40 text-rose-100 hover:bg-rose-500/30">−รถออก</button>
            {m.effSource === "manual" && <button onClick={m.reroll} className="text-[11px] px-2 py-1 rounded-md bg-[#13243c] border border-white/10 text-slate-200 hover:bg-[#1a2f4d]">🎲</button>}
          </div>
        </div>
        <div className="space-y-1.5">
          {m.carItems.map(({ it, i }, n) => {
            const info = m.itemInfo[i];
            const col = STATUS_COLOR[info.status];
            return (
              <div key={it.key} className="rounded-md bg-[#0a1322] border border-white/10 p-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-200 w-14">ช่อง {n + 1}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${col}22`, color: col, border: `1px solid ${col}` }}>{STATUS_LABEL[info.status]}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{((it.x0 + it.x1) / 2).toFixed(1)}m</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => m.toggleItem(i)} className={`text-[10px] px-2 py-0.5 rounded border ${it.occupied ? "bg-rose-500/15 border-rose-400/40 text-rose-200" : "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"}`}>{it.occupied ? "นำรถออก" : "นำรถเข้า"}</button>
                    {m.effSource === "manual" && it.slotIndex != null && <button onClick={() => m.removeSlot(it.slotIndex!)} className="text-[10px] w-5 h-5 grid place-items-center rounded border border-white/10 text-slate-400 hover:bg-rose-500/20 hover:text-rose-200">✕</button>}
                  </div>
                </div>
                {it.occupied && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <select value={it.typeIdx} onChange={(e) => m.setItemType(i, parseInt(e.target.value))} className="bg-[#13243c] border border-white/10 rounded text-[10px] px-1 py-0.5 text-slate-200">
                      {CAR_TYPES.map((c, ci) => (<option key={ci} value={ci}>{c.label}</option>))}
                    </select>
                    <input type="range" min={1.2} max={2.4} step={0.05} value={it.baseH} onChange={(e) => m.setItemHeight(i, parseFloat(e.target.value))} className="flex-1 accent-sky-400 h-1.5" />
                    <span className="text-[10px] font-mono text-sky-300 w-12 text-right">{it.baseH.toFixed(2)}m</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {m.effSource === "manual" && <button onClick={m.addSlot} className="w-full text-[11px] py-1.5 rounded-md border border-dashed border-sky-400/40 text-sky-200 hover:bg-sky-500/10">+ เพิ่มช่องจอด</button>}
      </div>

      {/* คำแนะนำ */}
      <div className="rounded-lg bg-[#0a1322] border border-white/10 p-2.5">
        <div className="text-[11px] font-semibold text-sky-300 mb-1">คำแนะนำ</div>
        <ul className="space-y-1">{m.recs.map((r, i) => (<li key={i} className="text-[10.5px] text-slate-300 leading-snug">• {r}</li>))}</ul>
      </div>

      <a href="/logic" className="block text-center text-[11px] py-2 rounded-md border border-sky-400/40 text-sky-200 hover:bg-sky-500/10 font-semibold">📋 ดูหน้า Logic & ขีดจำกัดเครื่องมือ →</a>
    </div>
  );
}

export default function SideView() {
  const model = useSideView();
  return (<div><SideViewCanvas model={model} /><SideViewPanel model={model} /></div>);
}
