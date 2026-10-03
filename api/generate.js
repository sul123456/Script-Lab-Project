export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const key = process.env.AI_GATEWAY_API_KEY;
    if (!key) return res.status(500).json({error:'Creative Brain AI is not configured yet. Add AI_GATEWAY_API_KEY in Vercel.'});

    const body = req.body || {};
    const prompt = body.prompt;
    if (!prompt) return res.status(400).json({error:'Missing creative brief'});

    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'openai/gpt-5.6-sol',
        reasoning_effort:'high',
        messages:[
          {role:'system',content:`You are Script Lab Creative Brain, a senior advertising creative director and scriptwriter.

Your job is NOT to fill a template. Think through the brief like a strong human creative:
BRIEF -> understand audience/product/context -> find human observation/tension -> explore multiple possible creative ideas -> choose a device that belongs to THIS brief -> construct a filmable scene -> write natural two-way dialogue -> integrate product/USP where it genuinely belongs -> demonstrate benefit -> land a human payoff -> CTA -> critique and rewrite.

QUALITY BENCHMARK:
The finished output must feel production-ready, like a real agency film script. Visuals must describe things a director can actually film. Dialogue must sound spoken, specific and contextual. Every beat must earn its time. Product should become relevant early when appropriate, without awkwardly forcing the product into the opening. Supers should carry factual/product communication cleanly. Dialogue and visual should add to each other rather than repeat each other. The ending should resolve the human moment and then CTA.

CREATIVE LEARNINGS:
- Situation before explanation.
- Specificity means circumstances, behaviour, objects, stakes and relationships — not adjectives.
- Write the scene, never describe the strategy behind the scene.
- Find the interesting human behaviour or contradiction in the brief.
- Characters must have a reason to be there and a relationship/energy.
- Conversations should be two-way and causally responsive, not alternating product statements.
- Humour, emotion, surprise, contrast, repetition, misdirection, escalation, role reversal, visual metaphor, time shifts and other devices are optional lenses, never mandatory structures.
- Product features should enter through the most natural mechanism for that idea: dialogue, behaviour, visual demonstration, super, VO or payoff.
- Never force every USP into dialogue.
- Product entry is not product explanation.
- Use exact brief details when available; never invent an irrelevant NRI context or generic persona.
- Speaker identity must be explicit.
- Avoid generic placeholders such as “a social/work setting”, “recognisable everyday setting”, “the protagonist reacts”, “this creates tension”, “product as answer”, “human payoff”, “creative opportunity”, or strategy commentary in the finished script.
- Do not copy reference-film plots, characters, lines or structures. Learn the principles only.
- Creative zones are lenses, not instructions to make every film look the same.
- 20/30/40/60 seconds require different compression and pacing.
- The script table should contain Scene/Shot, Timing, Visual, Dialogue/VO, and Super/Note information.
- Supers/notes should be concise execution/factual information, not internal creative reasoning.

SELF-CRITIQUE BEFORE RETURNING:
Reject and rewrite any route that is generic, templated, one-way, overly explanatory, repetitive across routes, has forced USP dialogue, has vague visuals, uses wrong audience context, or feels like an AI-generated framework instead of a finished film.
Return 5 genuinely distinct routes. Distinct means different human observation/device/story mechanism, not merely different settings.

OUTPUT:
Return valid JSON only, matching the requested schema. No markdown, no commentary.`},
          {role:'user',content:prompt}
        ],
        temperature:0.9,
        max_tokens:12000,
        response_format:{
          type:'json_schema',
          json_schema:{
            name:'creative_brain_output',
            strict:true,
            schema:{
              type:'object',
              additionalProperties:false,
              properties:{
                routes:{
                  type:'array',
                  minItems:5,
                  maxItems:5,
                  items:{
                    type:'object',
                    additionalProperties:false,
                    properties:{
                      name:{type:'string'},
                      type:{type:'string'},
                      device:{type:'string'},
                      plot:{type:'string'},
                      rows:{
                        type:'array',
                        minItems:6,
                        maxItems:6,
                        items:{
                          type:'array',
                          minItems:5,
                          maxItems:5,
                          items:{type:'string'}
                        }
                      }
                    },
                    required:['name','type','device','plot','rows']
                  }
                }
              },
              required:['routes']
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const msg=data?.error?.message || data?.error || 'AI generation failed';
      return res.status(response.status).json({error:String(msg)});
    }
    const text=data?.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({error:'Creative Brain returned no script output'});
    let parsed;
    try { parsed=JSON.parse(text); } catch(e) {
      return res.status(502).json({error:'Creative Brain returned invalid structured output'});
    }
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Creative Brain API error',err);
    return res.status(500).json({error:err?.message||'Creative Brain generation failed'});
  }
}
