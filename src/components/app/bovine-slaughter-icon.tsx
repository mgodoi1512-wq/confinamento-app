import { createLucideIcon } from "lucide-react";

export const BovineSlaughterIcon = createLucideIcon("BovineSlaughter", [
  ["path", { d: "M5 7C2 7 1 5 2 2c1 2 2 2 4 2M12 7c3 0 4-2 3-5-1 2-2 2-4 2", key: "horns" }],
  ["path", { d: "M5 6c2-2 5-2 7 0v7c0 4-1.5 7-3.5 7S5 17 5 13Z", key: "head" }],
  ["ellipse", { cx: "8.5", cy: "16", rx: "3", ry: "2", key: "muzzle" }],
  ["path", { d: "M7 9h.01M10 9h.01", key: "eyes" }],
  ["path", { d: "M22 2v10h-4V8c0-3 1-5 4-6ZM19 12v9h2v-9", key: "knife" }],
]);
