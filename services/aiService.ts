
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

export const analyzeCommentsForZen = async (
  comments: RedditComment[], 
  config?: AIConfig,
  context?: { title: string; subreddit: string; selftext?: string }
): Promise<CommentAnalysis[]> => {
  const apiKey = config?.openRouterKey || process.env.API_KEY;
  if (!apiKey || comments.length === 0) return [];

  // Limit payload: Top 10-15 comments
  // Enhanced to include 'replies_context' to see how the conversation evolved
  const payload = comments.slice(0, 15).map(c => {
    let repliesContext: string[] = [];
    
    // Extract immediate reply snippets to provide conversation chain context
    if (c.data.replies && typeof c.data.replies !== 'string' && c.data.replies.data) {
        repliesContext = c.data.replies.data.children
            .filter((child: any) => child.kind === 't1')
            .slice(0, 3) // Check first 3 replies to gauge reaction
            .map((child: any) => `[${child.data.author}]: ${child.data.body.substring(0, 60)}`);
    }

    return {
      id: c.data.id,
      author: c.data.author,
      body: c.data.body.substring(0, 250),
      replies_context: repliesContext
    };
  });

  const model = config?.openRouterModel || 'meta-llama/llama-3-8b-instruct:free';

  const contextStr = context ? `
    SUBREDDIT: r/${context.subreddit}
    POST TITLE: "${context.title}"
    ${context.selftext ? `POST CONTEXT: "${context.selftext.substring(0, 200)}..."` : ''}
  ` : "Context: General Reddit Thread";

  const systemPrompt = `
    You are a highly nuanced moderator for a Zen community.
    Analyze the following Reddit comments for TOXICITY.

    ${contextStr}

    CRITICAL INSTRUCTIONS FOR CONTEXTUAL ANALYSIS:
    1. **Conversation Chain**: Look at the "replies_context". 
       - If replies are laughing ("lol", "lmao") or playing along, the comment is likely a JOKE/BANTER, even if it uses "edgy" language. DO NOT flag these.
       - If replies are angry or hurt, the comment might be toxic.
    2. **Dramatic vs Toxic**: 
       - Phrases like "I'm dying", "I hate you (jokingly)", "This is insane", or slang are NOT toxic.
       - Only flag content that is genuinely abusive, hateful, or intended to cause real harm/rage.
    3. **Subreddit Context**: If this is a gaming/meme sub, expect trash talk. If it's a support sub, be stricter.

    Return JSON: { "results": [{ "id": "string", "isToxic": boolean, "reason": "short string explanation" }] }
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
      console.warn("Comment analysis error", e);
      return [];
  }
};
