export type FeedRole="energia"|"proteina"|"nucleo"|"outros";
export type FeedComponent={item_id:string;role:FeedRole;percent:number};
export type FeedRecipe={id:string;item_id:string;name:string;composition:FeedComponent[]};
export type ProductionItem={id:string;name:string;category:string;quantity_kg:number;stock_value:number};
export const feedRoleLabel:Record<FeedRole,string>={energia:"Energia",proteina:"Proteína",nucleo:"Núcleo / minerais",outros:"Ingrediente adicional"};
const order:Record<FeedRole,number>={energia:1,proteina:2,nucleo:3,outros:4};
export function canonicalComposition(lines:FeedComponent[]):FeedComponent[]{return lines.map(l=>({item_id:l.item_id.toLowerCase(),role:l.role,percent:l.percent})).sort((a,b)=>order[a.role]-order[b.role]||a.item_id.localeCompare(b.item_id));}
export function previewFeedProduction(quantity:number,lines:FeedComponent[],items:ProductionItem[],recipes:FeedRecipe[]=[]){
 const milli=Math.round(quantity*1000);
 if(!Number.isFinite(quantity)||quantity<=0||quantity>9999999.999||Math.abs(quantity*1000-milli)>1e-6)throw new Error("Informe os kg a produzir com até três casas decimais.");
 if(lines.length<3||lines.length>10)throw new Error("Informe energia, proteína, núcleo e até sete ingredientes adicionais.");
 for(const line of lines){if(!line.item_id||!(line.role in order)||!Number.isFinite(line.percent)||line.percent<=0||line.percent>100||Math.abs(line.percent*1000-Math.round(line.percent*1000))>1e-6)throw new Error("Selecione os ingredientes e informe seus percentuais com até três casas decimais.");}
 if(new Set(lines.map(l=>l.item_id.toLowerCase())).size!==lines.length)throw new Error("Não repita o mesmo ingrediente na composição.");
 for(const role of ["energia","proteina","nucleo"]){if(lines.filter(l=>l.role===role).length!==1)throw new Error("Informe uma fonte de energia, uma de proteína e um núcleo.");}
 if(lines.reduce((s,l)=>s+Math.round(l.percent*1000),0)!==100000)throw new Error("Os percentuais devem somar exatamente 100%.");
 const composition=canonicalComposition(lines);
 const allocated=composition.map((line,index)=>{const numerator=milli*Math.round(line.percent*1000);return{line,index,grams:Math.floor(numerator/100000),remainder:numerator%100000};});
 const left=milli-allocated.reduce((s,l)=>s+l.grams,0);
 const priority=[...allocated].sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
 for(let i=0;i<left;i++)priority[i].grams++;
 const components=allocated.map(({line,grams})=>{const item=items.find(i=>i.id.toLowerCase()===line.item_id&&i.category==="ingrediente");if(!item)throw new Error("Selecione somente ingredientes disponíveis no estoque.");if(grams<=0)throw new Error("Quantidade muito pequena para esta composição. Aumente os kg a produzir.");const quantity_kg=grams/1000,cost=item.quantity_kg?item.stock_value/item.quantity_kg:0;return{...line,name:item.name,quantity_kg,available:item.quantity_kg,cost,estimatedValue:quantity_kg*cost,insufficient:Math.round(item.quantity_kg*1000)<grams};});
 const existing=recipes.find(r=>JSON.stringify(canonicalComposition(r.composition))===JSON.stringify(composition));
 const base="Ração "+composition.map(c=>String(c.percent).replace('.',',')).join('-');let name=existing?.name??base;
 if(!existing){let suffix=1;while(items.some(i=>i.name.trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))name=`${base} (${++suffix})`;}
 return{name,composition,components,quantity_kg:quantity,totalCost:components.reduce((s,c)=>s+c.estimatedValue,0),insufficient:components.some(c=>c.insufficient)};
}
