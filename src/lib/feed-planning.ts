export type FeedShift = "manha" | "tarde" | "noite";
export type FeedSlot = { shift: FeedShift; time?: string; percent: number };
export type PlannedIngredient = { name: string; bodyWeightPct: number | null; dailyKgPerHead: number };
export const defaultFeedSchedule = (): FeedSlot[] => [
  {shift:"manha",percent:33.33},
  {shift:"tarde",percent:33.33},
  {shift:"noite",percent:33.34},
];
export const validateFeedSchedule = (schedule: FeedSlot[]): string | null => {
  if (schedule.length !== 3) return "Informe os três turnos.";
  for (let i=0;i<3;i++) {
    const slot=schedule[i];
    if (slot.shift!==(["manha","tarde","noite"] as const)[i] || !Number.isFinite(slot.percent) || slot.percent<0 || slot.percent>100) return "Confira os percentuais dos turnos.";
  }
  return Math.abs(schedule.reduce((sum,slot)=>sum+slot.percent,0)-100)>0.000001 ? "Os percentuais devem somar 100%." : null;
};
export const splitFeedSchedule = (count: number, current = defaultFeedSchedule()): FeedSlot[] => {
  const amounts=count===1?[100,0,0]:count===2?[50,50,0]:[33.33,33.33,33.34];
  return current.map((slot,index)=>({...slot,percent:amounts[index]}));
};
export const portionPerHead = (daily: number, percent: number) => Math.round(daily * percent / 100 * 1000) / 1000;
export const feedIngredientPortions = (ingredients: PlannedIngredient[], actualKgPerHead: number) => {
  const daily=ingredients.reduce((sum,item)=>sum+item.dailyKgPerHead,0);
  return ingredients.map(item=>({...item,kgPerHead:daily>0 ? item.dailyKgPerHead/daily*actualKgPerHead : 0}));
};

/** Distribui 100% somente pelos períodos escolhidos, sem privilegiar manhã/tarde. */
export const selectFeedPeriods = (selected: FeedShift[], current=defaultFeedSchedule()): FeedSlot[] => {
  const count=selected.length;
  const base=count ? Math.floor(10000/count)/100 : 0;
  let used=0,seen=0;
  return current.map(slot=>{
    let percent=0;
    if(selected.includes(slot.shift)){seen++;percent=seen===count?Math.round((100-used)*100)/100:base;used+=percent;}
    return {shift:slot.shift,percent};
  });
};
