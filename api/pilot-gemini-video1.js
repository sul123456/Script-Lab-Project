// Isolated Gemini baseline pilot. Does not modify Creative Brain or Training Register.
// Deploy this branch to a protected preview before invoking this endpoint.
export const maxDuration = 300;
const VIDEO_ID = 'IrD3B0NfW-4';
const VIDEO_URL = 'https://www.youtube.com/watch?v=' + VIDEO_ID;
const MODEL = 'gemini-3.7-flash';
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
const prompt = `Watch and listen to the actual advertising film at the supplied video URI. Do not infer content from its title, metadata, or description. Return JSON only with these fields:
video_observed (boolean), summary (string), observed_evidence (array of objects with timestamp, visual, audio), intended_message (string), likely_audience_takeaway (string), message_gap (string), product_benefit (string), story_message_connection (string), script_analysis (object with hook, setup, conflict, dialogue, turn, payoff, product_integration, pacing, originality), creative_learnings (array of transferable principles), uncertainties (array of strings).
Distinguish observation from interpretation. If you cannot view or hear the video, set video_observed false and explain why; do not fabricate scenes, dialogue, timestamps, or scores. Never claim that Creative Brain was trained.`;
function readText(data){
 return (data.candidates||[]).flatMap(c=>(c.content?.parts||[]).map(p=>p.text||'')).join('');
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 // Prevent anonymous internet traffic from spending API credits.
 const secret=process.env.PILOT_BENCHMARK_TOKEN;
 if(!secret)return res.status(503).json({error:'PILOT_BENCHMARK_TOKEN must be configured in the preview environment'});
 if(req.headers['x-pilot-token']!==secret)return res.status(401).json({error:'Unauthorised pilot request'});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'GEMINI_API_KEY is not configured'});
 const started=Date.now();
 const attempts=[];
 for(let i=1;i<=2;i++){
  const attemptStarted=Date.now();
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt},{file_data:{mime_type:'video/mp4',file_uri:VIDEO_URL}}]}],generationConfig:{responseMimeType:'application/json'}})});
   const data=await response.json().catch(()=>({}));
   const errorMessage=data.error?.message||null;
   attempts.push({attempt:i,http_status:response.status,duration_ms:Date.now()-attemptStarted,error:errorMessage});
   console.info('Gemini pilot attempt',JSON.stringify({video_id:VIDEO_ID,attempt:i,status:response.status,duration_ms:Date.now()-attemptStarted,error:errorMessage}));
   if(response.ok){
    const raw=readText(data);
    let analysis=null,parseError=null;
    try{analysis=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch(e){parseError=e.message;}
    return res.status(200).json({status:analysis?'analysed':'unparseable_response',video_id:VIDEO_ID,model:MODEL,elapsed_ms:Date.now()-started,attempts,analysis,parse_error:parseError,raw_excerpt:analysis?undefined:raw.slice(0,2500)});
   }
   if(![429,500,502,503,504].includes(response.status))break;
  }catch(e){
   attempts.push({attempt:i,duration_ms:Date.now()-attemptStarted,error:e.message});
   console.error('Gemini pilot exception',JSON.stringify({video_id:VIDEO_ID,attempt:i,error:e.message}));
  }
  if(i===1)await new Promise(resolve=>setTimeout(resolve,1500));
 }
 return res.status(502).json({status:'failed',video_id:VIDEO_ID,model:MODEL,elapsed_ms:Date.now()-started,attempts});
}
