export const maxDuration = 60;
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const {url,transcript,title}=req.body||{};
 let host;try{host=new URL(url).hostname.toLowerCase()}catch{return res.status(400).json({error:'Valid YouTube URL required'})}
 if(!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host))return res.status(400).json({error:'YouTube link required'});
 if(!transcript||transcript.trim().length<80)return res.status(422).json({error:'Paste the video transcript or detailed scene notes (at least 80 characters) to analyse reliably. A link alone cannot establish what the film contains.'});
 const key=process.env.OPENAI_API_KEY;if(!key)return res.status(503).json({error:'AI analysis is not configured'});
 try{
 const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:'gpt-5.6-sol',reasoning_effort:'low',max_completion_tokens:1600,messages:[{role:'system',content:'You are an advertising creative-learning analyst. Extract transferable creative principles, never reproduce plots or dialogues as templates. Use only the supplied transcript or notes. Clearly state what cannot be assessed without seeing video frames. Return JSON object with summary, learnings (array of short actionable creative principles), visual_limitations, and suggested_application. Never claim a model was trained.'},{role:'user',content:JSON.stringify({title:title||'',url,source_text:transcript.slice(0,24000)})}],response_format:{type:'json_object'}})});
 const data=await response.json();if(!response.ok)return res.status(response.status).json({error:data.error?.message||'Analysis unavailable'});
 const raw=data.choices?.[0]?.message?.content;if(!raw)return res.status(502).json({error:'No analysis returned'});
 return res.status(200).json(JSON.parse(raw));
 }catch(e){return res.status(500).json({error:'Could not analyse supplied transcript'})}
}