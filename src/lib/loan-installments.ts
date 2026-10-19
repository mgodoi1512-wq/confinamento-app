export type LoanFrequency = "mensal" | "semestral" | "anual";
export const loanFrequencies = [{value:"mensal",labelKey:"Mensal"},{value:"semestral",labelKey:"Semestral"},{value:"anual",labelKey:"Anual"}];
export function validCashDate(value:string):boolean {
 if(!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function loanSchedule(first:string,count:number,frequency:LoanFrequency):string[]{
 const months={mensal:1,semestral:6,anual:12}[frequency];
 if(!validCashDate(first)||!Number.isInteger(count)||count<1||count>360||!months)throw new Error("Informe primeiro vencimento, frequência e quantidade de 1 a 360 parcelas.");
 const [year,month,day]=first.split("-").map(Number);
 return Array.from({length:count},(_,index)=>{
  const offset=month-1+months*index,y=year+Math.floor(offset/12),m=offset%12;
  if(y>9999)throw new Error("A programação ultrapassa o limite das datas.");
  const lastDay=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return `${y}-${String(m+1).padStart(2,"0")}-${String(Math.min(day,lastDay)).padStart(2,"0")}`;
 });
}
export function checkLoanDates(dates:string[]):string|null {
 if(!dates.length||dates.some(d=>!validCashDate(d)))return "Informe uma data válida para cada parcela.";
 if(dates.some((d,i)=>i>0&&d<=dates[i-1]))return "O vencimento de cada parcela deve ser posterior ao da anterior.";
 return null;
}
