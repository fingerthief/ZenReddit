import { GoogleGenAI, Type } from "@google/genai";
import { RedditPostData, AIConfig } from "../types";

export interface AnalysisResult {
  id: string;
  isRageBait: boolean;
  zenScore: number;
  reason: string;
}

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzePostsForZen = async (posts: RedditPostData[], config?: AIConfig): Promise<AnalysisResult[]> => {
  if (posts.length === 0) return [];

  // Prepare a concise payload
  const postsPayload = posts.map(p => ({
    id: p.id,
    title: p.title,
    subreddit: p.subreddit,
    body_snippet: p.selftext ? p.selftext.substring(0, 500) : "No text content", 
  }));

  const threshold = config?.minZenScore ?? 50;

  const instructions = config?.customInstructions ? 
    `USER CUSTOM PREFERENCES (IMPORTANT): "${config.customInstructions}". Adjust your scoring and reasoning based on these preferences.` : "";

  const systemInstruction = `
    Analyze the following Reddit posts to curate a "Zen" feed. 
    Your goal is to strictly filter out rage bait, intentionally divisive politics, aggressive arguments, and content designed to induce anxiety or anger.
    
    ${instructions}

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

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: JSON.stringify(postsPayload),
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                isRageBait: { type: Type.BOOLEAN },
                zenScore: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ['id', 'isRageBait', 'zenScore', 'reason'],
            },
          },
        },
      });

      const text = response.text;
      if (!text) return fallbackResult(postsPayload);

      return JSON.parse(text) as AnalysisResult[];

  } catch (error) {
      console.error("Gemini Analysis Failed:", error);
      return fallbackResult(postsPayload);
  }
};

const fallbackResult = (postsPayload: any[]): AnalysisResult[] => {
    return postsPayload.map(p => ({
        id: p.id,
        isRageBait: false,
        zenScore: 50,
        reason: "Analysis unavailable"
    }));
};