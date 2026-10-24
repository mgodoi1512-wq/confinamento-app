import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const path=new URL('./.tmp-coupon-'+randomUUID()+'.mjs',import.meta.url);
const source=await fs.readFile(new URL('./annual-installments-db.test.mjs',import.meta.url),'utf8');
const guard=setTimeout(()=>{console.error('Tempo excedido nos testes de cupons');process.exit(1);},60000);
try{
 await fs.writeFile(path,source.replace(/await db\.close\(\);\s*$/,"await (await import('./plan-coupons-db-cases.mjs')).testPlanCoupons({db,as,tenant,ownerA,staffA});\nawait db.close();"));
 await import(path.href);
}finally{clearTimeout(guard);await fs.rm(path,{force:true});}
