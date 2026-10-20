import { createLucideIcon } from "lucide-react";

export const CattleNavIcon = createLucideIcon("CattleNav", [
  ["path", { d: "M7 8C3 8 2 5 3 2c1 3 3 3 5 3M17 8c4 0 5-3 4-6-1 3-3 3-5 3", key: "horns" }],
  ["path", { d: "M7 8 3 7 2 10l5 2M17 8l4-1 1 3-5 2M7 7c2-3 8-3 10 0v8c0 4-2 7-5 7s-5-3-5-7Z", key: "head" }],
  ["ellipse", { cx: "12", cy: "18", rx: "4", ry: "3", key: "muzzle" }],
  ["path", { d: "M9 10h.01M15 10h.01M10.5 18h.01M13.5 18h.01", key: "eyes" }],
]);

export const FloorPlanIcon = createLucideIcon("FloorPlan", [
  ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "1", key: "outline" }],
  ["path", { d: "M13 3v6M13 14v7M3 11h5M13 11h8M3 16h5", key: "walls" }],
  ["path", { d: "M8 11v4a4 4 0 0 0 4-4", strokeWidth: "1.3", key: "door" }],
]);
