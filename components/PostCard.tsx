import React from 'react';
import { FilteredPost } from '../types';
import { MessageSquare, ArrowBigUp, Image as ImageIcon, CirclePlay } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PostCardProps {
  post: FilteredPost;
  onClick: (post: FilteredPost) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onClick }) => {
  const decodeHtml = (html: string) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const getThumbnail = () => {
    // Determine if it's a video based on API flags or URL extensions
    const isVideo = post.is_video || 
                    !!post.secure_media?.reddit_video || 
                    (post.url && !!post.url.match(/\.(mp4|gifv|webm)$/i));

    // Case 1: Has a valid image thumbnail
    if (post.thumbnail && post.thumbnail.startsWith('http')) {
      return (
        <div className="relative w-16 h-16 md:w-20 md:h-20 mr-3 md:mr-4 shrink-0 group">
          <img 
            src={post.thumbnail} 
            alt="thumb" 
            className="w-full h-full object-cover rounded-md bg-stone-200 dark:bg-stone-800" 
          />
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md group-hover:bg-black/40 transition-colors">
               <CirclePlay size={24} className="text-white drop-shadow-md" fill="rgba(0,0,0,0.3)" />
            </div>
          )}
        </div>
      );
    }
    
    // Case 2: No thumbnail, check if video for icon
    if (isVideo) {
         return (
            <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-200 dark:bg-stone-800 rounded-md mr-3 md:mr-4 flex items-center justify-center shrink-0 text-stone-500 dark:text-stone-400 border border-stone-300 dark:border-stone-700">
                <CirclePlay size={28} />
            </div>
         );
    }

    // Case 3: Default Image icon
    return (
        <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-200 dark:bg-stone-800 rounded-md mr-3 md:mr-4 flex items-center justify-center shrink-0 text-stone-400 dark:text-stone-600">
            <ImageIcon size={24} />
        </div>
    );
  };

  return (
    <div 
      onClick={() => onClick(post)}
      className="bg-white dark:bg-stone-900 p-3 md:p-4 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 hover:shadow-md transition-all cursor-pointer mb-4"
    >
      <div className="flex">
        {/* Thumbnail for quick visual context */}
        {getThumbnail()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center text-xs text-stone-500 dark:text-stone-400 mb-1 space-x-2 overflow-hidden">
            <span className="font-semibold text-stone-700 dark:text-stone-300 hover:underline truncate">r/{post.subreddit}</span>
            <span className="shrink-0">•</span>
            <span className="shrink-0">{formatDistanceToNow(new Date(post.created_utc * 1000))} ago</span>
            
            {/* Zen Badge */}
            {post.zenScore !== undefined && (
              <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                post.zenScore >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50' :
                post.zenScore >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50' :
                'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900/50'
              }`}>
                Zen: {post.zenScore}
              </span>
            )}
          </div>

          <h3 className="text-base md:text-lg font-medium text-stone-800 dark:text-stone-100 leading-snug mb-2 line-clamp-2">
            {decodeHtml(post.title)}
          </h3>

          <div className="flex items-center space-x-4 text-stone-500 dark:text-stone-400 text-sm">
            <div className="flex items-center space-x-1">
              <ArrowBigUp size={18} />
              <span>{post.score > 1000 ? `${(post.score / 1000).toFixed(1)}k` : post.score}</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageSquare size={16} />
              <span>{post.num_comments > 1000 ? `${(post.num_comments / 1000).toFixed(1)}k` : post.num_comments} <span className="hidden sm:inline">comments</span></span>
            </div>
            {/* Zen Badge for Mobile */}
             {post.zenScore !== undefined && (
              <span className={`sm:hidden px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                post.zenScore >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50' :
                post.zenScore >= 50 ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50' :
                'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900/50'
              }`}>
                Zen: {post.zenScore}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;