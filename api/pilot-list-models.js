// Read-only model availability check for the isolated preview pilot.
// Never returns API credentials, never runs video analysis, and never modifies production.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 const token=process.env.PILOT_BENCHMARK_TOKEN;
 if(!token)return res.status(503).json({error:'Pilot token is not configured in this preview'});
 if(req.headers['x-pilot-token']!==token)return res.status(401).json({error:'Unauthorised'});
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:'GEMINI_API_KEY is unavailable in this preview'});
 try{
  const models=[];let nextPageToken;
  for(let i=0;i<5;i++){
   const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');
   url.searchParams.set('pageSize','100');
   if(nextPageToken)url.searchParams.set('pageToken',nextPageToken);
   const r=await fetch(url,{headers:{'x-goog-api-key':key}});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)return res.status(502).json({status:'provider_error',provider_http_status:r.status,error:data.error?.message||'Could not list models'});
   for(const m of data.models||[])models.push({name:m.name,display_name:m.displayName,supported_generation_methods:m.supportedGenerationMethods||[],description:(m.description||'').slice(0,280),input_token_limit:m.inputTokenLimit});
   nextPageToken=data.nextPageToken;
   if(!nextPageToken)break;
  }
  return res.status(200).json({status:'listed',count:models.length,models,has_more:!!nextPageToken,note:'This lists models available to the key through the Models API. It does not establish whether each model accepts YouTube video URIs through the Interactions API.'});
 }catch(e){return res.status(502).json({status:'request_failed',error:e.message});}
}
