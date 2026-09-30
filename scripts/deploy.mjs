import {readFile,readdir,stat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(await readFile(resolve(root,'wrangler.json'),'utf8'));
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID||config.account_id;
if(!token||!account)throw Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Never commit credentials.');
if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit all changes before deployment.');
execFileSync('node',['scripts/validate.mjs'],{cwd:root,stdio:'inherit'});
const release=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const collection=createHash('sha256').update(await readFile(resolve(root,'public/data/records.json'))).digest('hex');
const base='https://api.cloudflare.com/client/v4';
async function api(path,options={},auth=token){
 const response=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+auth,...options.headers},signal:AbortSignal.timeout(120000)});
 const result=await response.json();if(!response.ok||!result.success)throw Error('Cloudflare '+response.status+': '+JSON.stringify(result.errors));
 return result.result;
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.pdf':'application/pdf','.woff2':'font/woff2','.ttf':'font/ttf'};
const files=await readdir(resolve(root,'public'),{recursive:true});
const manifest={},byHash=new Map();
for(const file of files){
 const path=resolve(root,'public',file);if(!(await stat(path)).isFile())continue;
 const bytes=await readFile(path);if(bytes.length>25*1024*1024)throw Error('Asset too large: '+file);
 const type=mime[extname(file)]||'application/octet-stream';
 // Include MIME type to prevent identical bytes with different types sharing an upload.
 const hash=createHash('sha256').update(bytes).update(type).digest('hex').slice(0,32);
 manifest['/'+file.split('\\').join('/')]={hash,size:bytes.length};byHash.set(hash,{bytes,type});
}
const session=await api('/accounts/'+account+'/workers/scripts/'+config.name+'/assets-upload-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({manifest})});
let completion=session.buckets?.length?undefined:session.jwt;
for(const bucket of session.buckets||[]){
 const body=new FormData();for(const hash of bucket){const file=byHash.get(hash);body.set(hash,new File([file.bytes.toString('base64')],hash,{type:file.type}));}
 const result=await api('/accounts/'+account+'/workers/assets/upload?base64=true',{method:'POST',body},session.jwt);
 if(result.jwt)completion=result.jwt;
 console.log('Uploaded '+bucket.length+' assets');
}
if(!completion)throw Error('No asset completion token returned; deployment not attempted.');
const body=new FormData();
body.set('metadata',JSON.stringify({main_module:'worker.mjs',compatibility_date:config.compatibility_date,assets:{jwt:completion,config:{html_handling:'auto-trailing-slash',not_found_handling:'none',run_worker_first:true}},bindings:[{type:'assets',name:'ASSETS'},{type:'plain_text',name:'RELEASE_SHA',text:release},{type:'plain_text',name:'COLLECTION_SHA',text:collection}]}));
body.set('worker.mjs',new File([await readFile(resolve(root,'worker.mjs'))],'worker.mjs',{type:'application/javascript+module'}));
const result=await api('/accounts/'+account+'/workers/scripts/'+config.name,{method:'PUT',body});
console.log('Uploaded Worker release '+release);
if(process.env.CLOUDFLARE_ATTACH_DOMAIN==='1'){
 const host=config.routes[0].pattern,zoneName=host.split('.').slice(-2).join('.');
 const zones=await api('/zones?name='+encodeURIComponent(zoneName));
 if(zones.length!==1||zones[0].account.id!==account)throw Error('Target zone/account is not uniquely verified.');
 const existing=await api('/accounts/'+account+'/workers/domains');
 const match=existing.find(d=>d.hostname===host);
 if(match&&match.service!==config.name)throw Error('Target domain is already assigned to another Worker.');
 if(!match)await api('/accounts/'+account+'/workers/domains',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({hostname:host,service:config.name,environment:'production',zone_id:zones[0].id})});
 console.log('Custom domain configured: '+host);
}
await mkdir(resolve(root,'artifacts'),{recursive:true});
await writeFile(resolve(root,'artifacts/deployment.json'),JSON.stringify({release,collection,deployedAt:new Date().toISOString(),worker:config.name,workerId:result.id,versionId:result.deployment_id,domain:config.routes[0].pattern},null,2));
console.log('Verify /api/health and the public collection hash before claiming the release is live.');
