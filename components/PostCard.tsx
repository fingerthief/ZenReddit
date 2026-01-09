
import React, { useMemo, useState } from 'react';
import { FilteredPost, GalleryItem, ViewMode } from '../types';
import { MessageSquare, ArrowBigUp, Image as ImageIcon, CirclePlay, Layers, ExternalLink, Maximize2, Minimize2, Share2, Check, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ZenBadge from './ZenBadge';

interface PostCardProps {
  post: FilteredPost;
  isSeen?: boolean;
  onClick: (post: FilteredPost) => void;
  onNavigateSub?: (sub: string) => void;
  onNavigateUser?: (user: string) => void;
  onImageClick?: (items: GalleryItem[], initialIndex: number) => void;
  viewMode?: ViewMode;
}

// Fast entity decoder that doesn't touch the DOM
const decodeHtmlEntities = (str: string): string => {
  if (!str) return "";
  return str.replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, ' ');
};

const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(5);
};

const FlairBadge: React.FC<{ text: string; bgColor?: string; textColor?: 'dark' | 'light'; className?: string }> = ({ text, bgColor, textColor, className = '' }) => {
  if (!text) return null;
  
  const hasBg = bgColor && bgColor !== 'transparent' && bgColor !== '';
  const isLightText = textColor === 'light';
  
  const style: React.CSSProperties = {
    backgroundColor: hasBg ? bgColor : undefined,
  };

  return (
    <span 
      style={style}
      className={`
        inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight 
        ${!hasBg ? 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400' : ''} 
        ${hasBg && isLightText ? 'text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.1)]' : ''} 
        ${hasBg && !isLightText ? 'text-stone-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]' : ''} 
        ${className} whitespace-nowrap leading-none border border-black/5 dark:border-white/5
      `}
    >
      {decodeHtmlEntities(text)}
    </span>
  );
};

const PostCard: React.FC<PostCardProps> = ({ post, isSeen = false, onClick, onNavigateSub, onNavigateUser, onImageClick, viewMode = 'card' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  
  const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic();
      const url = `https://www.reddit.com${post.permalink}`;
      
      if (navigator.share) {
          try {
              await navigator.share({
                  title: post.title,
                  url: url
              });
          } catch (err) {
              // Ignore abort errors
          }
      } else {
          try {
              await navigator.clipboard.writeText(url);
              setShowCopied(true);
              setTimeout(() => setShowCopied(false), 2000);
          } catch (err) {
              console.error('Failed to copy', err);
          }
      }
  };

  const handleMediaClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic();

      const isVideo = post.is_video || 
                      !!post.secure_media?.reddit_video || 
                      !!post.preview?.reddit_video_preview ||
                      (post.url && !!post.url.match(/\.(mp4|gifv|webm|mkv|mov)$/i)) ||
                      post.domain === 'v.redd.it';

      if (isVideo) {
          if (!onImageClick) return;

          let hls = post.secure_media?.reddit_video?.hls_url;
          let mp4 = post.secure_media?.reddit_video?.fallback_url;

          if (!hls && !mp4 && post.preview?.reddit_video_preview) {
              hls = post.preview.reddit_video_preview.hls_url;
              mp4 = post.preview.reddit_video_preview.fallback_url;
          }

          if (!hls && !mp4 && post.url) {
               if (post.url.match(/\.(mp4|webm|mov)$/i)) {
                   mp4 = post.url;
               } else if (post.url.match(/\.gifv$/i)) {
                   mp4 = post.url.replace(/\.gifv$/i, '.mp4');
               }
          }
          
          if (!mp4 && !hls && (post.url.includes('.mp4') || post.domain === 'v.redd.it')) {
              mp4 = post.url;
          }

          onImageClick([{
              src: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : '',
              caption: post.title,
              id: post.id,
              type: 'video',
              videoSources: {
                  hls,
                  mp4
              }
          }], 0);
          return;
      }
      
      if (!onImageClick) {
          onClick(post);
          return;
      }

      // --- Gallery Detection ---
      if (post.is_gallery && post.gallery_data && post.media_metadata) {
          const items: GalleryItem[] = post.gallery_data.items.map((item): GalleryItem | null => {
              const media = post.media_metadata![item.media_id];
              let src = media?.s?.u || media?.s?.gif;
              if (src) {
                  src = src.replace(/&amp;/g, '&');
                  return {
                      src,
                      caption: item.caption,
                      id: item.id,
                      type: 'image' as const
                  };
              }
              return null;
          }).filter((i): i is GalleryItem => i !== null);

          if (items.length > 0) {
              onImageClick(items, 0);
              return;
          }
      }

      // Single Image Logic
      let imageUrl = post.url;
      if (post.preview?.images?.[0]?.source?.url) {
          imageUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
      }

      const urlNoParams = imageUrl.split('?')[0].toLowerCase();
      const hasImageExtension = urlNoParams.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      const isRedditImage = post.domain?.includes('i.redd.it');
      const hasPreview = !!post.preview?.images?.[0];
      
      if (hasImageExtension || isRedditImage || hasPreview) {
          onImageClick([{ 
            src: imageUrl, 
            caption: post.title,
            type: 'image' 
          }], 0);
      } else {
          onClick(post);
      }
  };

  const getThumbnail = () => {
      let src = null;
      if (post.thumbnail && post.thumbnail.startsWith('http')) {
          src = post.thumbnail;
      } else if (post.preview?.images?.[0]?.source?.url) {
          src = post.preview.images[0].source.url.replace(/&amp;/g, '&');
      }
      // Fallback for default thumbnails
      if (src === 'self' || src === 'default' || src === 'image' || !src) return null;
      return src;
  };

  const mediaContent = useMemo(() => {
    const isVideo = post.is_video || 
                    !!post.secure_media?.reddit_video || 
                    !!post.preview?.reddit_video_preview ||
                    (post.url && !!post.url.match(/\.(mp4|gifv|webm|mkv|mov)$/i)) ||
                    post.domain === 'v.redd.it';
    
    const isGallery = post.is_gallery || post.gallery_data || (post.url.includes('imgur.com') && (post.url.includes('/a/') || post.url.includes('/gallery/')));

    let previewSrc = null;
    if (post.preview?.images?.[0]?.source?.url) {
        previewSrc = post.preview.images[0].source.url.replace(/&amp;/g, '&');
        const resolutions = post.preview.images[0].resolutions;
        if (resolutions && resolutions.length > 0) {
             const bestFit = resolutions.find(r => r.width >= 640) || resolutions[resolutions.length - 1];
             if (bestFit) previewSrc = bestFit.url.replace(/&amp;/g, '&');
        }
    } else if (post.thumbnail && post.thumbnail.startsWith('http') && post.thumbnail !== 'self' && post.thumbnail !== 'default' && post.thumbnail !== 'image') {
        previewSrc = post.thumbnail;
    }

    if (previewSrc && (isVideo || isGallery || post.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || post.domain?.includes('redd.it') || post.domain?.includes('imgur'))) {
         const source = post.preview?.images?.[0]?.source;
         
         const hasDimensions = !!(source?.width && source?.height);
         const mediaStyle = hasDimensions 
            ? { aspectRatio: `${source.width} / ${source.height}` } 
            : undefined;

         return (
             <div 
                className={`relative mt-3 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer group/media shadow-inner ${hasDimensions ? 'max-h-[600px]' : ''}`}
                onClick={handleMediaClick}
                style={mediaStyle}
             >
                 <img 
                    src={previewSrc} 
                    alt="preview" 
                    className={`w-full object-cover transition-transform duration-700 ease-out group-hover/media:scale-105 ${hasDimensions ? 'h-full' : 'h-auto max-h-[600px] min-h-[200px]'}`}
                    loading="lazy"
                 />
                 
                 {isVideo && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 group-hover/media:bg-black/30 transition-colors duration-300">
                        <div className="bg-black/50 p-3 rounded-full backdrop-blur-md transform transition-transform duration-300 group-hover/media:scale-110">
                            <CirclePlay size={32} className="text-white fill-white/20" />
                        </div>
                    </div>
                 )}
                 
                 {isGallery && !isVideo && (
                     <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-white font-medium border border-white/10">
                         <Layers size={14} />
                         <span>Gallery</span>
                     </div>
                 )}
             </div>
         );
    }

    if (!post.selftext && post.thumbnail && post.thumbnail.startsWith('http')) {
        return (
            <div 
                className="mt-3 flex gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer group/link"
                onClick={(e) => { e.stopPropagation(); window.open(post.url, '_blank'); }}
            >
                <div className="overflow-hidden rounded-lg shrink-0 w-20 h-20 bg-stone-200 dark:bg-stone-700">
                    <img src={post.thumbnail} alt="thumb" className="w-full h-full object-cover transition-transform duration-500 group-hover/link:scale-110" />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                     <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate w-full flex items-center gap-1 group-hover/link:text-emerald-600 transition-colors">
                        {post.domain}
                        <ExternalLink size={12} className="text-stone-400 group-hover/link:text-emerald-500" />
                     </span>
                     <span className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                        {post.url}
                     </span>
                </div>
            </div>
        )
    }

    if (post.selftext) {
        return (
            <div 
                className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-4 hover:text-stone-800 dark:hover:text-stone-300 transition-colors"
            >
                {post.selftext}
            </div>
        );
    }

    return null;
  }, [post]);

  // --- COMPACT VIEW ---
  if (viewMode === 'compact') {
      const thumb = getThumbnail();
      const hasThumb = !!thumb;
      
      return (
        <div 
           className={`zen-card relative bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 flex overflow-hidden w-full ${isSeen ? 'opacity-75' : ''} touch-manipulation transition-colors hover:border-emerald-500/30 dark:hover:border-emerald-500/30`}
           onClick={() => onClick(post)}
        >
            {/* Thumbnail Area - Click to view media */}
            {hasThumb ? (
                <div 
                    className="group/thumb relative w-[80px] sm:w-[100px] shrink-0 bg-stone-100 dark:bg-stone-800 cursor-pointer overflow-hidden border-r border-stone-100 dark:border-stone-800"
                    onClick={(e) => { 
                        // Directly open media viewer
                        handleMediaClick(e); 
                    }} 
                >
                    <img 
                        src={thumb} 
                        alt="thumb" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110" 
                        loading="lazy" 
                    />
                    
                    {(post.is_video || post.domain === 'v.redd.it') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/thumb:bg-black/10 transition-colors">
                            <CirclePlay size={24} className="text-white drop-shadow-md opacity-90 group-hover/thumb:scale-110 transition-transform" />
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-3 shrink-0"></div> 
            )}
            
            {/* Content Area */}
            <div className="flex-1 min-w-0 py-2 pr-3 pl-2 sm:pl-3 flex flex-col justify-center gap-1">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                     <h3 className={`text-sm sm:text-[15px] font-medium leading-snug line-clamp-2 ${isSeen ? 'text-stone-500 font-normal' : 'text-stone-800 dark:text-stone-200'} pr-1`}>
                          {decodeHtmlEntities(post.title)}
                     </h3>
                     {post.zenScore !== undefined && (
                        <ZenBadge score={post.zenScore} size="sm" className="shrink-0 mt-0.5" />
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                         <span 
                            className="font-medium text-stone-600 dark:text-stone-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate"
                            onClick={(e) => { e.stopPropagation(); onNavigateSub && onNavigateSub(post.subreddit); }}
                        >
                            r/{post.subreddit}
                        </span>
                        <span className="text-stone-300 dark:text-stone-700 shrink-0">•</span>
                        <span className="shrink-0 truncate">{formatDistanceToNow(new Date(post.created_utc * 1000), { addSuffix: false }).replace('about ', '').replace(' hours', 'h').replace('less than a minute', 'now')}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                         <div className="flex items-center gap-1">
                            <ArrowBigUp size={14} className={post.score > 0 ? "text-orange-600 dark:text-orange-500" : ""} />
                            <span>{post.score > 1000 ? `${(post.score/1000).toFixed(1)}k` : post.score}</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <MessageSquare size={12} />
                            <span>{post.num_comments > 1000 ? `${(post.num_comments/1000).toFixed(1)}k` : post.num_comments}</span>
                         </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // --- CARD VIEW ---
  return (
    <div 
      className={`zen-card bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 flex flex-col cursor-pointer w-full ${isSeen ? 'opacity-80' : ''} touch-manipulation`}
      onClick={() => { triggerHaptic(); onClick(post); }}
    >
      <div className="p-4 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center text-xs text-stone-500 dark:text-stone-400 gap-1.5 flex-wrap min-w-0">
                <span 
                    className="font-bold text-stone-700 dark:text-stone-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer transition-colors truncate max-w-full"
                    onClick={(e) => {
                        if (onNavigateSub) {
                            e.stopPropagation();
                            onNavigateSub(post.subreddit);
                        }
                    }}
                >
                    r/{post.subreddit}
                </span>
                <span className="text-stone-300 dark:text-stone-600">•</span>
                <span 
                    className="hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer hover:underline transition-colors truncate max-w-[100px]"
                    onClick={(e) => {
                        if (onNavigateUser) {
                            e.stopPropagation();
                            onNavigateUser(post.author);
                        }
                    }}
                >
                    u/{post.author}
                </span>
                <span className="text-stone-300 dark:text-stone-600">•</span>
                <span className="shrink-0">{formatDistanceToNow(new Date(post.created_utc * 1000)).replace('about ', '')} ago</span>
                {post.author_flair_text && (
                  <FlairBadge 
                    text={post.author_flair_text} 
                    bgColor={post.author_flair_background_color}
                    textColor={post.author_flair_text_color}
                    className="opacity-80 scale-90 origin-left max-w-[100px] truncate"
                  />
                )}
            </div>

            {/* Zen Badge */}
            {post.zenScore !== undefined && (
                <ZenBadge score={post.zenScore} className="shrink-0" />
            )}
          </div>

          {/* Title Area */}
          <div className="mb-2">
            <h3 
              className={`text-base font-semibold leading-relaxed transition-colors break-words ${isSeen ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
            >
              {decodeHtmlEntities(post.title)}
            </h3>
            {post.link_flair_text && (
              <div className="mt-2 flex gap-1 flex-wrap">
                <FlairBadge 
                  text={post.link_flair_text} 
                  bgColor={post.link_flair_background_color}
                  textColor={post.link_flair_text_color}
                />
              </div>
            )}
          </div>

          {/* Content Preview */}
          {mediaContent}

          {/* Footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-2 text-stone-500 dark:text-stone-400 text-sm">
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/50 px-2 py-1 rounded-md transition-colors hover:bg-stone-200 dark:hover:bg-stone-800">
                <ArrowBigUp size={18} className={`${post.score > 0 ? 'text-orange-600 dark:text-orange-500' : ''}`} />
                <span className="font-medium text-xs">{post.score > 1000 ? `${(post.score / 1000).toFixed(1)}k` : post.score}</span>
                </div>
                <div 
                    className="flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 px-2 py-1 rounded-md transition-colors"
                >
                <MessageSquare size={16} />
                <span className="text-xs">{post.num_comments > 1000 ? `${(post.num_comments / 1000).toFixed(1)}k` : post.num_comments}</span>
                </div>
                
                <button 
                    onClick={handleShare}
                    className="flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 px-2 py-1 rounded-md transition-colors btn-press active:bg-stone-200 dark:active:bg-stone-700"
                    title="Share"
                >
                    {showCopied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
                </button>
            </div>
            
            
            {post.domain !== `self.${post.subreddit}` && !post.domain?.includes('reddit.com') && (
                 <a 
                    href={post.url} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic();
                    }}
                    className="flex items-center gap-1 text-xs hover:underline text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors p-1"
                 >
                     <span className="truncate max-w-[80px]">{post.domain}</span>
                     <ExternalLink size={10} />
                 </a>
            )}
          </div>
      </div>
    </div>
  );
};

export default React.memo(PostCard);
