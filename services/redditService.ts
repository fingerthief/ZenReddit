
import { RedditPost, RedditComment, RedditMore, SortOption, TopTimeOption, SubredditAbout, RedditPostData } from '../types';

const BASE_URL = 'https://www.reddit.com';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const MAX_CONCURRENT_REQUESTS = 3; 

// --- Caching System ---

interface CacheEntry {
  data: any;
  timestamp: number;
  expiry: number;
}

const apiCache = new Map<string, CacheEntry>();

// Cache durations in milliseconds
const TTL = {
  FEED: 5 * 60 * 1000,      // 5 minutes for feeds
  COMMENTS: 10 * 60 * 1000, // 10 minutes for comment threads
  ABOUT: 24 * 60 * 60 * 1000, // 24 hours for subreddit sidebar/icons
  SEARCH: 10 * 60 * 1000,    // 10 minutes for search results
  DEFAULT: 2 * 60 * 1000     // 2 minutes default
};

const getCacheTTL = (url: string): number => {
  if (url.includes('/about.json')) return TTL.ABOUT;
  if (url.includes('/comments/')) return TTL.COMMENTS;
  if (url.includes('/search.json')) return TTL.SEARCH;
  if (url.includes('/r/') || url.includes('popular') || url.includes('all')) return TTL.FEED;
  return TTL.DEFAULT;
};

// Generate a random session ID for user agent consistency
const SESSION_ID = Math.random().toString(36).substring(7);

const HEADERS = {
  'User-Agent': `web:zen-reddit:v1.0.0 (session-${SESSION_ID})`,
  'Accept': 'application/json'
};

// --- Proxy Management ---

const PROXY_PROVIDERS = [
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// Helper to shuffle proxies for rotation
const getShuffledProxies = (method: string = 'GET') => {
  let proxies = [...PROXY_PROVIDERS];
  if (method === 'POST') {
      return [
          (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
      ];
  }
  for (let i = proxies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [proxies[i], proxies[j]] = [proxies[j], proxies[i]];
  }
  return proxies;
};

// --- Rate Limiting & Queueing Utilities ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;

  constructor(private maxConcurrent: number) {}

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        this.activeCount++;
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.next();
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private next() {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const task = this.queue.shift();
      task?.();
    }
  }
}

const globalRequestQueue = new RequestQueue(MAX_CONCURRENT_REQUESTS);

// --- Fetch Implementation ---

const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            ...options,
            signal: options.signal || controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

const fetchWithProxy = async (url: string, options?: RequestInit, skipCache: boolean = false) => {
  // 1. Check Cache (GET requests only)
  const isGet = !options?.method || options.method === 'GET';
  
  if (isGet && !skipCache) {
    const cached = apiCache.get(url);
    if (cached && Date.now() < cached.expiry) {
      // Return a deep copy to prevent mutation of cached data
      return JSON.parse(JSON.stringify(cached.data)); 
    }
  }

  // 2. Perform Network Request via Queue
  return globalRequestQueue.add(async () => {
    let lastError: Error | null = null;
    const method = options?.method || 'GET';
    const proxiesToTry = getShuffledProxies(method);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const provider = proxiesToTry[attempt % proxiesToTry.length];
      
      try {
        const separator = url.includes('?') ? '&' : '?';
        // Cache buster only used if skipping internal cache to force fresh proxy fetch
        const cbParam = skipCache ? `${separator}cb=${Date.now()}` : '';
        const targetUrl = provider(url + cbParam);
        
        if (attempt > 0) {
           const backoff = 1000 * Math.pow(2, attempt) + (Math.random() * 500);
           await wait(backoff);
        }

        const response = await fetchWithTimeout(targetUrl, {
          ...options,
          headers: {
              ...HEADERS,
              ...options?.headers
          }
        });

        if (response.status === 429) {
          console.warn(`Rate limit hit (429) on proxy ${attempt}. Retrying...`);
          throw new Error('RateLimit');
        }

        if (response.status >= 500) {
           throw new Error(`Server Error: ${response.status}`);
        }

        if (!response.ok) {
          if (response.status === 403 || response.status === 404) {
             const error: any = new Error(`Reddit Error: ${response.status}`);
             error.status = response.status;
             throw error;
          }
          throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        
        try {
          const json = JSON.parse(text);
          if (json.error) throw new Error(`Reddit API Error: ${json.message || json.error}`);
          
          // 3. Save to Cache
          if (isGet) {
            apiCache.set(url, {
              data: json,
              timestamp: Date.now(),
              expiry: Date.now() + getCacheTTL(url)
            });
            
            // Limit cache size (LRU-ish: delete oldest if too big)
            if (apiCache.size > 100) {
                const oldestKey = apiCache.keys().next().value;
                if (oldestKey) apiCache.delete(oldestKey);
            }
          }

          return json;
        } catch (e) {
          throw new Error('Received invalid JSON data (likely HTML error page).');
        }

      } catch (error: any) {
        if (error.message.includes('Reddit Error') || error.status === 403 || error.status === 404) {
             throw error;
        }
        console.warn(`Attempt ${attempt + 1} failed: ${error.message}`);
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to connect to Reddit. Please try again later.');
  });
};

// --- API Methods ---

export const fetchFeed = async (
  type: 'popular' | 'all' | 'subreddit' | 'search',
  subreddit?: string,
  after: string | null = null,
  followedSubs: string[] = [],
  searchQuery?: string,
  sort: SortOption = 'hot',
  time: TopTimeOption = 'day',
  limit: number = 25,
  skipCache: boolean = false
): Promise<{ posts: RedditPost[]; after: string | null }> => {
  let url = '';
  
  if (type === 'search' && searchQuery) {
    const searchSort = sort === 'rising' ? 'relevance' : sort;
    
    if (subreddit) {
        url = `${BASE_URL}/r/${subreddit}/search.json?q=${encodeURIComponent(searchQuery)}&restrict_sr=on&sort=${searchSort}&limit=${limit}&raw_json=1`;
    } else {
        url = `${BASE_URL}/search.json?q=${encodeURIComponent(searchQuery)}&sort=${searchSort}&limit=${limit}&raw_json=1`;
    }

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
    const data = await fetchWithProxy(url, undefined, skipCache);
    
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

export const fetchComments = async (permalink: string): Promise<(RedditComment | RedditMore)[]> => {
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

export const fetchPostByPermalink = async (permalink: string): Promise<RedditPostData | null> => {
  const url = `${BASE_URL}${permalink.replace(/\/$/, '')}.json?raw_json=1`;
  try {
    const data = await fetchWithProxy(url);
    // Reddit API returns an array: [Listing(Post), Listing(Comments)]
    if (Array.isArray(data) && data.length > 0) {
      const postChildren = data[0].data?.children;
      if (postChildren && postChildren.length > 0 && postChildren[0].kind === 't3') {
        return postChildren[0].data;
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch specific post", error);
    return null;
  }
};

export const fetchMoreChildren = async (linkId: string, children: string[]): Promise<any[]> => {
    // POST requests are not cached
    const chunkSize = 20;
    const chunks = [];
    for (let i = 0; i < children.length; i += chunkSize) {
        chunks.push(children.slice(i, i + chunkSize));
    }

    const results = await Promise.all(chunks.map(async (chunk) => {
        const url = `${BASE_URL}/api/morechildren.json`;
        const formData = new URLSearchParams();
        formData.append('link_id', linkId);
        formData.append('children', chunk.join(','));
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
            console.warn("Failed to fetch specific chunk of children", error);
            return [];
        }
    }));

    return results.flat();
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

export const fetchSubredditAbout = async (subreddit: string): Promise<SubredditAbout | null> => {
  const url = `${BASE_URL}/r/${subreddit}/about.json?raw_json=1`;
  try {
    const data = await fetchWithProxy(url);
    if (data && data.data) {
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch subreddit details", error);
    return null;
  }
};
