
import { RedditListing, RedditPost, RedditComment, SortOption, TopTimeOption } from '../types';

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
  // CodeTabs is often more reliable for Reddit JSON than corsproxy (GET ONLY)
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // Primary: corsproxy.io (Fast, supports POST)
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  // Tertiary: AllOrigins (Often blocked by Reddit, GET ONLY)
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // Quaternary: ThingProxy (GET ONLY)
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

/**
 * Shuffles the proxy list so we don't always hammer the same broken one first
 * if deployment causes a specific one to fail.
 */
const getRotatedProxies = (method: string = 'GET') => {
  let proxies = [...PROXY_PROVIDERS];
  
  // If POST, filter out proxies known to be GET-only or unreliable with POST
  if (method === 'POST') {
      // corsproxy.io is the only reliable one for POST in this list
      return [
          (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
      ];
  }

  // Simple Fisher-Yates shuffle
  for (let i = proxies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
  }
  return proxies;
};

const fetchWithProxy = async (url: string, options?: RequestInit) => {
  let lastError: Error | null = null;
  
  const method = options?.method || 'GET';
  
  // Get a shuffled list of proxies to try
  const proxiesToTry = getRotatedProxies(method);

  for (const provider of proxiesToTry) {
    try {
      // Add cache buster to prevent sticky 502s from the proxy caching the error
      const separator = url.includes('?') ? '&' : '?';
      const urlWithCacheBuster = `${url}${separator}cb=${Date.now()}`;
      
      const targetUrl = provider(urlWithCacheBuster);
      
      // Attempt fetch with headers
      const response = await fetch(targetUrl, {
        ...options,
        headers: {
            ...HEADERS,
            ...options?.headers
        }
      });

      // 429 is a Reddit-specific Rate Limit.
      if (response.status === 429) {
        console.warn('Reddit rate limit hit via proxy.');
      }

      if (!response.ok) {
        throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      
      try {
        const json = JSON.parse(text);
        
        if (json.error) {
            throw new Error(`Reddit API Error: ${json.message || json.error}`);
        }
        
        return json;
      } catch (e) {
        throw new Error('Received invalid JSON data (likely HTML error page).');
      }

    } catch (error: any) {
      console.warn(`Proxy failed: ${error.message}. Trying next provider...`);
      lastError = error;
    }
  }

  throw lastError || new Error('All proxies failed. Reddit might be blocking requests from this network.');
};

export const fetchFeed = async (
  type: 'popular' | 'all' | 'subreddit' | 'search',
  subreddit?: string,
  after: string | null = null,
  followedSubs: string[] = [],
  searchQuery?: string,
  sort: SortOption = 'hot',
  time: TopTimeOption = 'day',
  limit: number = 25
): Promise<{ posts: RedditPost[]; after: string | null }> => {
  let url = '';
  
  if (type === 'search' && searchQuery) {
    const searchSort = sort === 'rising' ? 'relevance' : sort;
    url = `${BASE_URL}/search.json?q=${encodeURIComponent(searchQuery)}&sort=${searchSort}&limit=${limit}&raw_json=1`;
  } else {
    let path = '';
    if (type === 'popular') path = '/r/popular';
    else if (type === 'all') path = '/r/all';
    else if (type === 'subreddit' && subreddit) path = `/r/${subreddit}`;
    
    url = `${BASE_URL}${path}/${sort}.json?limit=${limit}&raw_json=1`;
  }

  if (sort === 'top') {
    url += `&t=${time}`;
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
      posts: data.data.children.filter((child: any) => child.kind === 't3'), 
      after: data.data.after,
    };
  } catch (error) {
    console.error("Failed to fetch feed", error);
    throw error;
  }
};

export const fetchComments = async (permalink: string): Promise<RedditComment[]> => {
  const url = `${BASE_URL}${permalink.replace(/\/$/, '')}.json?raw_json=1`;
  
  try {
    const data = await fetchWithProxy(url);
    if (Array.isArray(data) && data.length > 1) {
      return data[1].data.children; // Returns everything including 'more' objects
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch comments", error);
    return [];
  }
};

export const fetchMoreChildren = async (linkId: string, children: string[]): Promise<any[]> => {
    const url = `${BASE_URL}/api/morechildren.json`;
    
    const formData = new URLSearchParams();
    formData.append('link_id', linkId);
    formData.append('children', children.join(','));
    formData.append('api_type', 'json');

    try {
        const data = await fetchWithProxy(url, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        if (data && data.json && data.json.data && data.json.data.things) {
            return data.json.data.things;
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch more children", error);
        throw error;
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
