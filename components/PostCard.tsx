
import React from 'react';
import { FilteredPost, GalleryItem, ViewMode } from '../types';
import { MessageSquare, ArrowBigUp, Image as ImageIcon, CirclePlay, Layers, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: FilteredPost;
  isSeen?: boolean;
  onClick: (post: FilteredPost) => void;
  onNavigateSub?: (sub: string) => void;
  onImageClick?: (items: GalleryItem[], initialIndex: number) => void;
  viewMode?: ViewMode;
}

const PostCard: React.FC<PostCardProps> = ({ post, isSeen = false, onClick, onNavigateSub, onImageClick, viewMode = 'card' }) => {
  const decodeHtml = (html: string) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const handleMediaClick = (e: React.MouseEvent) => {
      e.stopPropagation();

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
          // If no image handler, maybe it's just a click to the post detail
          onClick(post);
          return;
      }

      // --- Gallery Detection ---
      if (post.gallery_data && post.media_metadata) {
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
          // If not an image/video we can preview, clicking content opens post
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

  const getMediaContent = () => {
    const isVideo = post.is_video || 
                    !!post.secure_media?.reddit_video || 
                    !!post.preview?.reddit_video_preview ||
                    (post.url && !!post.url.match(/\.(mp4|gifv|webm|mkv|mov)$/i)) ||
                    post.domain === 'v.redd.it';
    
    const isGallery = post.gallery_data || (post.url.includes('imgur.com') && (post.url.includes('/a/') || post.url.includes('/gallery/')));

    // Try to get a high res preview image
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

    if (previewSrc && (isVideo || isGallery || post.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || post.domain.includes('redd.it') || post.domain.includes('imgur'))) {
         // Calculate aspect ratio style to prevent layout shift
         const source = post.preview?.images?.[0]?.source;
         const mediaStyle = (source?.width && source?.height) 
            ? { aspectRatio: `${source.width} / ${source.height}` } 
            : undefined;

         return (
             <div 
                className="relative mt-3 rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer group/media shadow-inner"
                onClick={handleMediaClick}
                style={mediaStyle}
             >
                 <img 
                    src={previewSrc} 
                    alt="preview" 
                    className="w-full h-auto object-cover max-h-[500px] min-h-[150px] transition-transform duration-700 ease-out group-hover/media:scale-105"
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
  };

  // --- COMPACT VIEW ---
  if (viewMode === 'compact') {
      const thumb = getThumbnail();
      const hasThumb = !!thumb;
      
      return (
        <div 
           className={`zen-card bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 flex overflow-hidden w-full ${isSeen ? 'opacity-60' : ''}`}
           onClick={() => onClick(post)}
        >
            {hasThumb && (
                <div 
                    className="w-[80px] min-h-[80px] sm:w-[110px] sm:min-h-[90px] shrink-0 bg-stone-100 dark:bg-stone-800 relative group overflow-hidden"
                    onClick={(e) => { e.stopPropagation(); handleMediaClick(e); }} 
                >
                    <img src={thumb} alt="thumb" className="w-full h-full object-cover absolute inset-0 transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                    {(post.is_video || post.domain === 'v.redd.it') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                            <CirclePlay size={24} className="text-white drop-shadow-md transform group-hover:scale-110 transition-transform" />
                        </div>
                    )}
                </div>
            )}
            
            <div className={`py-2 pr-2 pl-3 sm:p-3 flex flex-col justify-between flex-1 min-w-0`}>
                <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm sm:text-base font-medium leading-snug line-clamp-2 ${isSeen ? 'text-stone-500' : 'text-stone-800 dark:text-stone-200'}`}>
                        {decodeHtml(post.title)}
                    </h3>
                     {post.zenScore !== undefined && (
                        <div 
                            className={`shrink-0 w-2 h-2 rounded-full mt-1.5 shadow-sm ${
                                post.zenScore >= 80 ? 'bg-green-500 shadow-green-500/50' :
                                post.zenScore >= 50 ? 'bg-blue-500 shadow-blue-500/50' : 'bg-orange-500 shadow-orange-500/50'
                            }`}
                            title={`Zen Score: ${post.zenScore}`}
                        />
                    )}
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-stone-500 dark:text-stone-400 gap-2">
                    <div className="flex items-center gap-1.5 truncate min-w-0">
                        <span 
                            className="font-medium hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer truncate transition-colors"
                            onClick={(e) => { e.stopPropagation(); onNavigateSub && onNavigateSub(post.subreddit); }}
                        >
                            r/{post.subreddit}
                        </span>
                        <span className="text-stone-300 dark:text-stone-700 shrink-0">•</span>
                        <span className="shrink-0">{formatDistanceToNow(new Date(post.created_utc * 1000), { addSuffix: false }).replace('about ', '').replace(' hours', 'h').replace('less than a minute', 'now')}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                         <div className="flex items-center gap-1">
                            <ArrowBigUp size={14} className="stroke-[2.5px]" />
                            <span>{post.score > 1000 ? `${(post.score/1000).toFixed(1)}k` : post.score}</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <MessageSquare size={12} className="stroke-[2.5px]" />
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
      className={`zen-card bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 mb-6 break-inside-avoid flex flex-col cursor-pointer w-full ${isSeen ? 'opacity-80' : ''}`}
      onClick={() => onClick(post)}
    >
      <div className="p-4 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-xs text-stone-500 dark:text-stone-400 gap-2 overflow-hidden">
                <span 
                    className="font-bold text-stone-700 dark:text-stone-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer transition-colors"
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
                <span>{formatDistanceToNow(new Date(post.created_utc * 1000))} ago</span>
            </div>

            {/* Zen Badge */}
            {post.zenScore !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all duration-300 ${
                post.zenScore >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' :
                post.zenScore >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50' :
                'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900/50'
              }`}>
                Zen: {post.zenScore}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 
            className={`text-base font-semibold leading-snug transition-colors ${isSeen ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-stone-100 hover:text-emerald-700 dark:hover:text-emerald-400'}`}
          >
            {decodeHtml(post.title)}
          </h3>

          {/* Content Preview */}
          {getMediaContent()}

          {/* Footer */}
          <div className="mt-4 flex items-center gap-4 text-stone-500 dark:text-stone-400 text-sm">
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
            
            <div className="flex-1"></div>
            
            {post.domain !== `self.${post.subreddit}` && !post.domain.includes('reddit.com') && (
                 <a 
                    href={post.url} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs hover:underline text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
                 >
                     <span className="truncate max-w-[100px]">{post.domain}</span>
                     <ExternalLink size={10} />
                 </a>
            )}
          </div>
      </div>
    </div>
  );
};

export default PostCard;
