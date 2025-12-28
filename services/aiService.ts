
import { RedditPostData, AIConfig, RedditComment, CommentAnalysis, FactCheckResult } from "../types";
import { GoogleGenAI } from "@google/genai";

export interface AnalysisResult {
  id: string;
  isRageBait: boolean;
  zenScore: number;
  reason: string;
}

const cleanJsonString = (str: string) => {
    // Remove markdown code blocks if present (e.g. ```json ... ```)
    return str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
};

const PROMPT_MODEL_ID = 'gemini-2.0-flash-lite-preview-02-05';
// We need a model that supports search grounding for fact checking
const FACT_CHECK_MODEL_ID = 'gemini-2.0-flash-lite-preview-02-05'; 

export const analyzePostsForZen = async (posts: RedditPostData[], config?: AIConfig): Promise<AnalysisResult[]> => {
  if (posts.length === 0) return [];

  // Minimized payload
  const postsPayload = posts.map(p => ({
    id: p.id,
    t: p.title, // shortened key
    s: p.subreddit,
    b: p.selftext ? p.selftext.substring(0, 200) : "", // shortened body
  }));

  const threshold = config?.minZenScore ?? 50;
  const customPrompt = config?.customInstructions ? 
    `USER PREF: "${config.customInstructions}".` : "";

  const systemPrompt = `
    Task: Filter Reddit posts for a "Zen" feed.
    Filter out: Rage bait, divisive politics, aggression, anxiety-inducing content.
    ${customPrompt}
    Return JSON object with key "results" (array).
    Each item:
    - id: string
    - zenScore: number (0=Toxic/Rage, 100=Calm/Constructive)
    - reason: string (max 6 words)
    - isRageBait: boolean (true if zenScore < ${threshold})
  `;

  // Logic: Use OpenRouter IF key is explicitly provided in config.
  // Otherwise, use process.env.API_KEY as a Google GenAI key.
  
  if (config?.openRouterKey) {
     return analyzeWithOpenRouter(postsPayload, systemPrompt, config.openRouterKey, config.openRouterModel, threshold);
  } else if (process.env.API_KEY) {
     return analyzeWithGoogleGenAI(postsPayload, systemPrompt, process.env.API_KEY, threshold);
  } else {
     return fallbackResult(posts);
  }
};

const analyzeWithGoogleGenAI = async (
    payload: any, 
    systemPrompt: string, 
    apiKey: string,
    threshold: number
): Promise<AnalysisResult[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: PROMPT_MODEL_ID,
            contents: JSON.stringify(payload),
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) throw new Error("No text returned from Gemini");
        
        const parsed = JSON.parse(text);
        const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data);
        
        if (!Array.isArray(results)) throw new Error("Invalid structure from Gemini");

        return results.map((r: any) => ({
            id: r.id,
            isRageBait: typeof r.isRageBait === 'boolean' ? r.isRageBait : (r.zenScore < threshold),
            zenScore: typeof r.zenScore === 'number' ? r.zenScore : 50,
            reason: r.reason || "AI analysis"
        }));

    } catch (error) {
        console.error("Gemini Analysis Failed:", error);
        return fallbackResult(payload);
    }
}

const analyzeWithOpenRouter = async (
    payload: any, 
    systemPrompt: string, 
    apiKey: string, 
    model: string | undefined, 
    threshold: number
): Promise<AnalysisResult[]> => {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin, 
          "X-Title": "ZenReddit"
        },
        body: JSON.stringify({
          model: model || 'meta-llama/llama-3-8b-instruct:free',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(payload) }
          ],
          response_format: { type: "json_object" } 
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) throw new Error("No content");

      let parsed;
      try {
          parsed = JSON.parse(cleanJsonString(content));
      } catch (e) {
          console.warn("Invalid JSON from AI", content);
          return fallbackResult(payload);
      }

      const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data);

      if (!Array.isArray(results)) return fallbackResult(payload);

      return results.map((r: any) => ({
          id: r.id,
          isRageBait: typeof r.isRageBait === 'boolean' ? r.isRageBait : (r.zenScore < threshold),
          zenScore: typeof r.zenScore === 'number' ? r.zenScore : 50,
          reason: r.reason || "AI analysis"
      }));

  } catch (error) {
      console.error("OpenRouter Analysis Failed:", error);
      return fallbackResult(payload);
  }
}

const fallbackResult = (posts: any[]): AnalysisResult[] => {
    return posts.map(p => ({
        id: p.id,
        isRageBait: false,
        zenScore: 50,
        reason: "Analysis unavailable"
    }));
};

// --- Comment Analysis ---

export const analyzeCommentsForZen = async (
  comments: RedditComment[], 
  config?: AIConfig,
  context?: { title: string; subreddit: string; selftext?: string }
): Promise<CommentAnalysis[]> => {
  if (comments.length === 0) return [];

  const payload = comments.slice(0, 15).map(c => {
    let repliesContext: string[] = [];
    if (c.data.replies && typeof c.data.replies !== 'string' && c.data.replies.data) {
        repliesContext = c.data.replies.data.children
            .filter((child: any) => child.kind === 't1')
            .slice(0, 3) 
            .map((child: any) => `[${child.data.author}]: ${child.data.body.substring(0, 60)}`);
    }
    return {
      id: c.data.id,
      author: c.data.author,
      body: c.data.body.substring(0, 250),
      replies_context: repliesContext
    };
  });

  const contextStr = context ? `
    SUBREDDIT: r/${context.subreddit}
    POST TITLE: "${context.title}"
    ${context.selftext ? `POST CONTEXT: "${context.selftext.substring(0, 200)}..."` : ''}
  ` : "Context: General Reddit Thread";

  const systemPrompt = `
    You are a highly nuanced moderator.
    Analyze the following Reddit comments for TOXICITY and FACT CHECKABILITY.

    ${contextStr}

    Instructions:
    1. **Toxicity**: Flag genuine abuse, hate, or harm. Ignore friendly banter ("lol I hate you") or dramatic slang ("I'm dying").
    2. **Fact Checkability**: Determine if the comment contains verifiable factual claims (statistics, historical events, scientific assertions, specific news).
       - Set "isFactCheckable": true if it contains checkable facts.
       - Set "isFactCheckable": false if it is pure opinion ("I like this"), personal anecdote ("I went there"), or a joke.

    Return JSON: { "results": [{ "id": "string", "isToxic": boolean, "reason": "string", "isFactCheckable": boolean }] }
  `;

  if (config?.openRouterKey) {
      // Use OpenRouter
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
            "Authorization": `Bearer ${config.openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin, 
            "X-Title": "ZenReddit"
            },
            body: JSON.stringify({
            model: config.openRouterModel || 'meta-llama/llama-3-8b-instruct:free',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: JSON.stringify(payload) }
            ],
            response_format: { type: "json_object" } 
            })
        });

        if (!response.ok) return [];

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return [];

        const parsed = JSON.parse(cleanJsonString(content));
        const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data);
        
        if (Array.isArray(results)) {
            return results.map((r: any) => ({
                id: r.id,
                isToxic: !!r.isToxic,
                reason: r.reason,
                isFactCheckable: !!r.isFactCheckable
            }));
        }
        return [];
    } catch (e) {
        console.warn("OpenRouter Comment analysis error", e);
        return [];
    }
  } else if (process.env.API_KEY) {
      // Use Google GenAI
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: PROMPT_MODEL_ID,
            contents: JSON.stringify(payload),
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) return [];
        
        const parsed = JSON.parse(text);
        const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data);
        
        if (Array.isArray(results)) {
            return results.map((r: any) => ({
                id: r.id,
                isToxic: !!r.isToxic,
                reason: r.reason,
                isFactCheckable: !!r.isFactCheckable
            }));
        }
        return [];
      } catch (e) {
          console.warn("Gemini Comment analysis error", e);
          return [];
      }
  }

  return [];
};

// --- Fact Checking ---

export const factCheckComment = async (
    commentBody: string, 
    subreddit: string
): Promise<FactCheckResult> => {
    const apiKey = process.env.API_KEY;
    
    // Fallback if no Google API key is present (Fact Checking requires Google Search Tool)
    if (!apiKey) {
        return {
            verdict: 'Unverified',
            explanation: "API Key required for live fact checking.",
            sources: []
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `
            Fact check the main claims in this Reddit comment from r/${subreddit}:
            "${commentBody.substring(0, 500)}"
            
            1. Search for reliable sources to verify the claims.
            2. Determine a verdict: "True", "False", "Misleading", "Opinion" (if subjective), or "Unverified".
            3. Provide a concise explanation (max 2 sentences).
            
            Format your response exactly like this:
            Verdict: [Verdict]
            Explanation: [Explanation]
        `;

        const response = await ai.models.generateContent({
            model: FACT_CHECK_MODEL_ID,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        // Parse sources from grounding chunks
        const sources: { title: string; uri: string }[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        if (chunks) {
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri && chunk.web?.title) {
                    sources.push({
                        title: chunk.web.title,
                        uri: chunk.web.uri
                    });
                }
            });
        }

        const text = response.text || "";
        
        let verdict: FactCheckResult['verdict'] = 'Unverified';
        let explanation = text;

        // More robust Regex parsing
        const verdictRegex = /Verdict:\s*\*?([a-zA-Z]+)\*?/i;
        const match = text.match(verdictRegex);

        if (match && match[1]) {
            const v = match[1].toLowerCase();
            if (v === 'true') verdict = 'True';
            else if (v === 'false') verdict = 'False';
            else if (v === 'misleading') verdict = 'Misleading';
            else if (v === 'opinion') verdict = 'Opinion';
            else if (v === 'unverified') verdict = 'Unverified';
        }

        // Try to extract just the explanation part if the format was followed
        const explRegex = /Explanation:\s*(.*)/is;
        const explMatch = text.match(explRegex);
        if (explMatch && explMatch[1]) {
            explanation = explMatch[1].trim();
        } else {
             // Fallback: Remove the verdict line if found at the start
             explanation = text.replace(verdictRegex, '').trim();
        }
        
        return {
            verdict,
            explanation: explanation,
            sources: sources.filter((s, i, self) => 
                self.findIndex((t) => t.uri === s.uri) === i
            ).slice(0, 5) // Dedupe and limit
        };

    } catch (error) {
        console.error("Fact Check Failed:", error);
        return {
            verdict: 'Unverified',
            explanation: "Could not perform fact check at this time.",
            sources: []
        };
    }
}
