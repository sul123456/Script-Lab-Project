// Isolated OpenAI video-analysis pilot. Does not write to Creative Brain or Training Register.
// Requires an authorised ingestion service configured via VIDEO_INGEST_API_URL and VIDEO_INGEST_API_KEY.
// Ingestion response contract: {frames:[{timestamp:"00:03",image_url:"https://..."}],audio_url:"https://..."}.
// The ingestion service must retrieve content only where the user has permission.
export const maxDuration=300;
const VIDEO='https://www.youtube.com/watch?v=IrD3B0NfW-4';
function safeUrl(s){try{const u=new URL(s);return u.protocol==='https:'&&!['localhost','127.0.0.1','169.254.169.254'].includes(u.hostname)&&!u.hostname.endsWith('.local')&& !/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)}catch{return false}}
async function openai(path,body,key){const r=await fetch('https://api.openai.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error('OpenAI '+r.status+': '+(data.error?.message||'Unknown error'));return data}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(!process.env.PILOT_BENCHMARK_TOKEN||req.headers['x-pilot-token']!==process.env.PILOT_BENCHMARK_TOKEN)return res.status(401).json({error:'Unauthorised pilot request'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({status:'not_configured',error:'OPENAI_API_KEY missing in Preview'});
 const ingestion=process.env.VIDEO_INGEST_API_URL,key=process.env.VIDEO_INGEST_API_KEY;
 if(!ingestion||!key)return res.status(503).json({status:'ingestion_not_configured',error:'Authorised video ingestion provider not connected. Configure VIDEO_INGEST_API_URL and VIDEO_INGEST_API_KEY for Preview. No video analysed.'});
 if(!safeUrl(ingestion))return res.status(400).json({error:'Invalid ingestion endpoint'});
 const started=Date.now();
 try{
  const source=await fetch(ingestion,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({video_url:VIDEO,request:'frames_and_audio',max_frames:12}),signal:AbortSignal.timeout(90000)});
  const payload=await source.json().catch(()=>({}));
  if(!source.ok)throw Error('Ingestion '+source.status+': '+(payload.error||'provider failed'));
  const frames=(payload.frames||[]).slice(0,12).filter(f=>safeUrl(f.image_url));
  if(frames.length<2||!safeUrl(payload.audio_url))return res.status(422).json({status:'incomplete_media',error:'Ingestion did not provide at least two valid visual frames and an audio URL; analysis not run.',frames:frames.length});
  const audio=await fetch(payload.audio_url,{signal:AbortSignal.timeout(60000)});
  if(!audio.ok)throw Error('Audio fetch failed '+audio.status);
  const length=Number(audio.headers.get('content-length')||0);
  if(length>24*1024*1024)throw Error('Audio exceeds 24 MB');
  const bytes=await audio.arrayBuffer();if(bytes.byteLength>24*1024*1024)throw Error('Audio exceeds 24 MB');
  const form=new FormData();form.append('model','gpt-4o-mini-transcribe');form.append('file',new Blob([bytes],{type:'audio/mpeg'}),'video-audio.mp3');
  const transResp=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form});
  const trans=await transResp.json().catch(()=>({}));if(!transResp.ok)throw Error('Transcription '+transResp.status+': '+(trans.error?.message||'failed'));
  const prompt='Analyse this actual advertisement using timestamped frames and the audio transcript. Do not invent unseen events, dialogue, music or effects. Return a JSON object with: video_observed (boolean), summary, observed_evidence (array with timestamp, visual, audio), intended_message, likely_audience_takeaway, message_gap, product_benefit, story_message_connection, script_analysis (hook, setup, conflict, dialogue, turn, payoff, product_integration, pacing, originality), creative_learnings (array of distinct transferable principles), uncertainties (array). Distinguish transcript evidence from visuals. Note limitations of sparse frames and transcription.';
  const content=[{type:'text',text:prompt+'\nAUDIO TRANSCRIPT:\n'+String(trans.text||'').slice(0,25000)},...frames.map(f=>({type:'text',text:'Frame at '+String(f.timestamp||'unknown')})).flatMap((t,i)=>[t,{type:'image_url',image_url:{url:frames[i].image_url,detail:'low'}}])];
  const result=await openai('chat/completions',{model:'gpt-4o',messages:[{role:'user',content}],response_format:{type:'json_object'},max_tokens:3500},process.env.OPENAI_API_KEY);
  const raw=result.choices?.[0]?.message?.content||'';
  let analysis;try{analysis=JSON.parse(raw)}catch{return res.status(502).json({status:'unparseable_response',error:'OpenAI returned invalid JSON'})}
  return res.status(200).json({status:'analysed',video_url:VIDEO,model:'gpt-4o',transcription_model:'gpt-4o-mini-transcribe',frames_analysed:frames.length,elapsed_ms:Date.now()-started,analysis,note:'Pilot only; no learnings saved or training performed.'});
 }catch(e){console.error('OpenAI video pilot failed:',e.message);return res.status(502).json({status:'failed',error:e.message,elapsed_ms:Date.now()-started})}
}
