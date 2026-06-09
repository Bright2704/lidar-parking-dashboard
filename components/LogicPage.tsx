"use client";

import { useState } from "react";
import {
  LIDAR_MODELS,
  DETECTION,
  getModel,
  groundCoverage,
  pointSpacing,
} from "@/lib/lidarModels";
import { LidarVisual } from "@/components/SideView";

function Slider({ label, val, unit, min, max, step, onChange }: { label: string; val: number; unit: string; min: number; max: number; step: number; onChange: (v: number) => void; }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="text-xs font-mono text-sky-300">{val.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-sky-400" />
    </label>
  );
}

export default function LogicPage() {
  const [modelId, setModelId] = useState(LIDAR_MODELS[0].id);
  const model = getModel(modelId);
  const [H, setH] = useState(4.5);
  const [tilt, setTilt] = useState(12);
  const [fov, setFov] = useState(Math.min(30, model.vfov));
  const [range, setRange] = useState(Math.min(35, model.maxRange));

  const pickModel = (id: string) => {
    const md = getModel(id);
    setModelId(id);
    setFov((v) => Math.min(v, md.vfov));
    setRange((r) => Math.min(Math.max(r, Math.ceil(md.minRange)), md.maxRange));
    setH((h) => Math.max(h, md.recMount[0]));
  };

  const cov = groundCoverage(H, tilt, fov, range);
  const spacingFar = pointSpacing(isFinite(cov.far) ? cov.far : range, fov, model.vLines);
  const spacingOk = spacingFar <= DETECTION.MAX_POINT_SPACING;
  const mountOk = H >= model.recMount[0] && H <= model.recMount[1];
  const coverDepth = isFinite(cov.far) && isFinite(cov.near) ? cov.far - cov.near : Infinity;

  const verdict = spacingOk && mountOk ? "ผ่าน" : spacingOk || mountOk ? "ควรปรับ" : "ไม่เหมาะ";
  const verdictColor = verdict === "ผ่าน" ? "#22c55e" : verdict === "ควรปรับ" ? "#f59e0b" : "#ef4444";

  return (
    <div className="min-h-screen text-slate-200">
      {/* header */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-[#0d1726]/80 backdrop-blur sticky top-0 z-10">
        <a href="/" className="text-xs px-3 py-1.5 rounded-md bg-[#13243c] border border-white/10 text-slate-200 hover:bg-[#1a2f4d]">← กลับแดชบอร์ด</a>
        <div className="font-bold text-sm text-white">Logic การตรวจจับ & ขีดจำกัดเครื่องมือ LiDAR</div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-6">
        {/* 1. รู้ได้ยังไงว่าตรงไหนคือช่องจอด */}
        <section className="rounded-xl border border-white/10 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-2">1) LiDAR รู้ได้ยังไงว่าตรงไหนคือ “ช่องจอด”?</h2>
          <p className="text-sm leading-relaxed text-slate-300">
            ตัว LiDAR เองไม่เข้าใจความหมายของพื้นที่ มันให้ออกมาแค่ <b className="text-white">กลุ่มจุด 3 มิติ (point cloud)</b> ที่บอกระยะและความสูงของสิ่งที่ลำแสงไปกระทบ
            ระบบจะ “รู้” ว่าโซนไหนคือช่อง 1, 2, 3… เพราะมีการ <b className="text-white">ตั้งค่าครั้งเดียวตอนติดตั้ง (calibration)</b> โดยกำหนดขอบเขตของแต่ละช่องจอดเป็น
            <b className="text-white"> โซน/พื้นที่สนใจ (ROI polygon)</b> บนพื้น เทียบกับตำแหน่งและความสูงของ LiDAR
            ในซิมนี้คือ “กรอบช่องจอด” บนพื้นที่เรากำหนดตำแหน่งไว้ (ช่อง 1…N).
          </p>
        </section>

        {/* 2. ว่าง/ไม่ว่าง */}
        <section className="rounded-xl border border-white/10 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-2">2) ตัดสิน “ว่าง / ไม่ว่าง” อย่างไร?</h2>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg p-3" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e55" }}>
              <div className="font-bold text-emerald-300 mb-1">ว่าง</div>
              ในโซนช่องนั้นเห็นแต่จุดที่อยู่ระดับ <b>พื้น</b> (ความสูง ≈ 0) ไม่มีกลุ่มจุดสูงผิดปกติ → ช่องว่าง
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #ef444455" }}>
              <div className="font-bold text-rose-300 mb-1">ไม่ว่าง (มีรถ)</div>
              มีกลุ่มจุด (cluster) ที่สูงเกินเกณฑ์ <b>{DETECTION.HEIGHT_THRESHOLD} m</b> และมีขนาดเท่าตัวรถอยู่ในโซน → มีรถจอด
            </div>
            <div className="rounded-lg p-3" style={{ background: "rgba(100,116,139,0.15)", border: "1px solid #64748b55" }}>
              <div className="font-bold text-slate-300 mb-1">จุดบอด</div>
              ไม่มีจุด (หรือจุดน้อยกว่า <b>{DETECTION.MIN_POINTS}</b> จุด) ตกในโซน → บอกสถานะไม่ได้
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-300 mt-3">
            หลักคือดู <b className="text-white">ความสูงของจุดเหนือพื้น</b> ในแต่ละโซน: รถจะทำให้เกิดกลุ่มจุดยกตัวสูงขึ้นมาจากพื้น ส่วนช่องว่างจะเห็นเพียงระนาบพื้นเรียบ ๆ
          </p>
        </section>

        {/* 3. จุดบอด */}
        <section className="rounded-xl border border-white/10 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-2">3) “จุดบอด” เกิดเมื่อไหร่? (ทำไมมุมแบบนั้นมองไม่เห็น)</h2>
          <ul className="text-sm leading-relaxed text-slate-300 space-y-1.5 list-disc pl-5">
            <li><b className="text-white">ถูกบดบัง (occlusion):</b> รถคันหน้าที่สูงกว่า หรือเสา บังเส้นสายตา → ไม่มีจุดไปตกถึงช่องด้านหลัง</li>
            <li><b className="text-white">อยู่นอกมุมแนวตั้ง:</b> ช่องที่ใกล้เกินไปจะหลุดต่ำกว่าขอบล่างของลำแสง (โดยเฉพาะถ้าติดสูงและก้มน้อย)</li>
            <li><b className="text-white">เกินระยะตรวจจับ:</b> ไกลกว่าระยะสูงสุดของรุ่น สัญญาณกลับมาน้อยเกินไป</li>
            <li><b className="text-white">ความหนาแน่นจุดต่ำ:</b> ยิ่งไกล จุดยิ่งห่าง ถ้าห่างเกิน {DETECTION.MAX_POINT_SPACING} m ที่ตัวรถ อาจได้จุดไม่พอจะยืนยัน</li>
          </ul>
        </section>

        {/* 4. สูตรคำนวณ */}
        <section className="rounded-xl border border-white/10 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-2">4) การคำนวณหลัก</h2>
          <div className="space-y-2 text-sm text-slate-300 font-mono bg-[#0a1322] rounded-lg p-3 border border-white/10">
            <div>จุดที่ลำแสงตกถึงพื้น: <span className="text-sky-300">x = H / tan(θ)</span> <span className="text-slate-500 font-sans">— θ = มุมก้มของลำแสงเส้นนั้น</span></div>
            <div>โซนใกล้สุด: <span className="text-sky-300">x_near = H / tan(tilt + FOV/2)</span></div>
            <div>โซนไกลสุด: <span className="text-sky-300">x_far = H / tan(tilt − FOV/2)</span></div>
            <div>ปลายเงาหลังรถสูง h ที่ระยะ d: <span className="text-sky-300">d · H / (H − h)</span> <span className="text-slate-500 font-sans">— H มาก → เงาสั้นลง</span></div>
            <div>ระยะห่างจุดที่ระยะ r: <span className="text-sky-300">r · (FOV / จำนวนชั้น)</span> <span className="text-slate-500 font-sans">— ไกลขึ้น จุดห่างขึ้น</span></div>
          </div>
        </section>

        {/* 5. ตัวตรวจเช็คขีดจำกัด */}
        <section className="rounded-xl border border-sky-400/30 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-3">5) ตัวตรวจเช็คขีดจำกัด (เลือกรุ่น → ดูว่าตั้งค่าได้แค่ไหน)</h2>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <select value={modelId} onChange={(e) => pickModel(e.target.value)} className="w-full bg-[#13243c] border border-white/10 rounded-md text-sm px-2 py-2 text-white">
                {LIDAR_MODELS.map((md) => (<option key={md.id} value={md.id}>{md.brand} {md.model} — {md.tier}</option>))}
              </select>
              <Slider label="ความสูงติดตั้ง" val={H} unit=" m" min={2} max={Math.max(12, model.recMount[1] + 2)} step={0.1} onChange={setH} />
              <Slider label="องศาก้ม (tilt)" val={tilt} unit="°" min={0} max={45} step={1} onChange={setTilt} />
              <Slider label={`มุมเปิดแนวตั้ง (เพดาน ${model.vfov}°)`} val={fov} unit="°" min={8} max={model.vfov} step={1} onChange={(v) => setFov(Math.min(v, model.vfov))} />
              <Slider label={`ระยะตรวจจับ (เพดาน ${model.maxRange} m)`} val={range} unit=" m" min={Math.max(10, Math.ceil(model.minRange))} max={model.maxRange} step={1} onChange={(v) => setRange(Math.min(v, model.maxRange))} />
            </div>

            <div className="space-y-2">
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: `${verdictColor}1f`, border: `1px solid ${verdictColor}` }}>
                <span className="text-sm text-slate-300">ผลประเมินการติดตั้ง</span>
                <span className="text-lg font-bold" style={{ color: verdictColor }}>{verdict}</span>
              </div>
              <div className="rounded-lg bg-[#0a1322] border border-white/10 p-3 text-sm space-y-1.5">
                <Row k="โซนพื้นที่เห็น (ระยะ)" v={`${isFinite(cov.near) ? cov.near.toFixed(1) : "0"} – ${isFinite(cov.far) ? cov.far.toFixed(1) : "∞"} m`} />
                <Row k="ความลึกที่ครอบคลุม" v={isFinite(coverDepth) ? `${coverDepth.toFixed(1)} m` : "ไกลมาก"} />
                <Row k="ระยะห่างจุดที่ขอบไกล" v={`${spacingFar.toFixed(2)} m`} ok={spacingOk} />
                <Row k="ความสูงติดตั้งแนะนำ" v={`${model.recMount[0]}–${model.recMount[1]} m`} ok={mountOk} />
              </div>
              <ul className="text-[12px] text-slate-300 space-y-1 leading-snug">
                {!mountOk && <li className="text-amber-300">• ความสูง {H.toFixed(1)} m อยู่นอกช่วงแนะนำของ {model.model} ({model.recMount[0]}–{model.recMount[1]} m)</li>}
                {!spacingOk && <li className="text-amber-300">• ที่ขอบไกล จุดห่าง {spacingFar.toFixed(2)} m (&gt; {DETECTION.MAX_POINT_SPACING} m) — รถที่ขอบไกลอาจได้จุดไม่พอ ลดระยะหรือเลือกรุ่นชั้นมากขึ้น</li>}
                {isFinite(cov.near) && cov.near > 6 && <li className="text-amber-300">• โซนใกล้เริ่มที่ {cov.near.toFixed(1)} m — ใต้เสาเป็นจุดบอด เพิ่ม tilt หรือ FOV</li>}
                {verdict === "ผ่าน" && <li className="text-emerald-300">• การตั้งค่าอยู่ในขีดจำกัดของรุ่นและให้ความหนาแน่นจุดเพียงพอ ✓</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* 6. ตารางขีดจำกัดรุ่น */}
        <section className="rounded-xl border border-white/10 bg-[#0d1726] p-5">
          <h2 className="text-base font-bold text-sky-300 mb-3">6) ตารางขีดจำกัดของแต่ละรุ่น</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-2 px-2">รุ่น</th>
                  <th className="text-right py-2 px-2">ชั้น</th>
                  <th className="text-right py-2 px-2">ระยะสูงสุด</th>
                  <th className="text-right py-2 px-2">ใกล้สุด</th>
                  <th className="text-right py-2 px-2">vFOV</th>
                  <th className="text-right py-2 px-2">จุด/วิ</th>
                  <th className="text-right py-2 px-2">ติดตั้ง</th>
                  <th className="text-left py-2 px-2">เหมาะกับ</th>
                </tr>
              </thead>
              <tbody>
                {LIDAR_MODELS.map((md) => (
                  <tr key={md.id} className={`border-b border-white/5 ${md.id === modelId ? "bg-sky-500/10" : ""}`}>
                    <td className="py-2 px-2"><div className="flex items-center gap-2"><div className="shrink-0 rounded bg-[#0e1c30] p-0.5"><LidarVisual model={md} size={34} /></div><div><div className="font-semibold text-white">{md.brand} {md.model}</div><div className="text-[10px] text-slate-500">{md.tier}</div></div></div></td>
                    <td className="text-right px-2 font-mono">{md.channels || "—"}</td>
                    <td className="text-right px-2 font-mono text-sky-300">{md.maxRange} m</td>
                    <td className="text-right px-2 font-mono">{md.minRange} m</td>
                    <td className="text-right px-2 font-mono">{md.vfov}°</td>
                    <td className="text-right px-2 font-mono">{(md.ptsPerSec / 1000).toFixed(0)}k</td>
                    <td className="text-right px-2 font-mono">{md.recMount[0]}–{md.recMount[1]} m</td>
                    <td className="px-2 text-slate-400 max-w-[220px]">{md.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            หมายเหตุ: ระยะตรวจจับจริงขึ้นกับการสะท้อนแสงของวัตถุ — รถสีเข้ม (สะท้อน ~10%) จะตรวจได้ใกล้กว่าค่าที่โฆษณา (มักวัดที่ 80%).
            ตัวเลขเป็นค่าอ้างอิงจากสเปกผู้ผลิตเพื่อใช้ออกแบบ/เปรียบเทียบ ควรยืนยันกับ datasheet ล่าสุดก่อนสั่งซื้อ.
          </p>
        </section>
      </main>
    </div>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={`font-mono ${ok === undefined ? "text-slate-200" : ok ? "text-emerald-300" : "text-amber-300"}`}>{v}{ok === false ? " ⚠" : ok ? " ✓" : ""}</span>
    </div>
  );
}
