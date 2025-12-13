
import React, { useState, useEffect, useRef } from 'react';
import { Hash, X, Search, Globe, Flame, Layers } from 'lucide-react';
import { FeedType } from '../types';

interface QuickSubSwitcherProps {
  followedSubs: string[];
  onNavigate: (type: FeedType, sub?: string) => void;
  currentFeed: FeedType;
  currentSub?: string;
}

const QuickSubSwitcher: React.FC<QuickSubSwitcherProps> = ({
  followedSubs,
  onNavigate,
  currentFeed,
  currentSub
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      setFilter('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSelect = (type: FeedType, sub?: string) => {
    onNavigate(type, sub);
    setIsOpen(false);
  };

  const filteredSubs = followedSubs.filter(sub => 
    sub.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      {/* FAB Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className={`md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-900/20 flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all duration-200 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Quick Switch Subreddit"
      >
        <Layers size={24} />
      </button>

      {/* Modal / Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={() => setIsOpen(false)}
            />
            
            {/* Sheet Content */}
            <div className="bg-white dark:bg-stone-900 w-full rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up relative z-10 border-t border-stone-200 dark:border-stone-800">
                {/* Drag Handle (Visual cue) */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={() => setIsOpen(false)}>
                    <div className="w-12 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full opacity-50"></div>
                </div>

                {/* Header */}
                <div className="px-4 pb-4 flex items-center justify-between shrink-0">
                    <h3 className="font-semibold text-lg text-stone-800 dark:text-stone-200">Quick Switch</h3>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 pb-2 shrink-0">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Find a subreddit..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full bg-stone-100 dark:bg-stone-800 border-2 border-transparent focus:border-emerald-500/50 rounded-xl py-3 pl-10 pr-4 text-base text-stone-800 dark:text-stone-200 placeholder-stone-400 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Scrollable List */}
                <div className="overflow-y-auto p-4 space-y-4 overscroll-contain pb-8 min-h-[40vh]">
                    
                    {/* Standard Feeds (Only show if not filtering or if filter matches them) */}
                    {(!filter || "popular".includes(filter.toLowerCase()) || "all".includes(filter.toLowerCase())) && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider px-2">Feeds</p>
                            
                            {(!filter || "popular".includes(filter.toLowerCase())) && (
                                <button 
                                    onClick={() => handleSelect('popular')}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all active:scale-[0.98] ${
                                        currentFeed === 'popular' 
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800' 
                                        : 'bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                                    }`}
                                >
                                    <div className={`p-2.5 rounded-full ${currentFeed === 'popular' ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300' : 'bg-white dark:bg-stone-700 text-stone-500 dark:text-stone-400'}`}>
                                        <Flame size={20} fill={currentFeed === 'popular' ? "currentColor" : "none"} />
                                    </div>
                                    <span className="font-semibold text-lg">Popular</span>
                                </button>
                            )}
                            
                            {(!filter || "all".includes(filter.toLowerCase())) && (
                                <button 
                                    onClick={() => handleSelect('all')}
                                    className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all active:scale-[0.98] ${
                                        currentFeed === 'all' 
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800' 
                                        : 'bg-stone-50 dark:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                                    }`}
                                >
                                    <div className={`p-2.5 rounded-full ${currentFeed === 'all' ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300' : 'bg-white dark:bg-stone-700 text-stone-500 dark:text-stone-400'}`}>
                                        <Globe size={20} />
                                    </div>
                                    <span className="font-semibold text-lg">All</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Following List */}
                    <div className="space-y-2">
                         <div className="flex items-center justify-between px-2">
                             <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Following</p>
                             <span className="text-xs text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">{filteredSubs.length}</span>
                         </div>
                         
                         {filteredSubs.length === 0 ? (
                             <div className="text-center py-10 bg-stone-50 dark:bg-stone-800/30 rounded-xl border border-dashed border-stone-200 dark:border-stone-700">
                                 <p className="text-stone-500 dark:text-stone-400 font-medium">
                                     {filter ? 'No subreddits found' : 'No followed subreddits'}
                                 </p>
                                 {!filter && <p className="text-xs text-stone-400 mt-1">Search via sidebar to add some!</p>}
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 gap-2">
                                 {filteredSubs.map(sub => (
                                     <button
                                         key={sub}
                                         onClick={() => handleSelect('subreddit', sub)}
                                         className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98] ${
                                            currentFeed === 'subreddit' && currentSub === sub
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800' 
                                            : 'bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-100 dark:border-stone-800 text-stone-700 dark:text-stone-300'
                                         }`}
                                     >
                                         <div className={`p-2 rounded-full shrink-0 ${currentFeed === 'subreddit' && currentSub === sub ? 'bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}>
                                            <Hash size={18} />
                                         </div>
                                         <span className="font-medium truncate text-base">r/{sub}</span>
                                     </button>
                                 ))}
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default QuickSubSwitcher;
