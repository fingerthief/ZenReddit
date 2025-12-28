import React, { useState, useEffect, useRef } from 'react';
import { Hash, X, Search, Globe, Flame, Layers, Plus, Loader2 } from 'lucide-react';
import { FeedType } from '../types';
import { searchSubreddits } from '../services/redditService';

interface QuickSubSwitcherProps {
  followedSubs: string[];
  onNavigate: (type: FeedType, sub?: string) => void;
  onFollow: (sub: string) => void;
  currentFeed: FeedType;
  currentSub?: string;
  forceOpen?: boolean;
  onClose?: () => void;
}

const QuickSubSwitcher: React.FC<QuickSubSwitcherProps> = ({
  followedSubs,
  onNavigate,
  onFollow,
  currentFeed,
  currentSub,
  forceOpen = false,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [filter, setFilter] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      setFilter('');
      setSearchResults([]);
      setIsSearching(false);
      if (onClose) onClose();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleClose = () => {
      setIsOpen(false);
  };

  const handleSelect = (type: FeedType, sub?: string) => {
    onNavigate(type, sub);
    handleClose();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filter.trim()) return;
    setIsSearching(true);
    try {
        const results = await searchSubreddits(filter);
        setSearchResults(results);
    } catch (e) {
        console.error("Search failed", e);
    } finally {
        setIsSearching(false);
    }
  };

  const filteredSubs = followedSubs.filter(sub => 
    sub.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      {/* FAB Trigger - Only shown if NOT forced open (i.e. Desktop Mode) */}
      {!forceOpen && (
        <button
            onClick={() => setIsOpen(true)}
            className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-900/20 flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all duration-200 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
            aria-label="Quick Switch Subreddit"
        >
            <Layers size={24} />
        </button>
      )}

      {/* Modal / Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end md:justify-center md:items-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={handleClose}
            />
            
            {/* Sheet Content */}
            <div className="bg-white dark:bg-stone-900 w-full md:w-[600px] md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] md:max-h-[80vh] flex flex-col animate-slide-up relative z-10 border-t border-stone-200 dark:border-stone-800 md:border-none pb-safe">
                {/* Drag Handle (Visual cue mobile only) */}
                <div className="w-full flex justify-center pt-3 pb-1 md:hidden" onClick={handleClose}>
                    <div className="w-12 h-1.5 bg-stone-300 dark:bg-stone-700 rounded-full opacity-50"></div>
                </div>

                {/* Header */}
                <div className="px-4 pb-4 md:pt-4 flex items-center justify-between shrink-0">
                    <h3 className="font-semibold text-lg text-stone-800 dark:text-stone-200">Explore & Search</h3>
                    <button 
                        onClick={handleClose}
                        className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 pb-2 shrink-0">
                    <form onSubmit={handleSearch} className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Find or search subreddits..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full bg-stone-100 dark:bg-stone-800 border-2 border-transparent focus:border-emerald-500/50 rounded-xl py-3 pl-10 pr-10 text-base text-stone-800 dark:text-stone-200 placeholder-stone-400 outline-none transition-all"
                        />
                        {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="animate-spin text-emerald-500" size={18} />
                            </div>
                        )}
                    </form>
                </div>

                {/* Scrollable List */}
                <div className="overflow-y-auto p-4 space-y-4 overscroll-contain pb-8 min-h-[40vh] custom-scrollbar">
                    
                    {/* Search Results (Remote) */}
                    {searchResults.length > 0 && (
                        <div className="space-y-2 mb-4">
                             <div className="flex items-center justify-between px-2">
                                 <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Search Results</p>
                                 <button onClick={() => setSearchResults([])} className="text-xs text-stone-400">Clear</button>
                             </div>
                             <div className="grid grid-cols-1 gap-2">
                                 {searchResults.map(sub => (
                                     <button
                                         key={sub}
                                         onClick={() => {
                                             onFollow(sub);
                                             handleSelect('subreddit', sub);
                                         }}
                                         className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-emerald-100 dark:border-emerald-900/30 text-stone-700 dark:text-stone-300 shadow-sm transition-all active:scale-[0.98]"
                                     >
                                         <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 rounded-full shrink-0 bg-stone-100 dark:bg-stone-800 text-stone-500">
                                                <Hash size={18} />
                                            </div>
                                            <span className="font-medium truncate text-base">r/{sub}</span>
                                         </div>
                                         <Plus size={18} className="text-emerald-500 shrink-0" />
                                     </button>
                                 ))}
                             </div>
                        </div>
                    )}

                    {/* Standard Feeds (Only show if not filtering or if filter matches them) */}
                    {(!filter || "popular".includes(filter.toLowerCase()) || "all".includes(filter.toLowerCase())) && searchResults.length === 0 && (
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
                                     {filter ? 'No followed subreddits match' : 'No followed subreddits'}
                                 </p>
                                 {!filter && <p className="text-xs text-stone-400 mt-1">Search via the top bar to add some!</p>}
                                 {filter && searchResults.length === 0 && !isSearching && (
                                     <button 
                                        onClick={handleSearch}
                                        className="mt-3 text-emerald-600 dark:text-emerald-500 text-sm font-medium hover:underline"
                                     >
                                         Search Reddit for "{filter}"
                                     </button>
                                 )}
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