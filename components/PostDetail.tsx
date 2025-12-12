import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { FilteredPost, RedditComment, RedditListing } from '../types';
import { fetchComments } from '../services/redditService';
import { X, ExternalLink, Loader2, ArrowBigUp, ChevronLeft, MinusSquare, PlusSquare, MessageSquare } from 'lucide-react';
import Hls from 'hls.js';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PostDetailProps {
  post: FilteredPost;
  onClose: () => void;
}

// Helper to extract image URLs from text
const extractMediaFromText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex) || [];
  
  return urls.filter(url => {
    // Clean URL (remove markdown parenthesis if present at end)
    const cleanUrl = url.replace(/[)]$/, '');
    return cleanUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) || 
           cleanUrl.includes('giphy.com/media') ||
           cleanUrl.includes('i.imgur.com');
  }).map(url => url.replace(/[)]$/, '')); // Return cleaned URLs
};

// Markdown Renderer Component
const MarkdownRenderer: React.FC<{ content: string }> = memo(({ content }) => {
  // Pre-process to fix common Reddit markdown quirks if necessary
  // For now, raw pass-through works surprisingly well with react-markdown
  
  return (
    <div className="prose prose-stone dark:prose-invert prose-sm max-w-none break-words leading-relaxed opacity-90">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
            // @ts-ignore
            a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />,
            // @ts-ignore
            img: ({node, ...props}) => <span className="hidden">Image hidden in markdown (shown in media grid)</span>, // Hide inline images in text to prevent dupes if we handle them separately, or let them render.
            // @ts-ignore
            table: ({node, ...props}) => <div className="overflow-x-auto my-2"><table {...props} className="table-auto border-collapse border border-stone-200 dark:border-stone-700 w-full" /></div>,
            // @ts-ignore
            th: ({node, ...props}) => <th {...props} className="border border-stone-200 dark:border-stone-700 px-2 py-1 bg-stone-100 dark:bg-stone-800" />,
            // @ts-ignore
            td: ({node, ...props}) => <td {...props} className="border border-stone-200 dark:border-stone-700 px-2 py-1" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

const CommentNode: React.FC<{ comment: RedditComment; depth?: number }> = memo(({ comment, depth = 0 }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState(3); // Start with 3
  const data = comment.data;
  
  // Skip if deleted
  if (data.author === '[deleted]') return null;

  const mediaUrls = useMemo(() => extractMediaFromText(data.body), [data.body]);

  // Extract replies safely
  const replies = useMemo(() => {
      return (data.replies && data.replies !== "" && data.replies.data) ? data.replies.data.children : [];
  }, [data.replies]);
  
  const hasReplies = replies.length > 0;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleReplies(prev => prev + 5); // Load 5 more at a time
  };

  const handleShowAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleReplies(replies.length);
  };

  return (
    <div className={`mt-3 ${depth > 0 ? 'ml-0 md:ml-4 pl-3 md:pl-4 border-l-2 border-stone-100 dark:border-stone-800' : ''}`}>
      <div className="flex flex-col">
        {/* Comment Header - Clickable to Collapse */}
        <div 
            onClick={toggleCollapse}
            className="flex items-center gap-2 mb-1.5 text-xs text-stone-500 dark:text-stone-400 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded py-1 -ml-1 pl-1 transition-colors select-none group"
        >
            <div className="text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">
                {collapsed ? <PlusSquare size={12} /> : <MinusSquare size={12} />}
            </div>
            <span className={`font-semibold text-stone-700 dark:text-stone-300 ${data.author === 'AutoModerator' ? 'text-green-600 dark:text-green-500' : ''}`}>
                {data.author}
            </span>
            <span className="text-[10px]">•</span>
            <span>{formatDistanceToNow(new Date(data.created_utc * 1000))} ago</span>
            <span className="text-[10px]">•</span>
            <div className="flex items-center">
                <ArrowBigUp size={12} className="mr-0.5"/>
                {data.score}
            </div>
            {collapsed && (
                <span className="text-stone-400 ml-2 italic text-[10px]">
                    {hasReplies ? `(${replies.length} replies)` : '(collapsed)'}
                </span>
            )}
        </div>

        {!collapsed && (
            <>
                {/* Comment Body with Markdown */}
                <div className="pl-1">
                    <MarkdownRenderer content={data.body} />
                </div>

                {/* Inline Media */}
                {mediaUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pl-1">
                        {mediaUrls.map((url, idx) => (
                            <div key={idx} className="relative rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 max-w-full md:max-w-md">
                                <img 
                                    src={url} 
                                    alt="Comment media" 
                                    className="max-h-60 object-contain w-auto"
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Recursive Replies */}
                {hasReplies && (
                    <div className="mt-1">
                        {replies.slice(0, visibleReplies).map((child) => {
                            if (child.kind === 't1') {
                                return <CommentNode key={child.data.id} comment={child as RedditComment} depth={depth + 1} />;
                            }
                            if (child.kind === 'more') {
                                // 'more' objects handling
                                return (
                                    <div key={child.data.id} className="mt-2 ml-4 text-xs text-stone-400 italic pl-3 border-l-2 border-transparent">
                                        <a 
                                            href={`https://reddit.com${comment.data.permalink}${child.data.id}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="hover:underline flex items-center gap-1"
                                        >
                                            <ExternalLink size={10} />
                                            Continue thread on Reddit
                                        </a>
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {replies.length > visibleReplies && (
                            <div className="mt-2 ml-2 flex items-center gap-2">
                                <button 
                                    onClick={handleShowMore}
                                    className="text-xs font-medium text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center gap-1.5 py-1 px-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                                >
                                    <MessageSquare size={12} />
                                    Show 5 more
                                </button>
                                {replies.length - visibleReplies > 5 && (
                                     <button 
                                        onClick={handleShowAll}
                                        className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 underline"
                                     >
                                        Show all ({replies.length - visibleReplies})
                                     </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
});

const PostDetail: React.FC<PostDetailProps> = ({ post, onClose }) => {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      const data = await fetchComments(post.permalink);
      setComments(data);
      setLoading(false);
    };
    loadComments();
  }, [post.permalink]);

  // Handle Video Playback with HLS (for sound)
  useEffect(() => {
    const video = post.secure_media?.reddit_video;
    if (!video || !videoRef.current) return;

    let hls: Hls | null = null;
    const videoEl = videoRef.current;

    // Prioritize HLS URL if available (this combines audio/video)
    if (Hls.isSupported() && video.hls_url) {
        hls = new Hls();
        hls.loadSource(video.hls_url);
        hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl') && video.hls_url) {
        // Native HLS support (Safari)
        videoEl.src = video.hls_url;
    } else {
        // Fallback to the MP4 (often silent on Reddit, but best effort fallback)
        videoEl.src = video.fallback_url;
    }

    return () => {
        if (hls) hls.destroy();
    };
  }, [post.secure_media]);

  const decodeHtml = (html: string | undefined | null) => {
    if (!html) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const renderMedia = () => {
    if (post.secure_media?.reddit_video) {
        return (
            <video 
                ref={videoRef}
                controls 
                className="w-full rounded-lg mb-4 bg-black max-h-[500px]" 
                playsInline
                poster={post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined}
            />
        )
    }
    if (post.url && post.url.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return (
        <img 
            src={post.url} 
            alt={post.title} 
            className="w-full rounded-lg mb-4 object-contain max-h-[600px] bg-stone-100 dark:bg-stone-900" 
        />
      );
    }
    // Simple link preview fallback
    if (post.url && !post.url.includes('reddit.com')) {
        return (
            <a href={post.url} target="_blank" rel="noreferrer" className="flex items-center p-4 bg-stone-100 dark:bg-stone-800 rounded-lg mb-4 text-blue-600 dark:text-blue-400 hover:underline break-all">
                <ExternalLink className="mr-2 shrink-0" size={16} />
                <span className="truncate">{post.url}</span>
            </a>
        )
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white md:bg-black/50 md:backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white dark:bg-stone-900 w-full md:max-w-4xl h-full md:h-[90vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-none md:border border-stone-200 dark:border-stone-700">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
             <button onClick={onClose} className="p-2 -ml-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors shrink-0 md:hidden">
                <ChevronLeft size={24} className="text-stone-800 dark:text-stone-200" />
             </button>
             
             <div className="flex flex-col min-w-0">
                 <span className="font-bold text-stone-800 dark:text-stone-200 truncate text-sm md:text-base">r/{post.subreddit}</span>
                 <span className="text-xs text-stone-500 dark:text-stone-400 truncate">u/{post.author}</span>
             </div>
          </div>

          <button onClick={onClose} className="hidden md:block p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors shrink-0">
            <X size={20} className="text-stone-600 dark:text-stone-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white dark:bg-stone-950">
          <h2 className="text-xl md:text-2xl font-semibold text-stone-900 dark:text-stone-100 mb-4 leading-tight">{decodeHtml(post.title)}</h2>
          
          {renderMedia()}

          {post.selftext && (
            <div className="mb-6">
                <MarkdownRenderer content={post.selftext} />
            </div>
          )}

          <div className="border-t border-stone-100 dark:border-stone-800 my-6"></div>

          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-medium text-stone-700 dark:text-stone-300">Comments</h3>
            <span className="text-xs px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500">{post.num_comments}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
          ) : (
            <div className="space-y-4 pb-12">
              {comments.map((comment) => (
                <CommentNode key={comment.data.id} comment={comment} />
              ))}
              {comments.length === 0 && (
                <p className="text-stone-400 italic text-center">No comments found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostDetail;