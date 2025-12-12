
import { RedditListing, RedditPost, RedditComment } from '../types';

const BASE_URL = 'https://www.reddit.com';

// Generate a random session ID to prevent Reddit from flagging all requests 
// from this client as the exact same "bot" session.
const SESSION_ID = Math.random().toString(36).substring(7);

const HEADERS = {
  'User-Agent': `web:zen-reddit:v1.0.0 (session-${SESSION_ID})`,
  'Accept': 'application/json'
};

// List of proxies to try in order.
// We rotate through them if one is blocked or down.
const PROXY_PROVIDERS = [
  // CodeTabs is often more reliable for Reddit JSON than corsproxy
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // Primary: corsproxy.io (Fast, but often 502s on /r/popular)
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  // Tertiary: AllOrigins (Often blocked by Reddit, but good fallback)
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // Quaternary: ThingProxy
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

/**
 * Shuffles the proxy list so we don't always hammer the same broken one first
 * if deployment causes a specific one to fail.
 */
const getRotatedProxies = () => {
  const proxies = [...PROXY_PROVIDERS];
  // Simple Fisher-Yates shuffle
  for (let i = proxies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
  }
  return proxies;
};

const fetchWithProxy = async (url: string) => {
  let lastError: Error | null = null;
  
  // Get a shuffled list of proxies to try
  const proxiesToTry = getRotatedProxies();

  for (const provider of proxiesToTry) {
    try {
      // Add cache buster to prevent sticky 502s from the proxy caching the error
      const separator = url.includes('?') ? '&' : '?';
      const urlWithCacheBuster = `${url}${separator}t=${Date.now()}`;
      
      const targetUrl = provider(urlWithCacheBuster);
      
      // Attempt fetch with headers
      const response = await fetch(targetUrl, {
        headers: HEADERS
      });

      // 429 is a Reddit-specific Rate Limit.
      if (response.status === 429) {
        console.warn('Reddit rate limit hit via proxy.');
      }

      if (!response.ok) {
        // If 502 (Bad Gateway), 503 (Service Unavailable), or 429, 
        // we throw an error here so the catch block triggers the NEXT proxy in the loop.
        throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
      }

      // Read text first to safely parse JSON and detect HTML error pages (soft blocks)
      const text = await response.text();
      
      try {
        const json = JSON.parse(text);
        
        // Reddit API specific error check (sometimes returns 200 OK but with JSON error)
        if (json.error) {
            throw new Error(`Reddit API Error: ${json.message || json.error}`);
        }
        
        return json;
      } catch (e) {
        // If parsing fails, it's likely an HTML error page from the proxy or Reddit blocking the IP
        throw new Error('Received invalid JSON data (likely HTML error page).');
      }

    } catch (error: any) {
      console.warn(`Proxy failed: ${error.message}. Trying next provider...`);
      lastError = error;
      // Continue to next proxy in loop
    }
  }

  throw lastError || new Error('All proxies failed. Reddit might be blocking requests from this network.');
};

export const fetchFeed = async (
  type: 'popular' | 'all' | 'subreddit',
  subreddit?: string,
  after: string | null = null,
  followedSubs: string[] = []
): Promise<{ posts: RedditPost[]; after: string | null }> => {
  let url = '';
  
  if (type === 'popular') {
    // Standard /r/popular feed
    url = `${BASE_URL}/r/popular/hot.json?limit=15&raw_json=1`;
  } else if (type === 'all') {
    // Standard /r/all feed
    url = `${BASE_URL}/r/all.json?limit=15&raw_json=1`;
  } else if (type === 'subreddit' && subreddit) {
    url = `${BASE_URL}/r/${subreddit}/hot.json?limit=15&raw_json=1`;
  }

  if (after) {
    url += `&after=${after}`;
  }

  try {
    const data = await fetchWithProxy(url);
    
    if (!data || !data.data || !data.data.children) {
        console.warn("Invalid Reddit Data Structure", data);
        return { posts: [], after: null };
    }

    return {
      posts: data.data.children.filter((child: any) => child.kind === 't3'), // Ensure we only get posts
      after: data.data.after,
    };
  } catch (error) {
    console.error("Failed to fetch feed", error);
    throw error;
  }
};

export const fetchComments = async (permalink: string): Promise<RedditComment[]> => {
  // Permalink usually starts with /r/..., we need to append .json
  const url = `${BASE_URL}${permalink.replace(/\/$/, '')}.json?raw_json=1`;
  
  try {
    const data = await fetchWithProxy(url);
    // The second item in the array is the comment listing
    if (Array.isArray(data) && data.length > 1) {
      return data[1].data.children.filter((c: any) => c.kind === 't1');
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch comments", error);
    return [];
  }
};

export const searchSubreddits = async (query: string): Promise<string[]> => {
  const url = `${BASE_URL}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=5&raw_json=1`;
  try {
    const data = await fetchWithProxy(url);
    if (!data || !data.data || !data.data.children) return [];
    return data.data.children.map((child: any) => child.data.display_name);
  } catch (error) {
    console.error("Search failed", error);
    return [];
  }
};
