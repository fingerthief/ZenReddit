import React, { useEffect, useState, useRef } from 'react';
import { FilteredPost, RedditComment } from '../types';
import { fetchComments } from '../services/redditService';
import { X, ExternalLink, Loader2, ArrowBigUp, ChevronLeft } from 'lucide-react';
import Hls from 'hls.js';

interface PostDetailProps {
  post: FilteredPost;
  onClose: () => void;
}

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
            <div className="prose prose-stone dark:prose-invert max-w-none mb-6 whitespace-pre-line text-sm md:text-base">
              {post.selftext}
            </div>
          )}

          <div className="border-t border-stone-100 dark:border-stone-800 my-6"></div>

          <h3 className="text-lg font-medium text-stone-700 dark:text-stone-300 mb-4">Comments</h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.data.id} className="bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-stone-600 dark:text-stone-400">{comment.data.author}</span>
                    <div className="flex items-center text-xs text-stone-400">
                        <ArrowBigUp size={14} className="mr-1"/>
                        {comment.data.score}
                    </div>
                  </div>
                  <div className="text-sm text-stone-800 dark:text-stone-200 prose prose-sm dark:prose-invert max-w-none break-words">
                     {decodeHtml(comment.data.body)}
                  </div>
                </div>
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