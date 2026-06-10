"use client";
import React from "react";

/* ชุดไอคอนอุปกรณ์ (วาดในพิกัด SVG พ่อแม่ ด้วย transform translate(x,y))
   ขนาดฐานประมาณ 52×40 px ต่อไอคอน */

type P = { x: number; y: number };

export const IconLiDAR = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={17} y={32} width={18} height={6} rx={1} fill="#334155" />
    <rect x={14} y={6} width={24} height={28} rx={5} fill="#9aa6b2" stroke="#0f172a" strokeWidth={1.4} />
    <rect x={14} y={15} width={24} height={10} fill="#0ea5e9" />
    <line x1={14} y1={20} x2={38} y2={20} stroke="#082f49" strokeWidth={1} />
    <ellipse cx={26} cy={6} rx={12} ry={3.2} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1} />
  </g>
);

export const IconEdge = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={4} y={10} width={44} height={24} rx={3} fill="#2a2440" stroke="#a78bfa" strokeWidth={1.4} />
    <rect x={12} y={16} width={16} height={13} rx={2} fill="#a78bfa" />
    <text x={20} y={25} textAnchor="middle" fontSize={7} fill="#1e1b2e" fontWeight="bold">AI</text>
    {[0, 1, 2, 3].map((i) => (<line key={i} x1={32 + i * 3.5} y1={15} x2={32 + i * 3.5} y2={29} stroke="#7c6fb0" strokeWidth={1.4} />))}
    <circle cx={9} cy={14} r={1.3} fill="#22c55e" />
  </g>
);

export const IconSwitch = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={2} y={12} width={48} height={17} rx={3} fill="#15331f" stroke="#22c55e" strokeWidth={1.4} />
    {Array.from({ length: 8 }).map((_, i) => (<rect key={i} x={7 + i * 5} y={21} width={3.4} height={5} rx={0.6} fill="#0f3d22" stroke="#22c55e" strokeWidth={0.6} />))}
    {Array.from({ length: 4 }).map((_, i) => (<circle key={i} cx={9 + i * 4} cy={16} r={1.1} fill={i % 2 ? "#22c55e" : "#fbbf24"} />))}
  </g>
);

export const IconServer = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={13} y={3} width={26} height={35} rx={3} fill="#16243a" stroke="#60a5fa" strokeWidth={1.4} />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x={17} y={7 + i * 10} width={18} height={7} rx={1.2} fill="#0e1c30" stroke="#3b556f" strokeWidth={0.7} />
        <circle cx={20} cy={10.5 + i * 10} r={1} fill="#22c55e" />
        <line x1={24} y1={10.5 + i * 10} x2={32} y2={10.5 + i * 10} stroke="#3b556f" strokeWidth={1} />
      </g>
    ))}
  </g>
);

export const IconCloud = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M14 30 a9 9 0 0 1 1 -18 a11 11 0 0 1 21 3 a7 7 0 0 1 -2 15 Z" fill="#13294a" stroke="#60a5fa" strokeWidth={1.4} />
    <path d="M18 24 l4 4 l8 -9" fill="none" stroke="#60a5fa" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

export const IconCamera = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={8} y={12} width={30} height={16} rx={3} fill="#1e293b" stroke="#f472b6" strokeWidth={1.3} />
    <circle cx={18} cy={20} r={5} fill="#0e1c30" stroke="#f472b6" strokeWidth={1.2} />
    <circle cx={18} cy={20} r={2} fill="#f472b6" />
    <rect x={36} y={16} width={9} height={8} rx={1.5} fill="#334155" />
    <rect x={20} y={28} width={4} height={8} fill="#334155" />
  </g>
);

export const IconSign = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={6} y={6} width={40} height={22} rx={3} fill="#111827" stroke="#22c55e" strokeWidth={1.4} />
    <text x={17} y={22} textAnchor="middle" fontSize={13} fill="#22c55e" fontWeight="bold">P</text>
    <text x={34} y={21} textAnchor="middle" fontSize={11} fill="#22c55e" fontWeight="bold">42</text>
    <rect x={24} y={28} width={4} height={10} fill="#334155" />
  </g>
);

export const IconGate = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={8} y={10} width={8} height={28} rx={2} fill="#334155" stroke="#94a3b8" strokeWidth={1} />
    <rect x={12} y={12} width={34} height={4} rx={2} fill="#ef4444" transform="rotate(-18 12 14)" />
    {[0, 1, 2].map((i) => (<rect key={i} x={18 + i * 9} y={9 - i * 2.6} width={4} height={4} fill="#fff" transform="rotate(-18 12 14)" />))}
  </g>
);

export const IconKiosk = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={14} y={4} width={24} height={34} rx={3} fill="#1e293b" stroke="#fbbf24" strokeWidth={1.3} />
    <rect x={18} y={8} width={16} height={12} rx={1.5} fill="#0ea5e9" opacity={0.8} />
    <rect x={20} y={23} width={12} height={3} rx={1} fill="#334155" />
    <circle cx={26} cy={31} r={3} fill="#334155" />
  </g>
);

export const IconMonitor = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={6} y={6} width={40} height={24} rx={2} fill="#0e1c30" stroke="#7dd3fc" strokeWidth={1.3} />
    <rect x={9} y={9} width={34} height={18} rx={1} fill="#13294a" />
    <rect x={12} y={20} width={6} height={5} fill="#22c55e" /><rect x={20} y={16} width={6} height={9} fill="#0ea5e9" /><rect x={28} y={13} width={6} height={12} fill="#f59e0b" />
    <rect x={22} y={30} width={8} height={5} fill="#334155" /><rect x={16} y={35} width={20} height={3} rx={1} fill="#334155" />
  </g>
);

export const IconMobile = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={17} y={4} width={18} height={32} rx={3} fill="#0e1c30" stroke="#7dd3fc" strokeWidth={1.3} />
    <rect x={19} y={8} width={14} height={22} rx={1} fill="#13294a" />
    <circle cx={26} cy={33} r={1.4} fill="#334155" />
    <rect x={22} y={12} width={6} height={3} fill="#22c55e" />
  </g>
);

export const IconUPS = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={12} y={6} width={28} height={32} rx={3} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.3} />
    <path d="M27 11 l-6 11 h5 l-2 9 l7 -12 h-5 Z" fill="#f59e0b" />
  </g>
);

/* ไอคอนผังจริง (top-down) */
export const IconPoleTop = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={6} fill="#0ea5e9" stroke="#bae6fd" strokeWidth={2} />
    <circle cx={0} cy={0} r={2} fill="#0b2740" />
  </g>
);

export const IconCarTop = ({ x, y, c = "#475569" }: P & { c?: string }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-7} y={-11} width={14} height={22} rx={3} fill={c} />
    <rect x={-5} y={-6} width={10} height={7} rx={1.5} fill="#1e293b" />
  </g>
);

export const IconRouter = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={4} y={14} width={44} height={18} rx={4} fill="#2a1d1d" stroke="#f87171" strokeWidth={1.4} />
    <line x1={20} y1={9} x2={16} y2={14} stroke="#f87171" strokeWidth={1.4} /><circle cx={20} cy={8} r={1.4} fill="#f87171" />
    <line x1={32} y1={9} x2={36} y2={14} stroke="#f87171" strokeWidth={1.4} /><circle cx={32} cy={8} r={1.4} fill="#f87171" />
    <path d="M12 23 h16 M24 20 l4 3 l-4 3" fill="none" stroke="#f87171" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M40 23 h-8 M36 20 l-4 3 l4 3" fill="none" stroke="#fca5a5" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

export const IconAP = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={16} y={24} width={20} height={10} rx={3} fill="#0e2a1f" stroke="#34d399" strokeWidth={1.3} />
    <circle cx={26} cy={29} r={1.6} fill="#34d399" />
    <path d="M18 18 a11 11 0 0 1 16 0" fill="none" stroke="#34d399" strokeWidth={1.4} />
    <path d="M21 21 a7 7 0 0 1 10 0" fill="none" stroke="#6ee7b7" strokeWidth={1.2} />
  </g>
);

/* ===== endpoints & event zones ===== */
export const IconAnalytics = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={8} y={6} width={36} height={28} rx={3} fill="#101826" stroke="#22d3ee" strokeWidth={1.3} />
    <rect x={13} y={20} width={5} height={9} fill="#22d3ee" /><rect x={21} y={15} width={5} height={14} fill="#38bdf8" /><rect x={29} y={11} width={5} height={18} fill="#a78bfa" />
    <path d="M12 13 l7 4 l6 -5 l8 3" fill="none" stroke="#fbbf24" strokeWidth={1.2} />
  </g>
);
export const IconReport = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M14 4 h16 l8 8 v26 h-24 Z" fill="#1b2030" stroke="#cbd5e1" strokeWidth={1.3} />
    <path d="M30 4 v8 h8" fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
    {[16, 20, 24, 28].map((yy, i) => (<line key={i} x1={17} y1={yy} x2={i % 2 ? 30 : 35} y2={yy} stroke="#64748b" strokeWidth={1.2} />))}
  </g>
);
export const IconBMS = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={10} y={6} width={20} height={32} rx={2} fill="#1e293b" stroke="#94a3b8" strokeWidth={1.3} />
    {[0, 1, 2].map((r) => [0, 1].map((c) => (<rect key={`${r}${c}`} x={14 + c * 7} y={10 + r * 8} width={4} height={5} fill="#0ea5e9" opacity={0.7} />)))}
    <rect x={30} y={16} width={12} height={22} rx={2} fill="#243244" stroke="#94a3b8" strokeWidth={1} />
    <circle cx={36} cy={22} r={2.5} fill="none" stroke="#fbbf24" strokeWidth={1} /><line x1={36} y1={19.5} x2={36} y2={17.5} stroke="#fbbf24" strokeWidth={1} />
  </g>
);
export const IconZoneOcc = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={9} y={8} width={34} height={24} rx={3} fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth={1.4} strokeDasharray="4 3" />
    <text x={26} y={26} textAnchor="middle" fontSize={15} fill="#22c55e" fontWeight="bold">P</text>
  </g>
);
export const IconCountLine = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <line x1={26} y1={4} x2={26} y2={36} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
    <path d="M12 14 h9 M18 11 l-4 3 l4 3" fill="none" stroke="#22c55e" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M40 26 h-9 M34 23 l4 3 l-4 3" fill="none" stroke="#ef4444" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
export const IconNoPark = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={26} cy={20} r={15} fill="rgba(239,68,68,0.1)" stroke="#ef4444" strokeWidth={1.6} />
    <text x={26} y={26} textAnchor="middle" fontSize={15} fill="#ef4444" fontWeight="bold">P</text>
    <line x1={16} y1={10} x2={36} y2={30} stroke="#ef4444" strokeWidth={1.8} />
  </g>
);
export const IconFlow = ({ x, y }: P) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={8} y={8} width={36} height={24} rx={3} fill="rgba(56,189,248,0.1)" stroke="#38bdf8" strokeWidth={1.3} strokeDasharray="4 3" />
    {[14, 22].map((yy, i) => (<path key={i} d={`M12 ${yy} h22 M30 ${yy - 3} l4 3 l-4 3`} fill="none" stroke="#38bdf8" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />))}
  </g>
);
