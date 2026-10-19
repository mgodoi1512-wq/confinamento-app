export type FeedStockItem={id:string;name:string;category:"racao"|"volumoso"|"ingrediente";quantity_kg:number};
export type FeedStockLink={diet_id:string;ingredient:string;item_id:string};
export type FeedStock={items:FeedStockItem[];links:FeedStockLink[]};
export function stockItemFor(catalog:FeedStock,dietId:string,name:string,mapping?:unknown){
 const fixed=!!mapping&&typeof mapping==="object"&&!Array.isArray(mapping);
 const id=fixed?(mapping as Record<string,unknown>)[name]:catalog.links.find(l=>l.diet_id===dietId&&l.ingredient===name)?.item_id;
 return catalog.items.find(i=>i.id===id);
}
export function feedStockNeeds(catalog:FeedStock,dietId:string,components:{name:string;totalKg:number}[],totalKg:number,mapping?:unknown){
 const grouped=new Map<string,{item:FeedStockItem;amount:number}>(),missing:string[]=[];
 for(const c of components){if(!Number.isFinite(c.totalKg)||c.totalKg<=0)continue;const item=stockItemFor(catalog,dietId,c.name,mapping);if(!item){missing.push(c.name);continue;}const current=grouped.get(item.id);grouped.set(item.id,{item,amount:(current?.amount??0)+c.totalKg});}
 const entries=[...grouped.values()].sort((a,b)=>a.item.id.localeCompare(b.item.id));
 const sum=entries.reduce((s,e)=>s+e.amount,0),grams=Math.round(totalKg*1000);
 const allocated=entries.map((e,index)=>{const raw=sum>0?grams*e.amount/sum:0;return{...e,index,grams:Math.floor(raw),remainder:raw-Math.floor(raw)};});
 const extra=grams-allocated.reduce((s,e)=>s+e.grams,0);
 const rank=[...allocated].sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
 if(sum>0)for(let i=0;i<Math.min(extra,rank.length);i++)rank[i].grams++;
 const rows=allocated.map(e=>({...e.item,required:e.grams/1000,remaining:Math.round(e.item.quantity_kg*1000-e.grams)/1000,shortage:Math.max(0,Math.round(e.grams-e.item.quantity_kg*1000)/1000)}));
 return{rows,missing:[...new Set(missing)],insufficient:rows.some(r=>r.shortage>0),valid:missing.length===0&&rows.length>0&&Number.isFinite(totalKg)&&totalKg>0};
}
