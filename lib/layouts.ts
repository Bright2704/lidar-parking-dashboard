import { Layout, Obstacle, Sensor, Spot } from "./types";

// Deterministic PRNG (mulberry32) so server-render and client-render produce
// IDENTICAL initial occupancy -> no React hydration mismatch.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SW = 40; // vertical stall width
const SH = 62; // vertical stall height

// A horizontal run of vertical stalls (cars nose in from top/bottom).
function rowV(
  prefix: string,
  x0: number,
  y: number,
  n: number,
  dx: number,
  rng: () => number,
  occ = 0.42
): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `${prefix}-${i + 1}`,
      x: x0 + i * dx,
      y,
      w: SW,
      h: SH,
      vertical: true,
      occupied: rng() < occ,
    });
  }
  return out;
}

// A vertical run of horizontal stalls (cars nose in from the side).
function colH(
  prefix: string,
  x: number,
  y0: number,
  n: number,
  dy: number,
  rng: () => number,
  occ = 0.42
): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `${prefix}-${i + 1}`,
      x,
      y: y0 + i * dy,
      w: SH,
      h: SW,
      vertical: false,
      occupied: rng() < occ,
    });
  }
  return out;
}

function sensor(
  id: string,
  name: string,
  x: number,
  y: number,
  radius: number,
  i: number
): Sensor {
  return {
    id,
    name,
    code: `S0G${(2 + i).toString().padStart(2, "0")}C0${i}A0C0${i}P1`,
    x,
    y,
    radius,
    temp: 26 + ((i * 3) % 6),
  };
}

// ---------- Layout 1: ลานกลางแจ้ง · แถวคู่ ----------
function outdoorDouble(): Layout {
  const rng = makeRng(101);
  const spots = [
    ...rowV("A", 90, 70, 20, 42, rng, 0.4),
    ...rowV("B", 90, 372, 20, 42, rng, 0.5),
  ];
  return {
    id: "outdoor-double",
    name: "ลานกลางแจ้ง · แถวคู่ (24 ช่อง)",
    description:
      "สองแถวหันเข้าหาเลนกลาง · LiDAR 1 ตัว overhead ตรงกลางครอบคลุมได้เกือบทั้งลาน — ลองลากเพื่อหาตำแหน่งที่คุ้มที่สุด",
    kind: "outdoor",
    width: 1000,
    height: 520,
    spots,
    sensors: [sensor("L1", "Plaza A-Center", 470, 250, 215, 1)],
    lanes: [{ x: 70, y: 150, w: 880, h: 210 }],
    // ต้นไม้ในเกาะกลาง — บัง LiDAR ทำให้ช่องจอดด้านหลังต้นไม้กลายเป็นจุดบอด
    obstacles: [
      { x: 450, y: 150, w: 44, h: 44, kind: "tree" },
      { x: 250, y: 300, w: 40, h: 40, kind: "tree" },
      { x: 660, y: 300, w: 40, h: 40, kind: "tree" },
    ],
  };
}

// ---------- Layout 2: ลานในอาคาร · 3 เกาะจอด ----------
function indoorIslands(): Layout {
  const rng = makeRng(202);
  const bases = [90, 410, 730];
  const spots: Spot[] = [];
  bases.forEach((bx, idx) => {
    const p = String.fromCharCode(67 + idx); // C, D, E
    spots.push(...rowV(`${p}t`, bx, 120, 6, 42, rng, 0.45));
    spots.push(...rowV(`${p}b`, bx, 300, 6, 42, rng, 0.45));
  });
  return {
    id: "indoor-islands",
    name: "ลานในอาคาร · 3 เกาะจอด (30 ช่อง)",
    description:
      "เกาะจอดแบบหลังชนหลัง 3 เกาะ · ใช้ LiDAR 1 ตัว/เกาะ — เห็นได้ชัดว่าเสาอาคารและระยะห่างมีผลต่อพื้นที่ตรวจจับ",
    kind: "indoor",
    width: 1040,
    height: 520,
    spots,
    sensors: [
      sensor("L1", "Indoor-Island-1", 215, 240, 150, 1),
      sensor("L2", "Indoor-Island-2", 535, 240, 150, 2),
      sensor("L3", "Indoor-Island-3", 855, 240, 150, 3),
    ],
    lanes: [
      { x: 70, y: 196, w: 920, h: 96 },
    ],
    obstacles: [
      { x: 360, y: 150, w: 26, h: 240, kind: "pillar", label: "เสา" },
      { x: 680, y: 150, w: 26, h: 240, kind: "pillar", label: "เสา" },
      // เสาเล็กในแต่ละเกาะ — วางเยื้องจากเซนเซอร์ เพื่อให้เกิดเงาตรวจจับด้านหลังเสา
      { x: 250, y: 200, w: 20, h: 20, kind: "pillar", label: "เสา" },
      { x: 590, y: 200, w: 20, h: 20, kind: "pillar", label: "เสา" },
      { x: 890, y: 200, w: 20, h: 20, kind: "pillar", label: "เสา" },
    ],
  };
}

// ---------- Layout 3: ลานรูปตัว L ----------
function lShape(): Layout {
  const rng = makeRng(303);
  const spots = [
    ...rowV("T", 120, 70, 18, 42, rng, 0.4),
    ...colH("L", 80, 210, 7, 42, rng, 0.5),
  ];
  return {
    id: "l-shape",
    name: "ลานรูปตัว L (16 ช่อง)",
    description:
      "ทางเข้ามุมตึก · ต้องใช้ LiDAR 2 ตัวคุมแขนแนวนอนและแนวตั้ง — จุดมุมคือจุดที่ตรวจจับยากที่สุด",
    kind: "mixed",
    width: 1000,
    height: 560,
    spots,
    sensors: [
      sensor("L1", "Corner-Top", 430, 160, 180, 1),
      sensor("L2", "Corner-Side", 250, 360, 160, 2),
    ],
    lanes: [
      { x: 100, y: 150, w: 860, h: 50 },
      { x: 175, y: 200, w: 60, h: 330 },
    ],
    obstacles: [],
  };
}

// ---------- Layout 4: ลานใหญ่ · 4 แถว ----------
function gridLarge(): Layout {
  const rng = makeRng(404);
  const ys = [60, 200, 340, 480];
  const spots: Spot[] = [];
  ys.forEach((y, i) =>
    spots.push(...rowV(`G${i + 1}`, 80, y, 21, 42, rng, 0.45))
  );
  return {
    id: "grid-large",
    name: "ลานใหญ่ · 4 แถว (52 ช่อง)",
    description:
      "ลานขนาดใหญ่กับ LiDAR เพียง 2 ตัว — ออกแบบมาให้เห็น “จุดบอด” (ช่องสีเทา) ชัดเจน ลองเพิ่ม/ขยับเซนเซอร์เพื่อปิดจุดบอด",
    kind: "outdoor",
    width: 1020,
    height: 600,
    spots,
    sensors: [
      sensor("L1", "Field-West", 300, 270, 185, 1),
      sensor("L2", "Field-East", 720, 270, 185, 2),
    ],
    lanes: [
      { x: 60, y: 138, w: 900, h: 56 },
      { x: 60, y: 278, w: 900, h: 56 },
      { x: 60, y: 418, w: 900, h: 56 },
    ],
    obstacles: [],
  };
}

// ---------- Layout 5: ลานกลางแจ้ง · เปิดโล่ง 4 แถว ----------
function outdoorOpen(): Layout {
  const rng = makeRng(505);
  const spots = [
    ...rowV("N", 100, 60, 20, 42, rng, 0.4), // แถวบนสุด
    ...rowV("C", 100, 300, 20, 42, rng, 0.45), // กลาง-บน (หลังชนหลัง)
    ...rowV("S", 100, 364, 20, 42, rng, 0.45), // กลาง-ล่าง
    ...rowV("B", 100, 520, 20, 42, rng, 0.4), // แถวล่างสุด
  ];
  return {
    id: "outdoor-open",
    name: "ลานกลางแจ้ง · เปิดโล่ง 4 แถว (48 ช่อง)",
    description:
      "ลานกลางแจ้งเปิดโล่งขนาดใหญ่ 4 แถว มีเลนขับ 2 เลน · วาง LiDAR 3 ตัว — ลองขยับเพื่อปิดจุดบอดที่มุมและขอบลานให้ได้มากที่สุด",
    kind: "outdoor",
    width: 1000,
    height: 620,
    spots,
    sensors: [
      sensor("L1", "Open-West", 250, 300, 235, 1),
      sensor("L2", "Open-East", 760, 300, 235, 2),
      sensor("L3", "Open-South", 505, 470, 210, 3),
    ],
    lanes: [
      { x: 80, y: 132, w: 860, h: 158 },
      { x: 80, y: 436, w: 860, h: 76 },
    ],
    // ต้นไม้ริมลานและเกาะกลาง — บัง LiDAR เกิดเงาตรวจจับ ลองขยับเซนเซอร์หลบ
    obstacles: [
      { x: 228, y: 188, w: 46, h: 46, kind: "tree" },
      { x: 738, y: 188, w: 46, h: 46, kind: "tree" },
      { x: 484, y: 250, w: 42, h: 42, kind: "tree" },
      { x: 484, y: 484, w: 40, h: 40, kind: "tree" },
    ],
  };
}

// ---------- Layout 6: โรงจอดรถในอาคาร · จอดถี่ (ช่องชิดกันมาก) ----------
function garageDense(): Layout {
  const rng = makeRng(606);
  const dx = 40; // ช่องจอดติดกันสนิท (กว้าง 40 → ไม่มีช่องว่าง) เหมือนโรงจอดจริง
  const n = 20;
  const x0 = 80;
  // 3 คู่แถวแบบหลังชนหลัง คั่นด้วยเลนขับ 2 เลน
  const rowYs = [54, 118, 248, 312, 442, 506];
  const spots: Spot[] = [];
  rowYs.forEach((y, i) => spots.push(...rowV(`R${i + 1}`, x0, y, n, dx, rng, 0.5)));

  // เสาโครงสร้างถี่ ที่รอยต่อแถวหลังชนหลัง ทุก ๆ 4 ช่อง
  const obstacles: Obstacle[] = [];
  const seamYs = [104, 298, 492];
  for (const sy of seamYs) {
    for (let k = 2; k < n; k += 4) {
      obstacles.push({
        x: x0 + k * dx + dx / 2 - 8,
        y: sy,
        w: 16,
        h: 20,
        kind: "pillar",
        label: "เสา",
      });
    }
  }

  return {
    id: "garage-dense",
    name: "โรงจอดรถในอาคาร · จอดถี่ (120 ช่อง)",
    description:
      "โรงจอดหลายชั้นจริง: ช่องจอดชิดกันมาก แถวหลังชนหลัง และมีเสาโครงสร้างถี่ — ต้องวาง LiDAR หลายตัวและระวังเงาเสาบดบังช่องจอด",
    kind: "indoor",
    width: 1040,
    height: 600,
    spots,
    sensors: [
      sensor("L1", "Garage-NW", 280, 214, 165, 1),
      sensor("L2", "Garage-NE", 720, 214, 165, 2),
      sensor("L3", "Garage-SW", 280, 408, 165, 3),
      sensor("L4", "Garage-SE", 720, 408, 165, 4),
    ],
    lanes: [
      { x: 70, y: 184, w: 900, h: 60 },
      { x: 70, y: 378, w: 900, h: 60 },
    ],
    obstacles,
  };
}

export const LAYOUTS: Layout[] = [
  outdoorDouble(),
  outdoorOpen(),
  indoorIslands(),
  garageDense(),
  lShape(),
  gridLarge(),
];

// Fresh deep copy so editing one session never mutates the source layout.
export function cloneLayout(layout: Layout): {
  spots: Spot[];
  sensors: Sensor[];
  obstacles: Obstacle[];
} {
  return {
    spots: layout.spots.map((s) => ({ ...s, enteredAt: undefined })),
    sensors: layout.sensors.map((s) => ({ ...s })),
    obstacles: layout.obstacles.map((o, i) => ({
      ...o,
      id: o.id ?? `${layout.id}-obs-${i}`,
    })),
  };
}
