import { RedditListing, RedditPost, RedditComment } from '../types';

const BASE_URL = 'https://www.reddit.com';
const PROXY_URL = 'https://corsproxy.io/?';

// Helper to handle API errors roughly
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limited by Reddit. Please wait a moment.');
    }
    throw new Error(`Reddit API Error: ${response.statusText}`);
  }
  return response.json();
};

const fetchWithProxy = async (url: string) => {
  // We use corsproxy.io to bypass Reddit's CORS restrictions for this client-side app
  const targetUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
  return handleResponse(await fetch(targetUrl));
};

export const fetchFeed = async (
  type: 'home' | 'all' | 'subreddit',
  subreddit?: string,
  after: string | null = null,
  followedSubs: string[] = []
): Promise<{ posts: RedditPost[]; after: string | null }> => {
  let url = '';
  
  if (type === 'home') {
    if (followedSubs.length === 0) {
      // Fallback to popular if no subs followed
      url = `${BASE_URL}/r/popular.json?limit=15`;
    } else {
      // Multireddit for home feed
      const subsString = followedSubs.join('+');
      url = `${BASE_URL}/r/${subsString}/hot.json?limit=15`;
    }
  } else if (type === 'all') {
    url = `${BASE_URL}/r/all.json?limit=15`;
  } else if (type === 'subreddit' && subreddit) {
    url = `${BASE_URL}/r/${subreddit}/hot.json?limit=15`;
  }

  if (after) {
    url += `&after=${after}`;
  }

  try {
    const data = await fetchWithProxy(url);
    return {
      posts: data.data.children.filter((child: any) => child.kind === 't3'), // Ensure we only get posts
      after: data.data.after,
    };
  } catch (error) {
    console.error("Failed to fetch feed", error);
    return { posts: [], after: null };
  }
};

export const fetchComments = async (permalink: string): Promise<RedditComment[]> => {
  // Permalink usually starts with /r/..., we need to append .json
  const url = `${BASE_URL}${permalink.replace(/\/$/, '')}.json`;
  
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
  const url = `${BASE_URL}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=5`;
  try {
    const data = await fetchWithProxy(url);
    return data.data.children.map((child: any) => child.data.display_name);
  } catch (error) {
    console.error("Search failed", error);
    return [];
  }
};
