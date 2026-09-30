export const money=(v,d=0)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:d,minimumFractionDigits:d}).format(v);
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function taxBreakdown(value,district,tax){
 if(!Number.isFinite(value)||value<0||value>100000000)throw new RangeError('Enter an assessed value between $0 and $100 million.');
 const area=tax.districts.find(d=>d.id===district);if(!area)throw new RangeError('Unknown tax category');
 const rows=tax.rates.map(r=>({...r,amount:value*r.rate/1000}));
 if(area.rate)rows.push({id:'precinct',label:'Village district',rate:area.rate,color:'#af9278',description:'Combined applicable precinct components.',amount:value*area.rate/1000});
 return {rows,total:value*area.total/1000,rate:area.total};
}
export function searchRecords(records,query='',category='all'){
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return records.filter(r=>(category==='all'||r.category===category)&&terms.every(t=>(r.title+' '+r.entity+' '+r.description+' '+(r.text||'')).toLowerCase().includes(t)));
}
export function csv(rows){return rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
