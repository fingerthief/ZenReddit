
import { RedditPost, RedditComment, SortOption, TopTimeOption } from '../types';

const BASE_URL = 'https://www.reddit.com';
const TIMEOUT_MS = 10000;

// Generate a random session ID to prevent Reddit from flagging all requests 
// from this client as the exact same "bot" session.
const SESSION_ID = Math.random().toString(36).substring(7);

const HEADERS = {
  'User-Agent': `web:zen-reddit:v1.0.0 (session-${SESSION_ID})`,
  'Accept': 'application/json'
};

// List of proxies to try in order.
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

const getRotatedProxies = (method: string = 'GET') => {
  let proxies = [...PROXY_PROVIDERS];
  // If POST, filter out proxies known to be GET-only or unreliable with POST
  if (method === 'POST') {
      return [
          (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
      ];
  }
  // Simple Fisher-Yates shuffle to distribute load
  for (let i = proxies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
  }
  return proxies;
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

const fetchWithProxy = async (url: string, options?: RequestInit) => {
  let lastError: Error | null = null;
  const method = options?.method || 'GET';
  const proxiesToTry = getRotatedProxies(method);

  for (const provider of proxiesToTry) {
    try {
      const separator = url.includes('?') ? '&' : '?';
      const urlWithCacheBuster = `${url}${separator}cb=${Date.now()}`;
      const targetUrl = provider(urlWithCacheBuster);
      
      const response = await fetchWithTimeout(targetUrl, {
        ...options,
        headers: {
            ...HEADERS,
            ...options?.headers
        }
      });

      if (response.status === 429) {
        console.warn('Reddit rate limit hit via proxy.');
        continue; // Try next proxy
      }

      if (!response.ok) {
        // 403/404 from Reddit usually means private sub or blocked content, proxy works but Reddit refused
        if (response.status === 403 || response.status === 404) {
            throw new Error(`Reddit Error: ${response.status}`);
        }
        throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      
      try {
        const json = JSON.parse(text);
        if (json.error) throw new Error(`Reddit API Error: ${json.message || json.error}`);
        return json;
      } catch (e) {
        throw new Error('Received invalid JSON data.');
      }

    } catch (error: any) {
      // Don't retry if it's a specific Reddit logic error (like subreddit not found)
      if (error.message.includes('Reddit Error')) throw error;
      
      console.warn(`Proxy failed: ${error.message}.`);
      lastError = error;
    }
  }

  throw lastError || new Error('Connection failed. Please check your internet or try again later.');
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
      return data[1].data.children; 
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
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
    return [];
  }
};
