export const productionSystems=[{value:"confinamento",label:"Confinamento"},{value:"semiconfinamento",label:"Semiconfinamento"},{value:"pasto",label:"A pasto"}] as const;
export type ProductionSystem=typeof productionSystems[number]["value"];
export type LocationType="curral"|"piquete"|"pasto";
export const locationTypes=[{value:"curral",labelKey:"Curral"},{value:"piquete",labelKey:"Piquete"},{value:"pasto",labelKey:"Pasto"}];
export const systemLabel=(system:string|null|undefined)=>productionSystems.find(s=>s.value===system)?.label??"Sistema não informado";
export const locationLabel=(type:string|null|undefined)=>locationTypes.find(t=>t.value===type)?.labelKey??"Curral";
export const compatibleLocation=(system:string|null|undefined,type:string|null|undefined)=>!system||system==="confinamento"?(type??"curral")==="curral":type==="piquete"||type==="pasto";
export const validSystems=(systems:readonly string[],standard:string|null|undefined)=>systems.length>0&&systems.length<=3&&new Set(systems).size===systems.length&&systems.every(s=>productionSystems.some(p=>p.value===s))&&!!standard&&systems.includes(standard);
