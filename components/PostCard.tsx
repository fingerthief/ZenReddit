

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
        // Try to find a resolution that fits well (e.g. 640w or 960w) to save bandwidth, or use source if not found
        const resolutions = post.preview.images[0].resolutions;
        if (resolutions && resolutions.length > 0) {
             const bestFit = resolutions.find(r => r.width >= 640) || resolutions[resolutions.length - 1];
             if (bestFit) previewSrc = bestFit.url.replace(/&amp;/g, '&');
        }
    } else if (post.thumbnail && post.thumbnail.startsWith('http') && post.thumbnail !== 'self' && post.thumbnail !== 'default' && post.thumbnail !== 'image') {
        previewSrc = post.thumbnail;
    }

    // Case 1: Video or Image Preview
    if (previewSrc && (isVideo || isGallery || post.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || post.domain.includes('redd.it') || post.domain.includes('imgur'))) {
         return (
             <div 
                className="relative mt-3 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 cursor-pointer group"
                onClick={handleMediaClick}
             >
                 <img 
                    src={previewSrc} 
                    alt="preview" 
                    className="w-full h-auto object-cover max-h-[500px] min-h-[150px]"
                    loading="lazy"
                 />
                 
                 {isVideo && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                        <div className="bg-black/50 p-3 rounded-full backdrop-blur-sm">
                            <CirclePlay size={32} className="text-white fill-white/20" />
                        </div>
                    </div>
                 )}
                 
                 {isGallery && !isVideo && (
                     <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded px-2 py-1 flex items-center gap-1.5 text-xs text-white font-medium">
                         <Layers size={12} />
                         <span>Gallery</span>
                     </div>
                 )}
             </div>
         );
    }

    // Case 2: Link Preview (No direct image, but has thumbnail)
    if (!post.selftext && post.thumbnail && post.thumbnail.startsWith('http')) {
        return (
            <div 
                className="mt-3 flex gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); window.open(post.url, '_blank'); }}
            >
                <img src={post.thumbnail} alt="thumb" className="w-20 h-20 object-cover rounded-md bg-stone-200 dark:bg-stone-700 shrink-0" />
                <div className="flex flex-col justify-center min-w-0">
                     <span className="text-sm font-medium text-stone-800 dark:text-stone-200 truncate w-full flex items-center gap-1">
                        {post.domain}
                        <ExternalLink size={12} className="text-stone-400" />
                     </span>
                     <span className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                        {post.url}
                     </span>
                </div>
            </div>
        )
    }

    // Case 3: Text Snippet
    if (post.selftext) {
        return (
            <div 
                className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-4 hover:text-stone-800 dark:hover:text-stone-300 transition-colors"
                // onClick removed to allow bubbling to card
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
           className={`bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all cursor-pointer flex ${isSeen ? 'opacity-60' : ''}`}
           onClick={() => onClick(post)}
        >
            {hasThumb && (
                <div 
                    className="w-20 md:w-24 shrink-0 bg-stone-100 dark:bg-stone-800 rounded-l-lg overflow-hidden relative group"
                    onClick={(e) => { e.stopPropagation(); handleMediaClick(e); }} 
                >
                    <img src={thumb} alt="thumb" className="w-full h-full object-cover" loading="lazy" />
                    {/* Play icon overlay if video */}
                    {(post.is_video || post.domain === 'v.redd.it') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <CirclePlay size={20} className="text-white drop-shadow-md" />
                        </div>
                    )}
                </div>
            )}
            
            <div className={`p-3 flex flex-col justify-between flex-1 min-w-0 ${!hasThumb ? 'rounded-lg' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                    <h3 className={`text-sm md:text-base font-medium leading-snug line-clamp-2 ${isSeen ? 'text-stone-500' : 'text-stone-800 dark:text-stone-200'}`}>
                        {decodeHtml(post.title)}
                    </h3>
                     {post.zenScore !== undefined && (
                        <div 
                            className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                                post.zenScore >= 80 ? 'bg-green-500' :
                                post.zenScore >= 50 ? 'bg-blue-500' : 'bg-orange-500'
                            }`}
                            title={`Zen Score: ${post.zenScore}`}
                        />
                    )}
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-stone-500 dark:text-stone-400">
                    <span 
                        className="font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline cursor-pointer truncate max-w-[100px]"
                        onClick={(e) => { e.stopPropagation(); onNavigateSub && onNavigateSub(post.subreddit); }}
                    >
                        r/{post.subreddit}
                    </span>
                    <span className="text-stone-300 dark:text-stone-700">•</span>
                    <span className="shrink-0">{formatDistanceToNow(new Date(post.created_utc * 1000), { addSuffix: false }).replace('about ', '').replace(' hours', 'h')}</span>
                    
                    <div className="flex-1"></div>
                    
                    <div className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 px-2 py-0.5 rounded text-stone-400 dark:text-stone-500">
                         <div className="flex items-center gap-1">
                            <ArrowBigUp size={14} />
                            <span>{post.score > 1000 ? `${(post.score/1000).toFixed(1)}k` : post.score}</span>
                         </div>
                         <div className="w-px h-3 bg-stone-200 dark:bg-stone-700"></div>
                         <div className="flex items-center gap-1">
                            <MessageSquare size={12} />
                            <span>{post.num_comments}</span>
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
      className={`bg-white dark:bg-stone-900 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 hover:shadow-md transition-all duration-300 mb-4 break-inside-avoid animate-enter-card flex flex-col cursor-pointer ${isSeen ? 'opacity-80' : ''}`}
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
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                post.zenScore >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50' :
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
            // onClick removed, bubbles to card
          >
            {decodeHtml(post.title)}
          </h3>

          {/* Content Preview */}
          {getMediaContent()}

          {/* Footer */}
          <div className="mt-4 flex items-center gap-4 text-stone-500 dark:text-stone-400 text-sm">
            <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/50 px-2 py-1 rounded-md">
              <ArrowBigUp size={18} className={`${post.score > 0 ? 'text-orange-600 dark:text-orange-500' : ''}`} />
              <span className="font-medium text-xs">{post.score > 1000 ? `${(post.score / 1000).toFixed(1)}k` : post.score}</span>
            </div>
            <div 
                className="flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 px-2 py-1 rounded-md transition-colors"
                // onClick removed, bubbles to card
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
                    className="flex items-center gap-1 text-xs hover:underline text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
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

