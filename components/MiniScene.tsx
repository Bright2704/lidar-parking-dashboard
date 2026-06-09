"use client";

/**
 * MiniScene — ไดอะแกรมภาพตัดด้านข้างขนาดเล็กที่ "ยิงรังสีจริง" (ray-casting)
 * ใช้ในหน้า Logic เพื่อให้เห็นภาพว่า LiDAR เห็น/ไม่เห็นอย่างไร แสดงจุด (point cloud)
 * ที่ลำแสงตกถึง เงา/จุดบอด และป้ายผล เห็น ✓ / มองไม่เห็น ✗
 */

const BEAM = "#38bdf8";
const GREEN = "#22c55e";
const RED = "#ef4444";
const AMBER = "#f59e0b";
const D2R = Math.PI / 180;

export type MObj = { x: number; h: number; kind?: "car" | "pillar"; target?: boolean; label?: string };
export type MZone = { x0: number; x1: number; label?: string };

type Rect = { x0: number; x1: number; h: number; i: number };

function rayRect(oy: number, dx: number, dy: number, r: Rect): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (0 < r.x0 || 0 > r.x1) return null;
  } else {
    let ta = r.x0 / dx;
    let tb = r.x1 / dx;
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

const CAR_W = 4.2;

export function MiniScene({
  H, tilt, fov, range, objs = [], zones = [], grazeIndex, xMax, width = 380, height = 190, dots = true,
}: {
  H: number; tilt: number; fov: number; range: number;
  objs?: MObj[]; zones?: MZone[]; grazeIndex?: number; xMax?: number;
  width?: number; height?: number; dots?: boolean;
}) {
  const objRects: Rect[] = objs.map((o, i) => ({ x0: o.x - (o.kind === "pillar" ? 0.3 : CAR_W / 2), x1: o.x + (o.kind === "pillar" ? 0.3 : CAR_W / 2), h: o.h, i }));

  const aTop = tilt * D2R - (fov * D2R) / 2;
  const aBot = tilt * D2R + (fov * D2R) / 2;
  const N = 150;
  const eps: { x: number; y: number; kind: "ground" | "obj" | "range"; obj: number }[] = [];
  const seen = new Set<number>();
  for (let i = 0; i <= N; i++) {
    const a = aTop + ((aBot - aTop) * i) / N;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    let bt = range;
    let bk: "ground" | "obj" | "range" = "range";
    let bo = -1;
    if (dy < -1e-6) {
      const tg = H / Math.sin(a);
      if (tg > 0 && tg < bt) { bt = tg; bk = "ground"; bo = -1; }
    }
    for (const r of objRects) {
      const t = rayRect(H, dx, dy, r);
      if (t !== null && t < bt) { bt = t; bk = "obj"; bo = r.i; }
    }
    eps.push({ x: dx * bt, y: H + dy * bt, kind: bk, obj: bo });
    if (bk === "obj") seen.add(bo);
  }
  // lit ground segments
  const lit: [number, number][] = [];
  let st: number | null = null, pv: number | null = null;
  for (const p of eps) {
    if (p.kind === "ground") { if (st === null) st = p.x; pv = p.x; }
    else if (st !== null && pv !== null) { lit.push([st, pv]); st = pv = null; }
  }
  if (st !== null && pv !== null) lit.push([st, pv]);
  const groundLit = (x: number) => lit.some(([a, b]) => x >= Math.min(a, b) - 0.3 && x <= Math.max(a, b) + 0.3);

  // ---- scale ----
  const oX = 30, mR = 8, mT = 12;
  const gY = height - 20;
  const XM = xMax ?? range + 3;
  const maxY = Math.max(H, ...objs.map((o) => o.h), 2) + 1.2;
  const plotW = width - oX - mR;
  const ppm = Math.min(plotW / XM, (gY - mT) / maxY);
  const sx = (wx: number) => oX + wx * ppm;
  const sy = (wy: number) => gY - wy * ppm;
  const sExp = { x: sx(0), y: sy(H) };

  const beam = `M ${sExp.x} ${sExp.y} ` + eps.map((p) => `L ${sx(p.x).toFixed(1)} ${sy(Math.max(p.y, 0)).toFixed(1)}`).join(" ") + " Z";

  // grazing ray (เส้นสายตาเฉียดยอดวัตถุ → ขอบเงา)
  let graze: string | null = null;
  if (grazeIndex != null && objs[grazeIndex]) {
    const o = objs[grazeIndex];
    const cx = o.x + CAR_W / 2;
    const slope = (o.h - H) / cx;
    const xG = slope < 0 ? -H / slope : XM;
    graze = `M ${sx(0)} ${sy(H)} L ${sx(xG)} ${sy(0)}`;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="rounded-lg bg-[#0a1322] border border-white/10">
      {/* ground */}
      <line x1={oX} y1={gY} x2={width - mR} y2={gY} stroke="#33507d" strokeWidth={1.5} />
      {Array.from({ length: Math.floor(XM / 5) + 1 }, (_, k) => k * 5).map((mm) => (
        <text key={mm} x={sx(mm)} y={gY + 13} textAnchor="middle" fontSize={8} fill="#475569">{mm}m</text>
      ))}

      {/* beam */}
      <path d={beam} fill={BEAM} fillOpacity={0.1} />
      {/* lit ground */}
      {lit.map(([a, b], i) => (<line key={i} x1={sx(a)} y1={gY - 1} x2={sx(b)} y2={gY - 1} stroke={GREEN} strokeWidth={3} strokeLinecap="round" opacity={0.85} />))}

      {/* graze ray */}
      {graze && <path d={graze} stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="4 3" fill="none" opacity={0.9} />}

      {/* zones (ช่องว่างที่ตรวจ) */}
      {zones.map((z, i) => {
        const s = groundLit((z.x0 + z.x1) / 2);
        const col = s ? GREEN : "#64748b";
        return (
          <g key={`z${i}`}>
            <rect x={sx(z.x0)} y={gY - 9} width={(z.x1 - z.x0) * ppm} height={9} fill={col} fillOpacity={s ? 0.18 : 0.1} stroke={col} strokeWidth={1} strokeDasharray="3 2" />
            <text x={sx((z.x0 + z.x1) / 2)} y={gY - 12} textAnchor="middle" fontSize={8} fill={col} fontWeight="bold">{z.label ?? (s ? "ว่าง" : "จุดบอด")}</text>
          </g>
        );
      })}

      {/* objects */}
      {objs.map((o, i) => {
        const isP = o.kind === "pillar";
        const w = (isP ? 0.6 : CAR_W) * ppm;
        const x = sx(o.x - (isP ? 0.3 : CAR_W / 2));
        const s = seen.has(i);
        const col = isP ? AMBER : s ? GREEN : RED;
        return (
          <g key={`o${i}`}>
            <rect x={x} y={sy(o.h)} width={w} height={o.h * ppm} rx={isP ? 1 : 2} fill={isP ? "#3f3a2a" : s ? "#16331f" : "#311a1a"} stroke={col} strokeWidth={1.4} strokeDasharray={!isP && !s ? "3 2" : undefined} />
            {!isP && (
              <text x={x + w / 2} y={sy(o.h) - 3} textAnchor="middle" fontSize={8} fill={col} fontWeight="bold">{o.target ? (s ? "เห็น ✓" : "มองไม่เห็น ✗") : o.label ?? ""}</text>
            )}
            {isP && <text x={x + w / 2} y={sy(o.h) - 3} textAnchor="middle" fontSize={8} fill={AMBER}>{o.label ?? "เสา"}</text>}
          </g>
        );
      })}

      {/* point-cloud dots */}
      {dots && eps.filter((_, i) => i % 3 === 0).map((p, i) => {
        if (p.kind === "range") return null;
        const c = p.kind === "ground" ? "#34d399" : "#e2e8f0";
        return <circle key={`d${i}`} cx={sx(p.x)} cy={sy(Math.max(p.y, 0))} r={1.4} fill={c} />;
      })}

      {/* pole + sensor */}
      <rect x={sExp.x - 2} y={sExp.y} width={4} height={gY - sExp.y} fill="#475569" rx={1} />
      <rect x={sExp.x - 8} y={sExp.y - 6} width={16} height={11} rx={2} fill="#0ea5e9" stroke="#bae6fd" strokeWidth={1} />
      <text x={sExp.x} y={sExp.y - 9} textAnchor="middle" fontSize={8} fill="#7dd3fc" fontWeight="bold">LiDAR {H}m</text>
    </svg>
  );
}
