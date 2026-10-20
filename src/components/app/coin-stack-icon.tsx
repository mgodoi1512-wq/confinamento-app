import { createLucideIcon } from "lucide-react";

export const CoinStackIcon = createLucideIcon("CoinStack", [
  ["ellipse", { cx: "16", cy: "5", rx: "5", ry: "2", key: "top" }],
  ["path", { d: "M11 5v4c0 1.1 2.2 2 5 2s5-.9 5-2V5M21 9v4c0 1.1-2.2 2-5 2", key: "tall" }],
  ["ellipse", { cx: "8", cy: "14", rx: "5", ry: "2", key: "front" }],
  ["path", { d: "M3 14v4c0 1.1 2.2 2 5 2s5-.9 5-2v-4M21 13v4c0 1.1-2.2 2-5 2", key: "base" }],
]);
