
import React, { useEffect, useState } from 'react';
import { RedditUserAbout } from '../types';
import { fetchUserDetails } from '../services/redditService';
import { User, Calendar, Award, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserProfileProps {
  username: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ username }) => {
  const [details, setDetails] = useState<RedditUserAbout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadDetails = async () => {
      setLoading(true);
      const data = await fetchUserDetails(username);
      if (mounted && data) {
        setDetails(data);
      }
      if (mounted) setLoading(false);
    };
    loadDetails();
    return () => { mounted = false; };
  }, [username]);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto mb-6 bg-white dark:bg-stone-900 rounded-xl p-6 shadow-sm border border-stone-200 dark:border-stone-800 animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-stone-200 dark:bg-stone-800"></div>
            <div className="space-y-2">
                <div className="w-40 h-6 bg-stone-200 dark:bg-stone-800 rounded"></div>
                <div className="w-24 h-4 bg-stone-200 dark:bg-stone-800 rounded"></div>
            </div>
        </div>
      </div>
    );
  }

  if (!details) return null;

  // Cleanup avatar URL
  const avatar = details.snoovatar_img || details.icon_img?.split('?')[0];

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 bg-gradient-to-br from-white to-stone-50 dark:from-stone-900 dark:to-stone-950 rounded-xl overflow-hidden shadow-sm border border-stone-200 dark:border-stone-800 animate-list-enter">
        <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600 relative">
             <div className="absolute -bottom-8 left-6">
                <div className="w-20 h-20 rounded-full border-4 border-white dark:border-stone-900 bg-white dark:bg-stone-800 overflow-hidden shadow-md">
                    {avatar ? (
                        <img src={avatar} alt={details.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-200 dark:bg-stone-700 text-stone-400">
                            <User size={40} />
                        </div>
                    )}
                </div>
             </div>
        </div>

        <div className="pt-10 px-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                        u/{details.name}
                    </h1>
                    <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 mt-1">
                        <Calendar size={14} />
                        <span>Joined {formatDistanceToNow(new Date(details.created_utc * 1000))} ago</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex flex-col items-center bg-stone-100 dark:bg-stone-800/50 p-3 rounded-lg min-w-[100px]">
                        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Karma</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            {details.total_karma > 1000 ? `${(details.total_karma/1000).toFixed(1)}k` : details.total_karma}
                        </span>
                    </div>
                    
                    <div className="flex flex-col gap-1 text-xs text-stone-500 dark:text-stone-400 justify-center">
                        <div className="flex items-center gap-1.5">
                            <Award size={14} className="text-orange-500" />
                            <span>{details.link_karma.toLocaleString()} Post</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MessageSquare size={14} className="text-blue-500" />
                            <span>{details.comment_karma.toLocaleString()} Comment</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default UserProfile;
