import { createLucideIcon } from "lucide-react";

/** Peso de balança, compartilhado entre os indicadores e as pesagens. */
export const WeightKgIcon = createLucideIcon("WeightKg", [
  ["path", { d: "M9 9V6a3 3 0 0 1 6 0v3", key: "handle" }],
  ["path", { d: "M6 9h12l3 12H3L6 9Z", key: "body" }],
  ["path", { d: "M7.5 12.5v6m0-3 3-2.5m-3 2.5 3 3", strokeWidth: "1.2", key: "k" }],
  ["path", { d: "M17 13.5v4.7a2 2 0 0 1-3.5 1.3M17 15.5a2 2 0 1 0-4 0 2 2 0 0 0 4 0", strokeWidth: "1.2", key: "g" }],
]);
