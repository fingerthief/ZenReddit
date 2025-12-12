import { RedditPostData, AIConfig } from "../types";

export interface AnalysisResult {
  id: string;
  isRageBait: boolean;
  zenScore: number;
  reason: string;
}

export const analyzePostsForZen = async (posts: RedditPostData[], config?: AIConfig): Promise<AnalysisResult[]> => {
  if (posts.length === 0) return [];

  // Prepare a concise payload to save tokens and improve speed
  const postsPayload = posts.map(p => ({
    id: p.id,
    title: p.title,
    subreddit: p.subreddit,
    body_snippet: p.selftext ? p.selftext.substring(0, 500) : "No text content", 
  }));

  const threshold = config?.minZenScore ?? 50;

  const systemPrompt = `
    Analyze the following Reddit posts to curate a "Zen" feed. 
    Your goal is to strictly filter out rage bait, intentionally divisive politics, aggressive arguments, and content designed to induce anxiety or anger.
    
    Context & Heuristics:
    1. **Subreddit Reputation**: Consider the subreddit. Hobby, nature, and support subs (e.g., r/woodworking, r/aww) usually have high Zen scores. Controversial, political, or drama-focused subs (e.g., r/politics, r/PublicFreakout) should be scrutinized heavily and likely marked as rage bait unless exceptionally positive.
    2. **Content Tone**: Analyze the title and body snippet. Look for aggressive language, "us vs them" rhetoric, or clickbait designed to provoke outrage.
    
    Scoring:
    - Assign a "zenScore" from 0 to 100.
    - 100 = Perfectly Zen (Calm, educational, cute, neutral, constructive).
    - 0 = Pure Rage Bait (Toxic, divisive, shouting, public freakouts).
    
    Output Requirements:
    - Mark "isRageBait" as true if the zenScore is below ${threshold}.
    - Provide a very short "reason" (max 10 words).
  `;

  if (!config || !config.openRouterKey) {
      console.warn("OpenRouter key is missing in configuration.");
      return fallbackResult(postsPayload);
  }

  return analyzeWithOpenRouter(postsPayload, systemPrompt, config);
};

const analyzeWithOpenRouter = async (postsPayload: any[], systemPrompt: string, config: AIConfig): Promise<AnalysisResult[]> => {
    if (!config.openRouterKey) {
        return fallbackResult(postsPayload);
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.openRouterKey}`,
                "HTTP-Referer": window.location.origin, // Optional, for including your app on openrouter.ai rankings.
                "X-Title": "ZenReddit",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": config.openRouterModel || "google/gemini-2.0-flash-lite-preview-02-05:free",
                "messages": [
                    {
                        "role": "system",
                        "content": systemPrompt + "\n\nRETURN ONLY A JSON ARRAY matching the schema: [{id: string, isRageBait: boolean, zenScore: number, reason: string}]"
                    },
                    {
                        "role": "user",
                        "content": JSON.stringify(postsPayload)
                    }
                ],
                "response_format": { "type": "json_object" } 
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) return [];

        // Attempt to parse JSON from the content string (it might be wrapped in markdown blocks)
        const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedContent);

        // Handle case where model returns object wrapping the array (e.g. { "posts": [...] })
        if (Array.isArray(parsed)) {
            return parsed;
        } else if (parsed.items && Array.isArray(parsed.items)) {
            return parsed.items;
        } else {
             // Try to find the first array value in the object
             const values = Object.values(parsed);
             const foundArray = values.find(v => Array.isArray(v));
             if (foundArray) return foundArray as AnalysisResult[];
        }
        
        return [];

    } catch (error) {
        console.error("OpenRouter Analysis Failed:", error);
        return fallbackResult(postsPayload);
    }
}

const fallbackResult = (postsPayload: any[]): AnalysisResult[] => {
    return postsPayload.map(p => ({
        id: p.id,
        isRageBait: false,
        zenScore: 50,
        reason: "Analysis unavailable"
    }));
};