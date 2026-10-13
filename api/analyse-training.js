export const maxDuration=300;
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const {url}=req.body||{};let u;
 try{u=new URL(url)}catch{return res.status(400).json({error:'Enter a valid video link'})}
 const host=u.hostname.toLowerCase();
 const youtube=['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host);
 const other=true;
 if(!['https:','http:'].includes(u.protocol))return res.status(400).json({error:'Public HTTP(S) link required'});
 if(!youtube)return res.status(422).json({error:'Direct analysis is not yet supported for this link. Only publicly accessible YouTube videos can currently be analysed.',status:'unsupported_platform'});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'YouTube link analysis needs GEMINI_API_KEY configured in Vercel environment variables. No video was analysed.',status:'configuration_required'});
 try{
 const prompt='Watch and listen to this advertising film. Analyse the actual video, not only its title or description. Respond with valid JSON containing summary (string), learnings (array of transferable creative principles), visual_limitations (string), suggested_application (string), observed_evidence (array of specific visual or audio observations with timestamps if possible). Focus on plot, observational insight, cinematic devices, performance, natural dialogue, audible product features, pacing and payoff. Do not copy the plot or dialogue as a template. Distinguish what is observed from interpretation. Never claim Creative Brain has already been trained.';
 let data,response;
 for(let attempt=0;attempt<2;attempt++){
  response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({model:'gemini-3.8-flash',input:[{type:'text',text:prompt},{type:'video',uri:url}]})});
  data=await response.json().catch(()=>({}));
  if(response.ok)break;
  const message=data.error?.message||'YouTube video could not be accessed or analysed';
  const transient=[429,500,502,503,504].includes(response.status)||/high demand|overloaded|temporar|capacity|resource exhausted/i.test(message);
  if(!transient)return res.status(502).json({error:message,status:'analysis_failed'});
  if(attempt===1)return res.status(503).json({error:'Video analysis is temporarily busy. Retried twice. Please try again later.',status:'provider_busy'});
  await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
 }
 const raw=data.output_text||data.steps?.flatMap(step=>step.content||[]).map(item=>item.text||'').join('')||'';if(!raw)return res.status(502).json({error:'No usable video analysis returned',status:'analysis_failed'});
 const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));return res.status(200).json({...parsed,status:'analysed',platform:'YouTube'});
 }catch(e){return res.status(504).json({error:e.name==='TimeoutError'?'The video-analysis provider did not finish the request. Please retry later.':'Video analysis failed: '+e.message,status:'analysis_failed'})}
}