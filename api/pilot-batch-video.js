// Preview-only bulk video pilot. No database writes or Creative Brain changes.
export const maxDuration=300;
const MODELS=['gemini-3.8-flash'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function parseVideo(url){try{const u=new URL(url);const h=u.hostname.toLowerCase().replace(/^www\.|^m\./,'');let id;if(h==='youtu.be')id=u.pathname.slice(1).split('/')[0];else if(h==='youtube.com')id=u.searchParams.get('v')||(u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)||[])[1];if(id&&/^[\w-]{11}$/.test(id))return {type:'youtube',id,url:'https://www.youtube.com/watch?v='+id};if(['facebook.com','fb.watch','instagram.com'].includes(h))return {type:'meta',url:u.href};return null}catch{return null}}
function readText(x){return(x.candidates||[]).flatMap(c=>(c.content?.parts||[]).map(p=>p.text||'')).join('')}
const prompt=`Watch and listen to the actual advertisement video. Do NOT infer scenes from metadata. Return valid JSON with video_observed (boolean), summary, observed_evidence (array of {timestamp,visual,audio}), intended_message, likely_audience_takeaway, message_gap, product_benefit, story_message_connection, script_analysis (hook,setup,conflict,dialogue,turn,payoff,product_integration,pacing,originality), creative_learnings (array of {principle,evidence,application}), uncertainties. If media cannot be viewed or heard, set video_observed false and do not invent evidence. Do not copy distinctive scripts or dialogue; identify transferable techniques only.`;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(!process.env.PILOT_BENCHMARK_TOKEN||req.headers['x-pilot-token']!==process.env.PILOT_BENCHMARK_TOKEN)return res.status(401).json({error:'Unauthorised'});
 const source=parseVideo(req.body?.url);if(!source)return res.status(400).json({error:'Provide a valid YouTube, Instagram or Facebook URL'});
 if(source.type==='meta')return res.status(200).json({status:'needs_authorised_media',url:source.url,video_observed:false,message:'Meta watch links cannot currently be ingested by this pilot. No analysis or training was performed.'});
 const key=process.env.GEMINI_API_KEY;if(!key)return res.status(503).json({error:'GEMINI_API_KEY missing in Preview'});
 const started=Date.now(),attempts=[];
 for(const model of MODELS)for(let i=0;i<3;i++){
  try{
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),70000);
   let response;try{response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{file_data:{mime_type:'video/mp4',file_uri:source.url}}]}],generationConfig:{responseMimeType:'application/json'}}),signal:controller.signal})}finally{clearTimeout(timeout)}
   const data=await response.json().catch(()=>({}));attempts.push({model,status:response.status,error:data.error?.message||null});
   if(response.ok){let analysis;try{analysis=JSON.parse(readText(data).replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))}catch{return res.status(200).json({status:'invalid_analysis',url:source.url,video_observed:false,attempts})}
    if(analysis.video_observed!==true||!Array.isArray(analysis.observed_evidence)||!analysis.observed_evidence.length)return res.status(200).json({status:'unverified_media',url:source.url,video_observed:false,analysis,attempts});
    return res.status(200).json({status:'analysed_pending_approval',url:source.url,model,elapsed_ms:Date.now()-started,analysis,attempts,notice:'Pilot only. No learnings have been saved.'});
   }
   if(![429,500,502,503,504].includes(response.status))break;
  }catch(e){attempts.push({model,error:e.name==='AbortError'?'timeout':e.message})}
  await sleep(2000*Math.pow(2,i)+Math.floor(Math.random()*1000));
 }
 return res.status(200).json({status:'failed_retryable',url:source.url,video_observed:false,elapsed_ms:Date.now()-started,attempts,message:'No video was analysed. Gemini 3.8 Flash was unavailable or unable to read the media; do not mark as trained.'});
}