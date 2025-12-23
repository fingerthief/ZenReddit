
import React, { useEffect, useState } from 'react';
import { SubredditAbout } from '../types';
import { fetchSubredditAbout } from '../services/redditService';
import { Users, Check, Plus, Loader2 } from 'lucide-react';

interface SubredditHeaderProps {
  subreddit: string;
  isFollowed: boolean;
  onToggleFollow: () => void;
}

const SubredditHeader: React.FC<SubredditHeaderProps> = ({ subreddit, isFollowed, onToggleFollow }) => {
  const [details, setDetails] = useState<SubredditAbout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadDetails = async () => {
      setLoading(true);
      const data = await fetchSubredditAbout(subreddit);
      if (mounted && data) {
        setDetails(data);
      }
      if (mounted) setLoading(false);
    };
    loadDetails();
    return () => { mounted = false; };
  }, [subreddit]);

  if (loading) {
    return (
      <div className="w-full h-32 md:h-48 bg-stone-200 dark:bg-stone-800 animate-pulse rounded-xl mb-6 relative overflow-hidden">
        <div className="absolute bottom-4 left-4 flex items-end gap-3">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-stone-300 dark:bg-stone-700 ring-4 ring-stone-100 dark:ring-stone-900"></div>
          <div className="mb-1 space-y-2">
            <div className="h-5 w-32 bg-stone-300 dark:bg-stone-700 rounded"></div>
            <div className="h-3 w-20 bg-stone-300 dark:bg-stone-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!details) return null;

  // Determine banner image
  const bannerImg = details.banner_background_image?.split('?')[0] || details.banner_img?.split('?')[0] || details.mobile_banner_image?.split('?')[0];
  
  // Determine icon
  const iconImg = details.community_icon?.split('?')[0] || details.icon_img?.split('?')[0];
  
  // Format numbers
  const formattedSubscribers = details.subscribers >= 1000000 
    ? `${(details.subscribers / 1000000).toFixed(1)}M` 
    : details.subscribers >= 1000 
      ? `${(details.subscribers / 1000).toFixed(1)}k` 
      : details.subscribers;

  return (
    <div className="mb-6 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-sm border border-stone-200 dark:border-stone-800 animate-list-enter w-full max-w-4xl mx-auto">
      {/* Banner Area */}
      <div 
        className="h-24 md:h-40 w-full bg-stone-200 dark:bg-stone-800 bg-cover bg-center relative"
        style={{ 
          backgroundImage: bannerImg ? `url(${bannerImg})` : undefined,
          backgroundColor: details.key_color || details.primary_color || '#10b981'
        }}
      >
        {!bannerImg && (
          <div className="w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        )}
      </div>

      {/* Info Area */}
      <div className="px-4 pb-4 md:px-6 md:pb-6 relative">
        <div className="flex justify-between items-end -mt-8 md:-mt-10 mb-3">
            {/* Icon & Title */}
            <div className="flex items-end gap-3 md:gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white dark:bg-stone-900 p-1 shadow-md ring-1 ring-black/5 dark:ring-white/10 shrink-0">
                    {iconImg ? (
                        <img src={iconImg} alt={subreddit} className="w-full h-full rounded-full object-cover bg-stone-100 dark:bg-stone-800" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl md:text-2xl">
                            r/
                        </div>
                    )}
                </div>
                
                <div className="mb-1 md:mb-1.5 min-w-0">
                    <h1 className="text-lg md:text-2xl font-bold text-stone-900 dark:text-stone-100 leading-none truncate drop-shadow-sm md:drop-shadow-none shadow-black">
                        {details.title || details.display_name_prefixed}
                    </h1>
                    <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                        {details.display_name_prefixed}
                    </p>
                </div>
            </div>

            {/* Join Button (Desktop Position) */}
            <button
                onClick={onToggleFollow}
                className={`hidden md:flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all shadow-sm active:scale-95 ${
                    isFollowed 
                    ? 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 hover:border-red-500 hover:text-red-500' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-transparent'
                }`}
            >
                {isFollowed ? (
                    <>
                        <Check size={18} />
                        <span>Joined</span>
                    </>
                ) : (
                    <>
                        <Plus size={18} />
                        <span>Join</span>
                    </>
                )}
            </button>
        </div>

        {/* Description & Stats */}
        <div className="md:ml-24">
            <p className="text-sm md:text-base text-stone-700 dark:text-stone-300 mb-3 leading-relaxed line-clamp-3">
                {details.public_description}
            </p>
            
            <div className="flex items-center gap-4 text-xs md:text-sm font-medium text-stone-500 dark:text-stone-400">
                <div className="flex items-center gap-1.5">
                    <Users size={16} />
                    <span>{formattedSubscribers} members</span>
                </div>
                {details.active_user_count && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>{details.active_user_count >= 1000 ? `${(details.active_user_count/1000).toFixed(1)}k` : details.active_user_count} online</span>
                    </div>
                )}
            </div>
        </div>

        {/* Mobile Join Button (Full width) */}
        <button
            onClick={onToggleFollow}
            className={`mt-4 w-full md:hidden flex justify-center items-center gap-2 px-4 py-2.5 rounded-full font-bold transition-all active:scale-95 ${
                isFollowed 
                ? 'bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300' 
                : 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
            }`}
        >
            {isFollowed ? 'Joined' : 'Join Community'}
        </button>
      </div>
    </div>
  );
};

export default SubredditHeader;
