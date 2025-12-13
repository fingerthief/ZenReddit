
import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { FilteredPost, RedditComment, RedditListing } from '../types';
import { fetchComments } from '../services/redditService';
import { X, ExternalLink, Loader2, ArrowBigUp, ChevronLeft, ChevronRight, MinusSquare, PlusSquare, MessageSquare, Images } from 'lucide-react';
import Hls from 'hls.js';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PostDetailProps {
  post: FilteredPost;
  onClose: () => void;
  onNavigateSub?: (sub: string) => void;
  textSize: 'small' | 'medium' | 'large';
}

// Helper to extract image URLs from text
const extractMediaFromText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: string[] = text.match(urlRegex) || [];
  
  return urls.filter(url => {
    // Clean URL (remove markdown parenthesis if present at end)
    const cleanUrl = url.replace(/[)]$/, '');
    return cleanUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) || 
           cleanUrl.includes('giphy.com/media') ||
           cleanUrl.includes('i.imgur.com');
  }).map(url => url.replace(/[)]$/, '')); // Return cleaned URLs
};

// Markdown Renderer Component
const MarkdownRenderer: React.FC<{ content: string; onNavigateSub?: (sub: string) => void; textSize: 'small' | 'medium' | 'large' }> = memo(({ content, onNavigateSub, textSize }) => {
  const proseClass = {
      small: 'prose-sm',
      medium: 'prose-base',
      large: 'prose-lg'
  }[textSize];

  return (
    <div className={`prose prose-stone dark:prose-invert ${proseClass} max-w-none break-words leading-relaxed opacity-90`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
            // @ts-ignore
            a: ({node, href, ...props}) => {
                // Intercept internal reddit links (e.g., /r/funny or r/funny)
                const isSubLink = href?.match(/^(\/)?r\/([^/]+)/) || href?.match(/^https?:\/\/(www\.)?reddit\.com\/r\/([^/]+)/);
                
                if (isSubLink && onNavigateSub) {
                     // isSubLink[2] contains the subreddit name in both regex patterns
                     const subName = isSubLink[2];
                     return (
                        <a 
                            {...props} 
                            href={href} 
                            onClick={(e) => {
                                e.preventDefault();
                                onNavigateSub(subName);
                            }}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                        />
                     );
                }

                return <a {...props} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />
            },
            // @ts-ignore
            img: ({node, ...props}) => <span className="hidden">Image hidden in markdown (shown in media grid)</span>, 
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

// Gallery Component
const GalleryViewer: React.FC<{ items: { src: string; caption?: string; id: string | number }[] }> = ({ items }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < items.length - 1) {
       setCurrentIndex(curr => curr + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
       setCurrentIndex(curr => curr - 1);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentIndex > 0) setCurrentIndex(curr => curr - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentIndex < items.length - 1) setCurrentIndex(curr => curr + 1);
  };

  const currentItem = items[currentIndex];

  if (!currentItem) return null;

  return (
    <div 
        className="relative w-full bg-stone-100 dark:bg-stone-900 rounded-lg overflow-hidden mb-6 group select-none shadow-sm"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        {/* Main Image Container */}
        <div className="relative flex justify-center items-center min-h-[300px] md:min-h-[400px] bg-stone-100 dark:bg-stone-950">
             <img 
                key={currentItem.src} // Key forces re-render for clean transitions
                src={currentItem.src} 
                alt={currentItem.caption || `Image ${currentIndex + 1}`}
                className="max-h-[70vh] w-full object-contain animate-in fade-in duration-300"
                loading="eager"
            />
            
            {/* Desktop Hover Navigation Buttons */}
            {currentIndex > 0 && (
                <button 
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center transform hover:scale-110"
                    title="Previous Image"
                >
                    <ChevronLeft size={28} />
                </button>
            )}
            
            {currentIndex < items.length - 1 && (
                <button 
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center transform hover:scale-110"
                    title="Next Image"
                >
                    <ChevronRight size={28} />
                </button>
            )}
        </div>

        {/* Caption Overlay */}
        {currentItem.caption && (
            <div className="bg-white dark:bg-stone-900 p-3 text-sm text-stone-600 dark:text-stone-300 border-t border-stone-100 dark:border-stone-800">
                {currentItem.caption}
            </div>
        )}
        
        {/* Image Counter Badge */}
        <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5 shadow-sm">
            <Images size={12} />
            {currentIndex + 1} / {items.length}
        </div>

        {/* Mobile Dots Indicator */}
        {items.length > 1 && items.length <= 10 && (
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden pointer-events-none">
                {items.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-1.5 h-1.5 rounded-full transition-all shadow-sm ${idx === currentIndex ? 'bg-white scale-125' : 'bg-white/40'}`}
                    />
                ))}
             </div>
        )}
    </div>
  );
};

const CommentNode: React.FC<{ comment: RedditComment; depth?: number; onNavigateSub?: (sub: string) => void; textSize: 'small' | 'medium' | 'large' }> = memo(({ comment, depth = 0, onNavigateSub, textSize }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [visibleReplies, setVisibleReplies] = useState(3); // Start with 3
  const data = comment.data;
  
  // Skip if deleted
  if (data.author === '[deleted]') return null;

  const mediaUrls = useMemo(() => extractMediaFromText(data.body), [data.body]);

  // Extract replies safely
  const replies = useMemo(() => {
      // Check if replies is an object (RedditListing) and not an empty string
      return (data.replies && typeof data.replies !== 'string' && data.replies.data) ? data.replies.data.children : [];
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
                    <MarkdownRenderer content={data.body} onNavigateSub={onNavigateSub} textSize={textSize} />
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
                                return <CommentNode key={child.data.id} comment={child as RedditComment} depth={depth + 1} onNavigateSub={onNavigateSub} textSize={textSize} />;
                            }
                            if (child.kind === 'more') {
                                // 'more' objects handling
                                return (
                                    <div key={child.data.id} className="mt-2 ml-4 text-xs text-stone-400 italic pl-3 border-l-2 border-transparent">
                                        <a 
                                            href={`https://reddit.com${comment.data.permalink || ''}${child.data.id}`} 
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

const PostDetail: React.FC<PostDetailProps> = ({ post, onClose, onNavigateSub, textSize }) => {
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
    // 1. Video
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

    // 2. Reddit Native Gallery
    if (post.is_gallery && post.gallery_data && post.media_metadata) {
        const galleryItems = post.gallery_data.items.map((item) => {
            const media = post.media_metadata![item.media_id];
            // 's' is the source object. 'u' is url, 'gif' is gif url.
            // With raw_json=1, we don't need to decode entities usually, but safety check doesn't hurt.
            let src = media?.s?.u || media?.s?.gif;
            if (!src) return null;
            
            src = src.replace(/&amp;/g, '&');

            return {
                id: item.id,
                src,
                caption: item.caption
            };
        }).filter((i): i is { id: number; src: string; caption: string | undefined; } => i !== null);

        if (galleryItems.length > 0) {
            return <GalleryViewer items={galleryItems} />;
        }
    }

    // 3. Image via URL extension (standard direct links)
    if (post.url && post.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return (
        <img 
            src={post.url} 
            alt={post.title} 
            className="w-full rounded-lg mb-4 object-contain max-h-[600px] bg-stone-100 dark:bg-stone-900" 
        />
      );
    }

    // 4. Fallback: Check Preview Images (High Res)
    // This catches Imgur Albums (Cover), External images without extensions, etc.
    if (post.preview?.images?.[0]?.source?.url) {
        const src = post.preview.images[0].source.url.replace(/&amp;/g, '&');
        const isImgurAlbum = post.url.includes('imgur.com/a/') || post.url.includes('imgur.com/gallery/');

        return (
            <div className="relative mb-4 group inline-block w-full">
                 <img 
                    src={src} 
                    alt={post.title} 
                    className="w-full rounded-lg object-contain max-h-[600px] bg-stone-100 dark:bg-stone-900" 
                 />
                 {isImgurAlbum && (
                    <a 
                        href={post.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute bottom-4 right-4 bg-stone-900/80 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors backdrop-blur-sm shadow-lg"
                    >
                        <ExternalLink size={14} />
                        View Full Album on Imgur
                    </a>
                 )}
            </div>
        )
    }

    // 5. Link Fallback
    if (post.url && !post.url.includes('reddit.com')) {
        return (
            <a href={post.url} target="_blank" rel="noreferrer" className="flex items-center p-4 bg-stone-100 dark:bg-stone-800 rounded-lg mb-4 text-blue-600 dark:text-blue-400 hover:underline break-all transition-colors hover:bg-stone-200 dark:hover:bg-stone-700">
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
                 <button 
                    onClick={() => onNavigateSub && onNavigateSub(post.subreddit)}
                    className="font-bold text-stone-800 dark:text-stone-200 truncate text-sm md:text-base hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
                 >
                    r/{post.subreddit}
                 </button>
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
                <MarkdownRenderer content={post.selftext} onNavigateSub={onNavigateSub} textSize={textSize} />
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
                <CommentNode key={comment.data.id} comment={comment} onNavigateSub={onNavigateSub} textSize={textSize} />
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
