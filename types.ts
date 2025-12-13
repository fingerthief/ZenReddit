
// Reddit API Types

export interface RedditPostData {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  url: string;
  domain?: string;
  thumbnail: string;
  preview?: {
    images: {
      source: { url: string; width: number; height: number };
      resolutions: { url: string; width: number; height: number }[];
    }[];
    reddit_video_preview?: {
        fallback_url: string;
        hls_url?: string;
        is_gif?: boolean;
    };
  };
  is_video: boolean;
  secure_media?: {
    reddit_video?: {
      fallback_url: string;
      hls_url?: string;
    };
  };
  is_gallery?: boolean;
  media_metadata?: Record<string, any>;
  gallery_data?: {
    items: {
      media_id: string;
      id: number;
      caption?: string;
    }[];
  };
}

export interface RedditPost {
  kind: 't3';
  data: RedditPostData;
}

export interface RedditMore {
  kind: 'more';
  data: {
    count: number;
    name: string;
    id: string;
    parent_id: string;
    depth: number;
    children: string[];
  }
}

export interface RedditListing {
  kind: 'Listing';
  data: {
    after: string | null;
    children: (RedditPost | RedditComment | RedditMore)[];
  };
}

export interface RedditCommentData {
  id: string;
  author: string;
  body: string;
  body_html?: string;
  score: number;
  created_utc: number;
  replies?: RedditListing | ""; // Reddit API returns empty string for no replies sometimes
  permalink?: string;
}

export interface RedditComment {
  kind: 't1';
  data: RedditCommentData;
}

// App State Types

export interface FilteredPost extends RedditPostData {
  isRageBait?: boolean;
  zenReason?: string;
  zenScore?: number; // 0-100, where 100 is pure zen, 0 is pure rage
}

export type FeedType = 'popular' | 'all' | 'subreddit' | 'search';

export interface SubredditSubscription {
  name: string;
  icon?: string;
}

export interface GalleryItem {
  src: string;
  caption?: string;
  id?: string | number;
  type?: 'image' | 'video';
  videoSources?: {
    hls?: string;
    mp4?: string;
  };
}

// Sorting Types
export type SortOption = 'hot' | 'new' | 'top' | 'rising';
export type TopTimeOption = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

// AI Configuration Types
export type AIProvider = 'openrouter';

export interface AIConfig {
  provider: AIProvider;
  openRouterKey?: string;
  openRouterModel?: string;
  minZenScore?: number; // 0-100, threshold for filtering
  customInstructions?: string;
}

export interface CachedAnalysis {
  id: string;
  isRageBait: boolean;
  zenScore: number;
  reason: string;
  timestamp: number;
}
