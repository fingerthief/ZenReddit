
import { RedditPostData, AIConfig, RedditComment, CommentAnalysis } from "../types";

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

export const analyzePostsForZen = async (posts: RedditPostData[], config?: AIConfig): Promise<AnalysisResult[]> => {
  if (posts.length === 0) return [];

  const apiKey = config?.openRouterKey || process.env.API_KEY;
  if (!apiKey) return fallbackResult(posts);

  // Minimized payload
  const postsPayload = posts.map(p => ({
    id: p.id,
    t: p.title, // shortened key
    s: p.subreddit,
    b: p.selftext ? p.selftext.substring(0, 200) : "", // shortened body
  }));

  const threshold = config?.minZenScore ?? 50;
  const model = config?.openRouterModel || 'meta-llama/llama-3-8b-instruct:free';
  
  const customPrompt = config?.customInstructions ? 
    `USER PREF: "${config.customInstructions}".` : "";

  // Highly optimized prompt to save tokens
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
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(postsPayload) }
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
          return fallbackResult(posts);
      }

      const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data);

      if (!Array.isArray(results)) return fallbackResult(posts);

      return results.map((r: any) => ({
          id: r.id,
          isRageBait: typeof r.isRageBait === 'boolean' ? r.isRageBait : (r.zenScore < threshold),
          zenScore: typeof r.zenScore === 'number' ? r.zenScore : 50,
          reason: r.reason || "AI analysis"
      }));

  } catch (error) {
      console.error("AI Analysis Failed:", error);
      return fallbackResult(posts);
  }
};

const fallbackResult = (posts: RedditPostData[]): AnalysisResult[] => {
    return posts.map(p => ({
        id: p.id,
        isRageBait: false,
        zenScore: 50,
        reason: "Analysis unavailable"
    }));
};

// --- Comment Analysis ---

export const analyzeCommentsForZen = async (comments: RedditComment[], config?: AIConfig): Promise<CommentAnalysis[]> => {
  const apiKey = config?.openRouterKey || process.env.API_KEY;
  if (!apiKey || comments.length === 0) return [];

  // Limit payload: Top 10 comments only
  const payload = comments.slice(0, 10).map(c => ({
    id: c.data.id,
    a: c.data.author,
    b: c.data.body.substring(0, 150)
  }));

  const model = config?.openRouterModel || 'meta-llama/llama-3-8b-instruct:free';

  const systemPrompt = `
    Analyze comments. Flag hostile, toxic, rage-bait.
    Return JSON: { "results": [{ "id": "string", "isToxic": boolean, "reason": "short string" }] }
  `;

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
          model: model,
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
              reason: r.reason
          }));
      }
      return [];
  } catch (e) {
      return [];
  }
};
