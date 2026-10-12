export const maxDuration=60;
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const {url}=req.body||{};let u;
 try{u=new URL(url)}catch{return res.status(400).json({error:'Enter a valid video link'})}
 const host=u.hostname.toLowerCase();
 const youtube=['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host);
 const other=['instagram.com','www.instagram.com','facebook.com','www.facebook.com','fb.watch','drive.google.com'].includes(host);
 if(!youtube&&!other)return res.status(400).json({error:'Use a YouTube, Facebook, Instagram or Google Drive video link'});
 if(!youtube)return res.status(422).json({error:'Direct video analysis is not yet connected for this platform. Facebook, Instagram and Google Drive require supported media access; this link has not been analysed.',status:'unsupported_platform'});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'YouTube link analysis needs GEMINI_API_KEY configured in Vercel environment variables. No video was analysed.',status:'configuration_required'});
 try{
 const prompt='Watch and listen to this advertising film. Analyse the actual video, not only its title or description. Respond with valid JSON containing summary (string), learnings (array of transferable creative principles), visual_limitations (string), suggested_application (string), observed_evidence (array of specific visual or audio observations with timestamps if possible). Focus on plot, observational insight, cinematic devices, performance, natural dialogue, audible product features, pacing and payoff. Do not copy the plot or dialogue as a template. Distinguish what is observed from interpretation. Never claim Creative Brain has already been trained.';
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{fileData:{fileUri:url}},{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})});
 const data=await response.json();if(!response.ok)return res.status(502).json({error:data.error?.message||'YouTube video could not be accessed or analysed',status:'analysis_failed'});
 const raw=data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('');if(!raw)return res.status(502).json({error:'No usable video analysis returned',status:'analysis_failed'});
 const parsed=JSON.parse(raw);return res.status(200).json({...parsed,status:'analysed',platform:'YouTube'});
 }catch(e){return res.status(502).json({error:'Video analysis failed: '+e.message,status:'analysis_failed'})}
}