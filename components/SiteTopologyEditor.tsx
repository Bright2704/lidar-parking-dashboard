"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconLiDAR, IconEdge, IconSwitch, IconServer, IconCloud, IconCamera,
  IconSign, IconGate, IconKiosk, IconMonitor, IconUPS, IconCarTop,
  IconRouter, IconAP, IconMobile, IconAnalytics, IconReport, IconBMS,
  IconZoneOcc, IconCountLine, IconNoPark, IconFlow,
} from "@/components/DeviceIcons";

const CARD = "#1a1a1a";
const VB_W = 1040, VB_H = 620;

type IconFn = (p: { x: number; y: number }) => React.ReactElement;
type Kind = { type: string; label: string; color: string; Icon: IconFn };

const KINDS: Kind[] = [
  { type: "lidar", label: "Ouster LiDAR", color: "#38bdf8", Icon: IconLiDAR },
  { type: "edge", label: "Gemini Edge AI", color: "#a78bfa", Icon: IconEdge },
  { type: "switch", label: "PoE++ Switch", color: "#22c55e", Icon: IconSwitch },
  { type: "router", label: "Router / Firewall", color: "#f87171", Icon: IconRouter },
  { type: "ap", label: "Wi-Fi AP", color: "#34d399", Icon: IconAP },
  { type: "server", label: "BlueCity Server", color: "#60a5fa", Icon: IconServer },
  { type: "cloud", label: "Cloud Portal", color: "#60a5fa", Icon: IconCloud },
  { type: "camera", label: "ANPR Camera", color: "#f472b6", Icon: IconCamera },
  { type: "sign", label: "LED Sign", color: "#22c55e", Icon: IconSign },
  { type: "gate", label: "Barrier Gate", color: "#ef4444", Icon: IconGate },
  { type: "kiosk", label: "Payment Kiosk", color: "#fbbf24", Icon: IconKiosk },
  { type: "monitor", label: "Control / VMS", color: "#7dd3fc", Icon: IconMonitor },
  { type: "ups", label: "UPS", color: "#f59e0b", Icon: IconUPS },
  { type: "mobile", label: "แอปมือถือ", color: "#7dd3fc", Icon: IconMobile },
  { type: "analytics", label: "Advanced Analytics", color: "#22d3ee", Icon: IconAnalytics },
  { type: "report", label: "Auto Reports", color: "#cbd5e1", Icon: IconReport },
  { type: "bms", label: "BMS อาคาร", color: "#94a3b8", Icon: IconBMS },
  { type: "zoneOcc", label: "Zone: ช่องจอด (ว่าง/เต็ม)", color: "#22c55e", Icon: IconZoneOcc },
  { type: "countLine", label: "เส้นนับรถ เข้า/ออก", color: "#f59e0b", Icon: IconCountLine },
  { type: "noPark", label: "Zone: ห้ามจอด/รับส่ง", color: "#ef4444", Icon: IconNoPark },
  { type: "flow", label: "Zone: วิเคราะห์การไหล", color: "#38bdf8", Icon: IconFlow },
  { type: "car", label: "รถ (ตกแต่ง)", color: "#475569", Icon: (p) => IconCarTop({ ...p }) },
];
const KIND = (t: string) => KINDS.find((k) => k.type === t) || KINDS[0];

type Node = { id: string; type: string; x: number; y: number; label: string };
type Link = { id: string; from: string; to: string };
type Template = { nodes: Node[]; links: Link[] };

const SITE_TEMPLATE: Template = {
  nodes: [
    { id: "L1", type: "lidar", x: 250, y: 200, label: "LiDAR 1" },
    { id: "L2", type: "lidar", x: 450, y: 200, label: "LiDAR 2" },
    { id: "L3", type: "lidar", x: 650, y: 200, label: "LiDAR 3" },
    { id: "E1", type: "edge", x: 450, y: 320, label: "Gemini Edge" },
    { id: "S1", type: "switch", x: 450, y: 420, label: "PoE++ Switch" },
    { id: "SV", type: "server", x: 330, y: 520, label: "BlueCity Server" },
    { id: "CL", type: "cloud", x: 570, y: 520, label: "Cloud Portal" },
    { id: "C1", type: "camera", x: 120, y: 340, label: "ANPR เข้า" },
    { id: "G1", type: "gate", x: 120, y: 430, label: "ไม้กั้น" },
    { id: "SG", type: "sign", x: 850, y: 330, label: "ป้าย LED" },
  ],
  links: [
    { id: "k1", from: "L1", to: "E1" }, { id: "k2", from: "L2", to: "E1" }, { id: "k3", from: "L3", to: "E1" },
    { id: "k4", from: "E1", to: "S1" }, { id: "k5", from: "S1", to: "SV" }, { id: "k6", from: "SV", to: "CL" },
    { id: "k7", from: "C1", to: "S1" }, { id: "k8", from: "S1", to: "SG" },
  ],
};

const NET_TEMPLATE: Template = {
  nodes: [
    { id: "L1", type: "lidar", x: 220, y: 95, label: "LiDAR 1" },
    { id: "L2", type: "lidar", x: 360, y: 95, label: "LiDAR 2" },
    { id: "C1", type: "camera", x: 510, y: 95, label: "ANPR" },
    { id: "E1", type: "edge", x: 360, y: 205, label: "Gemini Edge" },
    { id: "SW", type: "switch", x: 300, y: 312, label: "PoE++ Switch" },
    { id: "RT", type: "router", x: 480, y: 312, label: "Router/Firewall" },
    { id: "SV", type: "server", x: 250, y: 420, label: "BlueCity Server" },
    { id: "CL", type: "cloud", x: 440, y: 420, label: "Cloud" },
    { id: "VM", type: "monitor", x: 640, y: 420, label: "VMS" },
    { id: "M1", type: "monitor", x: 300, y: 535, label: "แดชบอร์ด" },
    { id: "MB", type: "kiosk", x: 470, y: 535, label: "ตู้จ่ายเงิน" },
  ],
  links: [
    { id: "k1", from: "L1", to: "E1" }, { id: "k2", from: "L2", to: "E1" }, { id: "k3", from: "C1", to: "E1" },
    { id: "k4", from: "E1", to: "SW" }, { id: "k5", from: "SW", to: "RT" },
    { id: "k6", from: "RT", to: "SV" }, { id: "k7", from: "RT", to: "CL" }, { id: "k8", from: "SW", to: "VM" },
    { id: "k9", from: "SV", to: "M1" }, { id: "k10", from: "RT", to: "MB" },
  ],
};

export default function SiteTopologyEditor({ variant = "site", storageKey, template }: { variant?: "site" | "network"; storageKey?: string; template?: Template }) {
  const TPL = template ?? (variant === "network" ? NET_TEMPLATE : SITE_TEMPLATE);
  const KEY = storageKey ?? (variant === "network" ? "ouster-network-v1" : "ouster-topology-v1");

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [nodes, setNodes] = useState<Node[]>(TPL.nodes);
  const [links, setLinks] = useState<Link[]>(TPL.links);
  const [sel, setSel] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);
  const [linkSrc, setLinkSrc] = useState<string | null>(null);
  const [showCars, setShowCars] = useState(true);
  const drag = useRef<{ id: string; ox: number; oy: number; moved: boolean } | null>(null);
  const counter = useRef(1);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); if (d.nodes) setNodes(d.nodes); if (d.links) setLinks(d.links); }
    } catch {}
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ nodes, links })); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links]);

  const toVB = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * VB_W, y: ((cy - r.top) / r.height) * VB_H };
  };
  const addNode = (type: string) => {
    const id = `n${Date.now() % 100000}${counter.current++}`;
    const k = counter.current;
    setNodes((p) => [...p, { id, type, x: 500 + (k % 5) * 26, y: 120 + (k % 4) * 26, label: KIND(type).label }]);
    setSel(id);
  };
  const removeSel = () => {
    if (!sel) return;
    setNodes((p) => p.filter((n) => n.id !== sel));
    setLinks((p) => p.filter((l) => l.from !== sel && l.to !== sel));
    setSel(null);
  };
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (connect) {
      if (!linkSrc) setLinkSrc(id);
      else if (linkSrc !== id) { setLinks((p) => [...p, { id: `k${Date.now() % 100000}`, from: linkSrc, to: id }]); setLinkSrc(null); }
      return;
    }
    const n = nodes.find((x) => x.id === id)!;
    const w = toVB(e.clientX, e.clientY);
    drag.current = { id, ox: w.x - n.x, oy: w.y - n.y, moved: false };
    setSel(id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const w = toVB(e.clientX, e.clientY);
    const d = drag.current; d.moved = true;
    setNodes((p) => p.map((n) => (n.id === d.id ? { ...n, x: Math.round(w.x - d.ox), y: Math.round(w.y - d.oy) } : n)));
  };
  const onUp = () => { drag.current = null; };
  const onCanvas = () => { setSel(null); setLinkSrc(null); };
  const center = (id: string) => { const n = nodes.find((x) => x.id === id); return n ? { x: n.x, y: n.y } : { x: 0, y: 0 }; };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); removeSel(); }
      if (e.key === "Escape") { setSel(null); setLinkSrc(null); setConnect(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const selNode = nodes.find((n) => n.id === sel) || null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button onClick={() => setConnect((v) => !v)} className={`text-xs px-3 py-1.5 rounded-md font-semibold border ${connect ? "bg-[#0078d4] text-white border-sky-400" : "bg-[#2d2d30] text-slate-200 border-white/10 hover:bg-[#37373d]"}`}>
          {connect ? "● โหมดเชื่อมสาย (คลิก 2 จุด)" : "🔗 เชื่อมสาย"}
        </button>
        <button onClick={removeSel} disabled={!sel} className="text-xs px-3 py-1.5 rounded-md font-semibold border bg-rose-500/15 border-rose-400/40 text-rose-200 hover:bg-rose-500/25 disabled:opacity-40">🗑 ลบที่เลือก</button>
        <button onClick={() => { setNodes([]); setLinks([]); setSel(null); }} className="text-xs px-3 py-1.5 rounded-md bg-[#2d2d30] border border-white/10 text-slate-200 hover:bg-[#37373d]">ล้างทั้งหมด</button>
        <button onClick={() => { setNodes(TPL.nodes); setLinks(TPL.links); setSel(null); }} className="text-xs px-3 py-1.5 rounded-md bg-[#2d2d30] border border-white/10 text-slate-200 hover:bg-[#37373d]">↺ รีเซ็ตเทมเพลต</button>
        {variant === "site" && <label className="flex items-center gap-1.5 text-[11px] text-slate-300 ml-1"><input type="checkbox" checked={showCars} onChange={(e) => setShowCars(e.target.checked)} className="accent-sky-400" /> แสดงรถ</label>}
        {selNode && (
          <span className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] text-slate-400">ชื่อ:</span>
            <input value={selNode.label} onChange={(e) => setNodes((p) => p.map((n) => (n.id === sel ? { ...n, label: e.target.value } : n)))} className="bg-[#2d2d30] border border-white/10 rounded text-xs px-2 py-1 text-white w-40" />
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_168px] gap-2">
        <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full rounded-lg border border-white/10 touch-none select-none" style={{ background: CARD, maxHeight: "70vh" }} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerDown={onCanvas}>
          {variant === "network" ? <NetworkBackdrop /> : <SiteBackdrop showCars={showCars} />}

          {links.map((l) => {
            const a = center(l.from), b = center(l.to);
            return <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0078d4" strokeWidth={2} strokeOpacity={0.75} strokeDasharray="6 4" style={{ cursor: "pointer" }} onPointerDown={(e) => { e.stopPropagation(); setLinks((p) => p.filter((x) => x.id !== l.id)); }} />;
          })}
          {connect && linkSrc && (() => { const c = center(linkSrc); return <circle cx={c.x} cy={c.y} r={26} fill="none" stroke="#fde68a" strokeWidth={2} strokeDasharray="3 3" />; })()}

          {nodes.map((n) => {
            const k = KIND(n.type);
            const isSel = sel === n.id;
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: connect ? "crosshair" : "grab" }} onPointerDown={(e) => onNodeDown(e, n.id)}>
                {isSel && <rect x={-30} y={-26} width={60} height={56} rx={8} fill="rgba(0,120,212,0.12)" stroke="#0078d4" strokeWidth={1.5} />}
                <g transform="translate(-26,-22)">{k.Icon({ x: 0, y: 0 })}</g>
                <text x={0} y={32} textAnchor="middle" fontSize={9.5} fill="#e2e8f0" fontWeight="bold" style={{ pointerEvents: "none" }}>{n.label}</text>
              </g>
            );
          })}
        </svg>

        <div className="rounded-lg border border-white/10 p-2 self-start" style={{ background: "#252526" }}>
          <div className="text-[11px] font-bold text-sky-300 mb-1.5 px-0.5">เครื่องมือ — คลิกเพื่อเพิ่ม</div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
            {KINDS.map((k) => (
              <button key={k.type} onClick={() => addNode(k.type)} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-white/10 hover:bg-[#37373d] text-left" style={{ background: "#1e1e1e" }} title={`เพิ่ม ${k.label}`}>
                <svg viewBox="0 0 52 40" width={26} height={20} className="shrink-0">{k.Icon({ x: 0, y: 0 })}</svg>
                <span className="text-[10.5px] text-slate-200 leading-tight">{k.label}</span>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-500 mt-2 leading-snug px-0.5">
            • คลิกไอคอน = เพิ่ม<br />• ลากบนผัง = ย้าย<br />• เลือก + Delete = ลบ<br />• เชื่อมสาย = คลิก 2 จุด<br />• คลิกเส้น = ลบสาย<br />• บันทึกอัตโนมัติ
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== พื้นหลังลานจอด (site) ===== */
function SiteBackdrop({ showCars }: { showCars: boolean }) {
  const lotX = 60, lotY = 60, lotW = 920, lotH = 500;
  const stallW = 26;
  const topRow = lotY + 70, midRowA = lotY + 210, midRowB = lotY + 280, botRow = lotY + 420;
  const cols = Math.floor((lotW - 140) / stallW);
  const occ = (i: number, r: number) => ((i * 7 + r * 3) % 4) > 0;
  return (
    <g>
      <rect x={0} y={0} width={VB_W} height={VB_H} fill="#15301c" opacity={0.25} />
      <rect x={lotX - 14} y={lotY - 14} width={lotW + 28} height={lotH + 28} rx={10} fill="#2b2b2b" />
      <rect x={lotX} y={lotY} width={lotW} height={lotH} rx={6} fill="#242427" />
      <rect x={lotX + lotW - 150} y={lotY} width={150} height={lotH} rx={6} fill="#202028" stroke="#3c3c3c" strokeDasharray="6 4" />
      <text x={lotX + lotW - 75} y={lotY + 18} textAnchor="middle" fontSize={11} fill="#94a3b8">อาคารจอด (ในร่ม)</text>
      <rect x={lotX + 70} y={midRowA + 36} width={lotW - 290} height={40} fill="#2a2a2e" />
      <line x1={lotX + 80} y1={midRowA + 56} x2={lotX + lotW - 230} y2={midRowA + 56} stroke="#6b6b3a" strokeWidth={2} strokeDasharray="14 10" />
      {[topRow, midRowA, midRowB, botRow].map((ry, r) =>
        Array.from({ length: cols }).map((_, i) => {
          const x = lotX + 70 + i * stallW;
          if (x > lotX + lotW - 160) return null;
          return (<g key={`${r}-${i}`}><line x1={x} y1={ry - 14} x2={x} y2={ry + 14} stroke="#41414a" strokeWidth={1} />{showCars && occ(i, r) && <IconCarTop x={x + stallW / 2} y={ry} c={(i + r) % 4 ? "#3f4a5e" : "#4a5772"} />}</g>);
        })
      )}
      {[topRow, midRowA, midRowB, botRow].map((ry, r) => (<line key={r} x1={lotX + 70} y1={ry + (r % 2 ? 16 : -16)} x2={lotX + lotW - 160} y2={ry + (r % 2 ? 16 : -16)} stroke="#41414a" strokeWidth={1.5} />))}
      <rect x={lotX - 14} y={lotY + lotH - 150} width={50} height={150} fill="#2a2a2e" />
      <path d={`M ${lotX + 10} ${lotY + lotH - 120} l 0 -26 l -6 0 l 9 -12 l 9 12 l -6 0 l 0 26 Z`} fill="#22c55e" opacity={0.8} />
      <text x={lotX + 11} y={lotY + lotH - 92} textAnchor="middle" fontSize={8} fill="#86efac">เข้า</text>
      <path d={`M ${lotX + 11} ${lotY + lotH - 60} l 0 26 l -6 0 l 9 12 l 9 -12 l -6 0 l 0 -26 Z`} fill="#ef4444" opacity={0.8} />
      <text x={lotX + 11} y={lotY + lotH - 20} textAnchor="middle" fontSize={8} fill="#fca5a5">ออก</text>
      {[[lotX + 30, lotY + 30], [lotX + lotW - 20, lotY + lotH - 24], [lotX + 30, lotY + lotH - 24]].map(([x, y], i) => (<g key={i}><circle cx={x} cy={y} r={9} fill="#2f5d34" stroke="#3a6b40" /><circle cx={x} cy={y} r={4} fill="#3a6b40" /></g>))}
      <g transform={`translate(${VB_W - 40}, 40)`}><path d="M0 -16 L7 10 L0 4 L-7 10 Z" fill="#94a3b8" /><text x={0} y={24} textAnchor="middle" fontSize={9} fill="#94a3b8">N</text></g>
      <text x={lotX} y={lotY - 24} fontSize={12} fill="#7dd3fc" fontWeight="bold">ผังลานจอด — ลาก/วางอุปกรณ์เพื่อออกแบบ Topology</text>
    </g>
  );
}

/* ===== พื้นหลังเครือข่าย (network swimlanes) ===== */
function NetworkBackdrop() {
  const lanes = [
    { y: 30, h: 120, c: "#38bdf8", t: "Field — เซนเซอร์ / กล้อง" },
    { y: 150, h: 110, c: "#a78bfa", t: "Edge — Gemini AI (Jetson Orin)" },
    { y: 260, h: 110, c: "#22c55e", t: "Network — PoE++ / Core / Firewall · VLAN" },
    { y: 370, h: 120, c: "#60a5fa", t: "Backend — Server / Cloud / VMS" },
    { y: 490, h: 120, c: "#fbbf24", t: "Users — แดชบอร์ด / มือถือ / ป้าย" },
  ];
  return (
    <g>
      {lanes.map((L, i) => (
        <g key={i}>
          <rect x={0} y={L.y} width={VB_W} height={L.h} fill={`${L.c}0d`} />
          <line x1={0} y1={L.y} x2={VB_W} y2={L.y} stroke="#2b2b2b" strokeWidth={1} strokeDasharray="8 6" />
          <rect x={10} y={L.y + 8} width={6} height={L.h - 16} rx={3} fill={L.c} opacity={0.5} />
          <text x={24} y={L.y + 20} fontSize={11} fill={L.c} fontWeight="bold">{`ชั้น ${i + 1}`}</text>
          <text x={24} y={L.y + 34} fontSize={10} fill="#94a3b8">{L.t}</text>
        </g>
      ))}
      <text x={VB_W - 16} y={22} textAnchor="end" fontSize={12} fill="#7dd3fc" fontWeight="bold">ผังเครือข่าย — วางอุปกรณ์ตามชั้น แล้วเชื่อมสายตาม requirement</text>
    </g>
  );
}
