
import React, { useEffect, useState, useRef, useMemo, memo, useContext, useCallback } from 'react';
import { FilteredPost, RedditComment, RedditListing, CommentAnalysis, AIConfig } from '../types';
import { fetchComments, fetchMoreChildren } from '../services/redditService';
import { analyzeCommentsForZen } from '../services/aiService';
import { X, ExternalLink, Loader2, ArrowBigUp, ChevronLeft, ChevronRight, ChevronDown, MessageSquare, Images, Plus, MoreHorizontal, ShieldAlert, Eye, Captions, CornerDownRight } from 'lucide-react';
import Hls from 'hls.js';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ScanningVisualizer from './ScanningVisualizer';
import LazyRender from './LazyRender';

interface PostDetailProps {
  post: FilteredPost;
  onClose: () => void;
  onNavigateSub?: (sub: string) => void;
  textSize: 'small' | 'medium' | 'large';
  aiConfig: AIConfig;
  onCommentsBlocked: (count: number) => void;
}

// Context to persist comment state (like collapsed status) even when virtualized (unmounted)
const CommentContext = React.createContext<{
    isCollapsed: (id: string) => boolean;
    setCollapsed: (id: string, state: boolean) => void;
}>({ isCollapsed: () => false, setCollapsed: () => {} });

// Generate consistent avatar color from username
const getUserColor = (name: string) => {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 
    'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Helper to extract image/video URLs from text
const extractMediaFromText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex) || [];
  
  return matches.map(url => {
    // Clean URL (remove markdown parenthesis/brackets if present at end)
    return url.replace(/[)\]]+$/, '');
  }).map(url => {
      // Convert .gifv to .mp4 for proper playback
      if (url.match(/\.gifv$/i)) {
          return url.replace(/\.gifv$/i, '.mp4');
      }
      return url;
  }).filter(url => {
    const lowerUrl = url.toLowerCase();
    // Remove query params for extension check
    const urlNoParams = lowerUrl.split('?')[0];
    
    // Allowed extensions
    const hasMediaExt = urlNoParams.match(/\.(jpeg|jpg|png|gif|webp|bmp|mp4|webm|mov)$/);
    
    // Allowed domains that might act as media
    const isReddit = lowerUrl.includes('preview.redd.it') || lowerUrl.includes('i.redd.it') || lowerUrl.includes('external-preview.redd.it');
    const isGiphy = lowerUrl.includes('giphy.com/media') || lowerUrl.includes('media.giphy.com');
    const isImgur = lowerUrl.includes('i.imgur.com');

    return hasMediaExt || isReddit || isGiphy || isImgur;
  });
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
            p: ({node, ...props}) => <p {...props} className="mb-2 last:mb-0" />,
            // @ts-ignore
            img: ({node, ...props}) => <span className="hidden">Image hidden in markdown (shown in media grid)</span>, 
            // @ts-ignore
            table: ({node, ...props}) => <div className="overflow-x-auto my-2 rounded-lg border border-stone-200 dark:border-stone-700"><table {...props} className="table-auto w-full text-sm" /></div>,
            // @ts-ignore
            th: ({node, ...props}) => <th {...props} className="px-3 py-2 bg-stone-100 dark:bg-stone-800 font-semibold text-left" />,
            // @ts-ignore
            td: ({node, ...props}) => <td {...props} className="px-3 py-2 border-t border-stone-100 dark:border-stone-800" />,
            // @ts-ignore
            blockquote: ({node, ...props}) => <blockquote {...props} className="border-l-4 border-emerald-500/30 pl-3 py-1 my-2 text-stone-500 dark:text-stone-400 italic bg-stone-50 dark:bg-stone-800/20 rounded-r" />,
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
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setIsAnimating(false);
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartRef.current;
    
    // Resistance at edges
    if ((currentIndex === 0 && diff > 0) || (currentIndex === items.length - 1 && diff < 0)) {
        setDragOffset(diff * 0.3);
    } else {
        setDragOffset(diff);
    }
  };

  const onTouchEnd = () => {
    if (touchStartRef.current === null) return;
    setIsAnimating(true);
    
    if (Math.abs(dragOffset) > 80) { // Threshold to change slide
        if (dragOffset > 0 && currentIndex > 0) {
            setCurrentIndex(curr => curr - 1);
        } else if (dragOffset < 0 && currentIndex < items.length - 1) {
            setCurrentIndex(curr => curr + 1);
        }
    }
    
    setDragOffset(0);
    touchStartRef.current = null;
  };

  const handlePrev = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsAnimating(true);
      if (currentIndex > 0) setCurrentIndex(curr => curr - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsAnimating(true);
      if (currentIndex < items.length - 1) setCurrentIndex(curr => curr + 1);
  };

  const currentItem = items[currentIndex];

  if (!currentItem) return null;

  return (
    <div 
        className="relative w-full bg-stone-100 dark:bg-stone-900 rounded-xl overflow-hidden mb-6 group select-none shadow-sm border border-stone-200 dark:border-stone-800"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        {/* Main Image Container - Carousel Track */}
        <div className="relative overflow-hidden min-h-[300px] md:min-h-[400px] bg-stone-100 dark:bg-stone-950">
             <div 
                className="flex h-full w-full"
                style={{ 
                    transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
                    transition: isAnimating ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
                }}
             >
                {items.map((item, index) => (
                    <div key={item.id || index} className="w-full h-full flex-shrink-0 flex items-center justify-center p-0.5">
                         <img 
                            src={item.src} 
                            alt={item.caption || `Image ${index + 1}`}
                            className="max-h-[70vh] w-full object-contain"
                            loading={Math.abs(index - currentIndex) <= 1 ? "eager" : "lazy"}
                            draggable={false}
                        />
                    </div>
                ))}
             </div>
            
            {/* Desktop Navigation */}
            {currentIndex > 0 && (
                <button 
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center transform hover:scale-110 active:scale-95"
                    title="Previous Image"
                >
                    <ChevronLeft size={28} />
                </button>
            )}
            
            {currentIndex < items.length - 1 && (
                <button 
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hidden md:flex items-center justify-center transform hover:scale-110 active:scale-95"
                    title="Next Image"
                >
                    <ChevronRight size={28} />
                </button>
            )}
        </div>

        {/* Caption Overlay */}
        <div className="bg-white dark:bg-stone-900 p-3 text-sm text-stone-600 dark:text-stone-300 border-t border-stone-100 dark:border-stone-800 transition-opacity duration-300">
            {currentItem.caption || <span>&nbsp;</span>}
        </div>
        
        {/* Image Counter Badge */}
        <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm flex items-center gap-1.5 shadow-sm">
            <Images size={12} />
            {currentIndex + 1} / {items.length}
        </div>

        {/* Dots Indicator */}
        {items.length > 1 && items.length <= 15 && (
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none z-10">
                {items.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-1.5 h-1.5 rounded-full transition-all shadow-sm ${idx === currentIndex ? 'bg-white scale-125 w-3' : 'bg-white/40'}`}
                    />
                ))}
             </div>
        )}
    </div>
  );
};

const CommentNode: React.FC<{ 
    comment: RedditComment; 
    depth?: number; 
    onNavigateSub?: (sub: string) => void; 
    textSize: 'small' | 'medium' | 'large';
    opAuthor: string;
    toxicityAnalysis?: CommentAnalysis | null;
    linkId: string; // Needed for fetching more
}> = memo(({ comment, depth = 0, onNavigateSub, textSize, opAuthor, toxicityAnalysis, linkId }) => {
  const { isCollapsed, setCollapsed: setGlobalCollapsed } = useContext(CommentContext);
  
  // Initialize state from context to survive unmounts
  const [collapsed, setCollapsed] = useState(() => isCollapsed(comment.data.id));
  const [visibleReplies, setVisibleReplies] = useState(5); 
  const [forceShowToxic, setForceShowToxic] = useState(false);
  
  // Manage replies state internally to support "load more"
  const [replies, setReplies] = useState<any[]>([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreError, setLoadingMoreError] = useState<string | null>(null);

  const data = comment.data;
  const isOp = data.author === opAuthor;
  const isToxic = toxicityAnalysis?.isToxic;

  // Initialize replies from props
  useEffect(() => {
      if (data.replies && typeof data.replies !== 'string' && data.replies.data) {
          setReplies(data.replies.data.children);
      } else {
          setReplies([]);
      }
      setRepliesLoaded(true);
  }, [data.replies]);

  // Handler for 'more' button
  const handleLoadMore = async (moreItem: any) => {
      setLoadingMore(true);
      setLoadingMoreError(null);

      try {
          // If count is 0, it's usually "Continue thread" -> Fetch single comment thread via GET
          if (moreItem.data.count === 0 || (moreItem.data.children && moreItem.data.children.length === 1)) {
              const childId = moreItem.data.children[0];
              // Construct permalink: /comments/{postId}/_/{commentId}
              const postId = linkId.startsWith('t3_') ? linkId.substring(3) : linkId;
              const permalink = `/comments/${postId}/_/${childId}`;
              
              const newComments = await fetchComments(permalink);
              
              setReplies(prev => {
                  // Replace the 'more' item with the fetched comment tree
                  const idx = prev.findIndex(p => p.data.id === moreItem.data.id);
                  if (idx === -1) return prev;
                  const next = [...prev];
                  // The fetchComments returns a list with the root comment of that thread at index 0
                  if (newComments.length > 0) {
                     next.splice(idx, 1, ...newComments);
                  }
                  return next;
              });
          } else {
              // Pagination -> Fetch more children via POST
              const newChildren = await fetchMoreChildren(linkId, moreItem.data.children);
              
              setReplies(prev => {
                  const idx = prev.findIndex(p => p.data.id === moreItem.data.id);
                  if (idx === -1) return prev;
                  const next = [...prev];
                  next.splice(idx, 1, ...newChildren);
                  return next;
              });
          }
      } catch (err) {
          console.error("Failed to load more comments", err);
          setLoadingMoreError("Failed to load. Click to open in Reddit.");
      } finally {
          setLoadingMore(false);
      }
  };
  
  // Skip if deleted
  if (data.author === '[deleted]') return null;

  const mediaUrls = useMemo(() => {
    const extracted = extractMediaFromText(data.body);
    if (data.media_metadata) {
        Object.values(data.media_metadata).forEach((media: any) => {
            if (media.status === 'valid' && media.s) {
                let src = media.s.gif || media.s.mp4 || media.s.u;
                if (src) {
                    src = src.replace(/&amp;/g, '&');
                    extracted.push(src);
                }
            }
        });
    }
    return Array.from(new Set(extracted));
  }, [data.body, data.media_metadata]);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !collapsed;
    setCollapsed(newState);
    setGlobalCollapsed(data.id, newState); // Persist to context
  };

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleReplies(prev => prev + 5); 
  };

  const handleShowAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibleReplies(replies.length);
  };

  if (isToxic && !forceShowToxic) {
      return (
          <div className={`mt-4 border border-stone-200 dark:border-stone-800 rounded-lg p-3 bg-stone-50 dark:bg-stone-900/30 animate-list-enter`}>
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                      <ShieldAlert size={16} className="text-orange-500" />
                      <span className="text-xs font-medium">
                          Comment hidden by Zen Shield {toxicityAnalysis?.reason ? `(${toxicityAnalysis.reason})` : ''}
                      </span>
                  </div>
                  <button 
                    onClick={() => setForceShowToxic(true)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors btn-press"
                  >
                      <Eye size={12} />
                      View
                  </button>
              </div>
          </div>
      );
  }

  const hasReplies = replies.length > 0;

  return (
    <div className={`flex flex-col animate-list-enter ${depth === 0 ? 'mt-4 border-b border-stone-100 dark:border-stone-800 pb-4' : 'mt-4'}`}>
        {/* Header */}
        <div 
            onClick={toggleCollapse}
            className="flex items-center gap-2 cursor-pointer group select-none py-1"
        >
            <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] text-white font-bold shadow-sm ${getUserColor(data.author)} ${collapsed ? 'opacity-50' : ''}`}>
                {collapsed ? <Plus size={14} className="text-white" /> : data.author.substring(0, 1).toUpperCase()}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 overflow-hidden">
                 <span className={`font-bold truncate ${isOp ? 'text-blue-600 dark:text-blue-400' : 'text-stone-700 dark:text-stone-300'} ${collapsed ? 'text-stone-500' : ''}`}>
                    {data.author}
                 </span>
                 {isOp && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1 rounded border border-blue-100 dark:border-blue-900/50">OP</span>}
                 
                 {!collapsed && (
                     <>
                        <span className="text-stone-300 dark:text-stone-600">•</span>
                        <span>{formatDistanceToNow(new Date(data.created_utc * 1000), { addSuffix: false }).replace('about ', '').replace(' hours', 'h')}</span>
                     </>
                 )}
                 
                 {collapsed && (
                     <span className="ml-1 text-[10px] bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full text-stone-500 font-medium">
                         {hasReplies ? `${replies.length} replies` : 'collapsed'}
                     </span>
                 )}
                 
                 {isToxic && forceShowToxic && (
                     <span className="ml-1 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200">Toxic Content</span>
                 )}
            </div>
        </div>

        {/* Content */}
        <div className={`flex transition-all duration-300 ${collapsed ? 'hidden' : 'block'}`}>
            <div 
                className="w-6 flex justify-center shrink-0 cursor-pointer group/line"
                onClick={toggleCollapse}
            >
                <div className="w-full h-full bg-transparent border-l-2 border-stone-100 dark:border-stone-800 group-hover/line:border-emerald-400 dark:group-hover/line:border-emerald-600/50 transition-colors my-1 ml-[50%]"></div>
            </div>

            <div className="flex-1 min-w-0 pb-1 pr-1 pl-1">
                <div className="pt-0.5 pb-2 text-stone-800 dark:text-stone-200">
                        <MarkdownRenderer content={data.body} onNavigateSub={onNavigateSub} textSize={textSize} />
                </div>

                {mediaUrls.length > 0 && (
                    <div className="mt-2 mb-3 flex flex-wrap gap-2">
                        {mediaUrls.map((url, idx) => {
                            const isVideo = url.match(/\.(mp4|webm|mov)(\?|$)/i);
                            return (
                                <div key={idx} className="relative rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 max-w-full md:max-w-md shadow-sm">
                                    {isVideo ? (
                                        <video src={url} controls loop muted playsInline className="max-h-60 w-auto bg-black" />
                                    ) : (
                                        <img src={url.replace(/&amp;/g, '&')} alt="media" className="max-h-60 object-contain w-auto" loading="lazy" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center gap-4 mb-2 select-none">
                    <div className="flex items-center gap-1 text-stone-500 dark:text-stone-400 text-xs font-bold">
                        <ArrowBigUp size={18} className={`${data.score > 0 ? 'text-orange-500' : ''}`} strokeWidth={2} />
                        <span>{data.score}</span>
                    </div>
                    <button className="flex items-center gap-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 text-xs font-medium transition-colors btn-press">
                        <MessageSquare size={14} />
                        <span>Reply</span>
                    </button>
                    <button className="p-1 text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors btn-press">
                         <MoreHorizontal size={14} />
                    </button>
                </div>

                {/* Nested Replies */}
                {hasReplies && (
                    <div className="mt-1">
                        {replies.slice(0, visibleReplies).map((child) => {
                            if (child.kind === 't1') {
                                return (
                                    <CommentNode 
                                        key={child.data.id} 
                                        comment={child} 
                                        depth={depth + 1} 
                                        onNavigateSub={onNavigateSub} 
                                        textSize={textSize} 
                                        opAuthor={opAuthor} 
                                        toxicityAnalysis={toxicityAnalysis} 
                                        linkId={linkId}
                                    />
                                );
                            }
                            if (child.kind === 'more') {
                                return (
                                    <div key={child.data.id} className="mt-3 ml-1 text-xs">
                                        {loadingMore ? (
                                             <div className="flex items-center gap-2 text-stone-400">
                                                 <Loader2 size={12} className="animate-spin" />
                                                 <span>Loading more comments...</span>
                                             </div>
                                        ) : loadingMoreError ? (
                                            <a 
                                                href={`https://reddit.com${comment.data.permalink || ''}`} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-red-500 hover:underline flex items-center gap-1"
                                            >
                                                <ExternalLink size={12} />
                                                {loadingMoreError}
                                            </a>
                                        ) : (
                                            <button
                                                onClick={() => handleLoadMore(child)}
                                                className="text-emerald-600 dark:text-emerald-500 font-medium hover:underline flex items-center gap-1.5 py-1"
                                            >
                                                <CornerDownRight size={14} />
                                                {child.data.count === 0 
                                                    ? "Continue this thread..." 
                                                    : `Load ${child.data.count} more replies...`
                                                }
                                            </button>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {replies.length > visibleReplies && (
                            <div className="mt-3 ml-1 flex items-center gap-3">
                                <button 
                                    onClick={handleShowMore}
                                    className="text-xs font-bold text-stone-500 hover:text-emerald-600 dark:text-stone-400 dark:hover:text-emerald-400 flex items-center gap-1.5 py-1 px-3 bg-stone-100 dark:bg-stone-800 rounded-full transition-colors btn-press"
                                >
                                    <Plus size={12} />
                                    Show {Math.min(5, replies.length - visibleReplies)} more
                                </button>
                                {replies.length - visibleReplies > 5 && (
                                     <button 
                                        onClick={handleShowAll}
                                        className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline"
                                     >
                                        Show all ({replies.length - visibleReplies})
                                     </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
});

const PostDetail: React.FC<PostDetailProps> = ({ post, onClose, onNavigateSub, textSize, aiConfig, onCommentsBlocked }) => {
  const [comments, setComments] = useState<RedditComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingComments, setAnalyzingComments] = useState(false);
  const [commentAnalysisMap, setCommentAnalysisMap] = useState<Record<string, CommentAnalysis>>({});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Registry to keep track of collapsed comments across virtualized unmounts
  const collapsedRegistry = useRef<Set<string>>(new Set());

  const isCollapsed = useCallback((id: string) => {
      return collapsedRegistry.current.has(id);
  }, []);

  const setCollapsed = useCallback((id: string, state: boolean) => {
      if (state) {
          collapsedRegistry.current.add(id);
      } else {
          collapsedRegistry.current.delete(id);
      }
  }, []);

  // Stable context value
  const contextValue = useMemo(() => ({
      isCollapsed,
      setCollapsed
  }), [isCollapsed, setCollapsed]);

  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const loadComments = async () => {
      setLoading(true);
      // fetchComments returns a flat array of 'more' and 't1' objects at root
      const data = await fetchComments(post.permalink);
      setComments(data);
      setLoading(false);

      if (aiConfig.analyzeComments && data.length > 0 && aiConfig.openRouterKey) {
           setAnalyzingComments(true);
           try {
               const analysisResults = await analyzeCommentsForZen(data, aiConfig);
               const map: Record<string, CommentAnalysis> = {};
               analysisResults.forEach(r => map[r.id] = r);
               setCommentAnalysisMap(map);
               
               const toxicCount = analysisResults.filter(r => r.isToxic).length;
               if (toxicCount > 0) {
                   onCommentsBlocked(toxicCount);
               }
           } catch (e) {
               console.warn("Comment analysis failed", e);
           } finally {
               setAnalyzingComments(false);
           }
      }
    };
    loadComments();
  }, [post.permalink, aiConfig]);

  // Handle Video Playback
  useEffect(() => {
    const video = post.secure_media?.reddit_video;
    if (!video || !videoRef.current) return;

    const videoEl = videoRef.current;
    
    setHasSubtitles(false);
    setSubtitlesEnabled(false);

    if (Hls.isSupported() && video.hls_url) {
        if (hlsRef.current) hlsRef.current.destroy();
        
        const hls = new Hls({
            enableWebVTT: true,
            capLevelToPlayerSize: true
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
            setHasSubtitles(hls.subtitleTracks.length > 0);
            setSubtitlesEnabled(hls.subtitleTrack !== -1);
        });

        hls.loadSource(video.hls_url);
        hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl') && video.hls_url) {
        videoEl.src = video.hls_url;
    } else {
        videoEl.src = video.fallback_url;
    }

    return () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
    };
  }, [post.secure_media]);

  const toggleSubtitles = () => {
    if (hlsRef.current) {
        if (subtitlesEnabled) {
            hlsRef.current.subtitleTrack = -1;
            setSubtitlesEnabled(false);
        } else {
            hlsRef.current.subtitleTrack = 0;
            setSubtitlesEnabled(true);
        }
    }
  };

  const decodeHtml = (html: string | undefined | null) => {
    if (!html) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const scrollToNextParent = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const parents = container.querySelectorAll('[data-parent-comment="true"]');
    const containerRect = container.getBoundingClientRect();
    
    for (const parent of parents) {
        const rect = parent.getBoundingClientRect();
        if (rect.top > containerRect.top + 60) {
            const relativeTop = rect.top - containerRect.top;
            container.scrollTo({
                top: container.scrollTop + relativeTop - 20,
                behavior: 'smooth'
            });
            return;
        }
    }
  };

  // Render logic for post media...
  const renderMedia = () => {
    if (post.secure_media?.reddit_video) {
        return (
            <div className="relative mb-6 mx-auto w-full bg-black rounded-xl shadow-lg max-h-[60vh] group">
                <video 
                    ref={videoRef}
                    controls 
                    className="w-full h-full object-contain max-h-[60vh] rounded-xl" 
                    playsInline
                    poster={post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined}
                />
                
                {hasSubtitles && (
                     <button
                        onClick={toggleSubtitles}
                        className={`absolute top-4 right-4 z-10 p-2 rounded-full backdrop-blur-md transition-colors ${subtitlesEnabled ? 'bg-emerald-600 text-white' : 'bg-black/60 text-white hover:bg-black/80'}`}
                        title="Toggle Captions"
                     >
                        <Captions size={20} />
                     </button>
                )}
            </div>
        )
    }

    if (post.is_gallery && post.gallery_data && post.media_metadata) {
        const galleryItems = post.gallery_data.items.map((item) => {
            const media = post.media_metadata![item.media_id];
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

    if (post.url && post.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return (
        <img 
            src={post.url} 
            alt={post.title} 
            className="w-full rounded-xl mb-6 object-contain max-h-[60vh] bg-stone-100 dark:bg-stone-900 shadow-sm" 
        />
      );
    }

    if (post.preview?.images?.[0]?.source?.url) {
        const src = post.preview.images[0].source.url.replace(/&amp;/g, '&');
        const isImgurAlbum = post.url.includes('imgur.com/a/') || post.url.includes('imgur.com/gallery/');

        return (
            <div className="relative mb-6 group inline-block w-full">
                 <img 
                    src={src} 
                    alt={post.title} 
                    className="w-full rounded-xl object-contain max-h-[60vh] bg-stone-100 dark:bg-stone-900 shadow-sm" 
                 />
                 {isImgurAlbum && (
                    <a 
                        href={post.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute bottom-4 right-4 bg-stone-900/80 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-black transition-colors backdrop-blur-sm shadow-lg"
                    >
                        <ExternalLink size={14} />
                        View Album
                    </a>
                 )}
            </div>
        )
    }

    if (post.url && !post.url.includes('reddit.com')) {
        return (
            <a href={post.url} target="_blank" rel="noreferrer" className="flex items-center p-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl mb-6 text-blue-600 dark:text-blue-400 hover:bg-stone-100 dark:hover:bg-stone-750 transition-colors group">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg mr-3 group-hover:scale-110 transition-transform">
                     <ExternalLink className="shrink-0" size={20} />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">{post.domain}</span>
                    <span className="truncate text-xs text-stone-500 dark:text-stone-400">{post.url}</span>
                </div>
            </a>
        )
    }
    return null;
  };

  return (
    <CommentContext.Provider value={contextValue}>
        <div 
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center animate-fade-smooth"
            onClick={onClose}
        >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" />

        <div 
            className="bg-white dark:bg-stone-950 w-full md:max-w-4xl h-[100dvh] md:h-[85vh] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden md:border border-stone-200 dark:border-stone-800 animate-modal-spring relative z-10"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-950/90 backdrop-blur-md shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={onClose} className="p-2 -ml-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors shrink-0 md:hidden btn-press">
                    <ChevronLeft size={24} className="text-stone-800 dark:text-stone-200" />
                </button>
                
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        r/
                    </div>
                    <div className="flex flex-col min-w-0">
                        <button 
                            onClick={() => onNavigateSub && onNavigateSub(post.subreddit)}
                            className="font-bold text-stone-900 dark:text-stone-100 truncate text-sm md:text-base hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
                        >
                            {post.subreddit}
                        </button>
                        <span className="text-xs text-stone-500 dark:text-stone-400 truncate flex items-center gap-1">
                            <span>Posted by u/{post.author}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(post.created_utc * 1000))} ago</span>
                        </span>
                    </div>
                </div>
            </div>

            <button onClick={onClose} className="hidden md:block p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors shrink-0 btn-press">
                <X size={24} className="text-stone-500 dark:text-stone-400" />
            </button>
            </div>

            {/* Content */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto bg-white dark:bg-stone-950 relative"
            >
            <div className="p-4 md:p-8 md:pb-20 max-w-3xl mx-auto">
                <div className="flex gap-2 mb-4 animate-list-enter">
                    {post.zenScore !== undefined && (
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                            post.zenScore >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50' :
                            post.zenScore >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/50' :
                            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/50'
                        }`}>
                            Zen Score: {post.zenScore}
                        </span>
                    )}
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 mb-6 leading-snug animate-list-enter" style={{ animationDelay: '0.05s' }}>{decodeHtml(post.title)}</h2>
                
                <div className="animate-list-enter" style={{ animationDelay: '0.1s' }}>
                    {renderMedia()}
                </div>

                {post.selftext && (
                    <div className="mb-8 p-1 animate-list-enter" style={{ animationDelay: '0.15s' }}>
                        <MarkdownRenderer content={post.selftext} onNavigateSub={onNavigateSub} textSize={textSize} />
                    </div>
                )}

                <div className="flex items-center gap-6 py-4 border-t border-b border-stone-100 dark:border-stone-800 mb-6 animate-list-enter" style={{ animationDelay: '0.2s' }}>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full px-3 py-1.5">
                            <ArrowBigUp size={22} className={`${post.score > 0 ? 'text-orange-600 dark:text-orange-500' : 'text-stone-400'}`} strokeWidth={2.5} />
                            <span className="font-bold text-sm ml-1 text-stone-700 dark:text-stone-300">{post.score > 1000 ? `${(post.score / 1000).toFixed(1)}k` : post.score}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                        <MessageSquare size={20} />
                        <span className="font-semibold text-sm">{post.num_comments} Comments</span>
                    </div>
                </div>

                {/* Comments Section */}
                {analyzingComments && (
                    <div className="mb-6">
                        <ScanningVisualizer mode="compact" />
                        <p className="text-center text-[10px] text-stone-400 mt-2 uppercase tracking-wide">Shielding you from toxic threads...</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
                    <p className="text-stone-400 text-sm animate-pulse">Loading discussion...</p>
                    </div>
                ) : (
                    <div className="pb-20">
                    {comments.map((comment, i) => {
                        // Handle Top-Level 'more' items (Pagination)
                        if (comment.kind === 'more') {
                            return (
                                    <div key={comment.data.id} className="mt-4 flex justify-center animate-list-enter">
                                        <button
                                            onClick={async () => {
                                                // Handle top-level loading
                                                try {
                                                    const newChildren = await fetchMoreChildren(post.name, comment.data.children);
                                                    setComments(prev => {
                                                        const idx = prev.findIndex(p => p.data.id === comment.data.id);
                                                        if (idx === -1) return prev;
                                                        const next = [...prev];
                                                        next.splice(idx, 1, ...newChildren);
                                                        return next;
                                                    });
                                                } catch (e) {
                                                    console.error("Top level load failed", e);
                                                }
                                            }}
                                            className="text-emerald-600 dark:text-emerald-500 font-bold hover:bg-stone-100 dark:hover:bg-stone-800 px-4 py-2 rounded-full transition-colors flex items-center gap-2"
                                        >
                                            <CornerDownRight size={18} />
                                            Load {comment.data.count} more comments
                                        </button>
                                    </div>
                            );
                        }

                        return (
                            <LazyRender key={comment.data.id} minHeight={80} rootMargin="600px">
                                <div data-parent-comment="true" style={{ animationDelay: `${Math.min(i % 10, 5) * 0.03}s` }} className="animate-list-enter">
                                    <CommentNode 
                                        comment={comment} 
                                        onNavigateSub={onNavigateSub} 
                                        textSize={textSize} 
                                        opAuthor={post.author} 
                                        toxicityAnalysis={commentAnalysisMap[comment.data.id]}
                                        linkId={post.name}
                                    />
                                </div>
                            </LazyRender>
                        );
                    })}
                    {comments.length === 0 && (
                        <div className="text-center py-12 bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 animate-list-enter">
                            <p className="text-stone-500 dark:text-stone-400 font-medium">No comments yet.</p>
                            <p className="text-stone-400 text-sm mt-1">Be the first to start the conversation on Reddit!</p>
                        </div>
                    )}
                    </div>
                )}
            </div>
            </div>

            {comments.length > 5 && (
                <button
                    onClick={scrollToNextParent}
                    className="md:hidden absolute bottom-6 right-6 z-50 bg-emerald-600 text-white p-3 rounded-full shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 active:scale-95 transition-all opacity-90 hover:opacity-100 btn-press"
                    aria-label="Next comment"
                >
                    <ChevronDown size={24} />
                </button>
            )}
        </div>
        </div>
    </CommentContext.Provider>
  );
};

export default PostDetail;
