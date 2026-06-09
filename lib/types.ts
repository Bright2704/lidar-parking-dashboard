// ---- Core data model for the LiDAR Smart Parking prototype ----

export interface Spot {
  id: string;
  x: number; // top-left X in SVG units
  y: number; // top-left Y in SVG units
  w: number;
  h: number;
  vertical: boolean; // true = car noses in from top/bottom; false = from the side
  occupied: boolean; // ground-truth: is a car physically there?
  enteredAt?: number; // timestamp (ms) the current car arrived
}

export interface Sensor {
  id: string;
  name: string;
  code: string;
  x: number; // center X
  y: number; // center Y
  radius: number; // detection radius in SVG units
  temp: number; // °C, cosmetic (matches ParkHelp-style detail panel)
}

export interface Obstacle {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // "pillar" = เสาอาคาร (สี่เหลี่ยม) · "tree" = ต้นไม้ (วงกลม) — ทั้งคู่บดบัง LiDAR
  kind?: "pillar" | "tree";
  label?: string;
}

export interface Lane {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  id: string;
  name: string;
  description: string;
  kind: "outdoor" | "indoor" | "mixed";
  width: number; // viewBox width
  height: number; // viewBox height
  spots: Spot[];
  sensors: Sensor[];
  lanes: Lane[];
  obstacles: Obstacle[];
}

export interface ParkEvent {
  id: number;
  t: number; // timestamp
  type: "in" | "out" | "sensor" | "info";
  msg: string;
}
