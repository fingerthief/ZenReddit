
import { RedditPostData, AIConfig, RedditComment, CommentAnalysis, FactCheckResult } from "../types";

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

const DEFAULT_MODEL = 'meta-llama/llama-3-8b-instruct:free';

// --- Helper for OpenRouter API Calls ---

const callOpenRouter = async (
    apiKey: string,
    model: string,
    systemPrompt: string,
    userContent: string,
    jsonMode: boolean = true
) => {
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
                    { role: "user", content: userContent }
                ],
                response_format: jsonMode ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) throw new Error("No content returned from AI");

        return content;
    } catch (error) {
        console.error("OpenRouter Call Failed:", error);
        throw error;
    }
};

// --- Post Analysis ---

export const analyzePostsForZen = async (posts: RedditPostData[], config?: AIConfig): Promise<AnalysisResult[]> => {
  if (posts.length === 0) return [];

  // Use config key. If no key is provided, we cannot analyze.
  const apiKey = config?.openRouterKey;

  if (!apiKey) {
      return fallbackResult(posts);
  }

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

  try {
      const content = await callOpenRouter(
          apiKey,
          config?.openRouterModel || DEFAULT_MODEL,
          systemPrompt,
          JSON.stringify(postsPayload)
      );

      let parsed;
      try {
          parsed = JSON.parse(cleanJsonString(content));
      } catch (e) {
          console.warn("Invalid JSON from AI", content);
          return fallbackResult(posts);
      }

      // Handle both { results: [...] } and direct array [...]
      const results = Array.isArray(parsed) ? parsed : (parsed.results || parsed.data);

      if (!Array.isArray(results)) {
           console.warn("AI response did not contain an array", parsed);
           return fallbackResult(posts);
      }

      // Map back to ensure IDs exist
      return results.map((r: any) => ({
          id: r.id,
          isRageBait: typeof r.isRageBait === 'boolean' ? r.isRageBait : (r.zenScore < threshold),
          zenScore: typeof r.zenScore === 'number' ? r.zenScore : 50,
          reason: r.reason || "AI analysis"
      }));

  } catch (error) {
      // Quietly fail to fallback
      return fallbackResult(posts);
  }
};

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
  if (comments.length === 0 || !config?.openRouterKey) return [];

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
    1. **Toxicity**: Flag genuine abuse, hate, or harm. Ignore friendly banter.
    2. **Fact Checkability**: Determine if the comment contains verifiable factual claims (statistics, historical events, science, news).
       - Set "isFactCheckable": true if it contains checkable facts.
       - Set "isFactCheckable": false if it is opinion, anecdote, or joke.

    Return JSON: { "results": [{ "id": "string", "isToxic": boolean, "reason": "string", "isFactCheckable": boolean }] }
  `;

  try {
      const content = await callOpenRouter(
          config.openRouterKey,
          config.openRouterModel || DEFAULT_MODEL,
          systemPrompt,
          JSON.stringify(payload)
      );

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
      console.warn("Comment analysis error", e);
      return [];
  }
};

// --- Fact Checking ---

export const factCheckComment = async (
    commentBody: string, 
    subreddit: string,
    config: AIConfig
): Promise<FactCheckResult> => {
    
    // Require OpenRouter Key
    if (!config?.openRouterKey) {
        return {
            verdict: 'Unverified',
            explanation: "OpenRouter API Key required for fact checking.",
            sources: []
        };
    }

    const systemPrompt = `
        You are an expert fact-checker.
        Your task is to verify the claims in a Reddit comment.
        
        Analyze the text based on your internal knowledge base.
        If the model you are using supports internet access, use it.
        
        Return a JSON object matching this structure:
        {
          "verdict": "True" | "False" | "Misleading" | "Unverified" | "Opinion",
          "explanation": "A concise 2-sentence explanation of why.",
          "sources": [
            { "title": "Source Name", "uri": "URL or Description" }
          ]
        }
        
        If you cannot cite specific URLs, cite the entity or publication (e.g., "NASA Reports", "The New York Times").
        If the comment is pure opinion and cannot be fact-checked, return "Opinion".
    `;

    const userPrompt = `
        Subreddit: r/${subreddit}
        Comment: "${commentBody.substring(0, 1000)}"
    `;

    try {
        const content = await callOpenRouter(
            config.openRouterKey,
            config.openRouterModel || DEFAULT_MODEL,
            systemPrompt,
            userPrompt
        );

        const parsed = JSON.parse(cleanJsonString(content));
        
        // Sanitize result
        let verdict: FactCheckResult['verdict'] = 'Unverified';
        const rawVerdict = parsed.verdict?.toLowerCase() || '';
        
        if (rawVerdict.includes('true')) verdict = 'True';
        else if (rawVerdict.includes('false')) verdict = 'False';
        else if (rawVerdict.includes('mislead')) verdict = 'Misleading';
        else if (rawVerdict.includes('opinion')) verdict = 'Opinion';
        else if (rawVerdict.includes('unverified')) verdict = 'Unverified';

        return {
            verdict,
            explanation: parsed.explanation || "No explanation provided.",
            sources: Array.isArray(parsed.sources) ? parsed.sources : []
        };

    } catch (error) {
        console.error("Fact Check Failed:", error);
        return {
            verdict: 'Unverified',
            explanation: "AI analysis failed to process this request.",
            sources: []
        };
    }
}
