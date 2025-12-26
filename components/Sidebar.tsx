import React, { useState } from 'react';
import { Flame, Globe, Plus, Hash, X, Trash2, Moon, Sun, ShieldCheck, Settings, Search, ArrowRight } from 'lucide-react';
import { FeedType } from '../types';
import { searchSubreddits } from '../services/redditService';

interface SidebarProps {
  currentFeed: FeedType;
  currentSub?: string;
  onNavigate: (type: FeedType, sub?: string, query?: string) => void;
  followedSubs: string[];
  onFollow: (sub: string) => void;
  onUnfollow: (sub: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  blockedCount: number;
  blockedCommentCount: number;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentFeed, 
  currentSub, 
  onNavigate, 
  followedSubs, 
  onFollow,
  onUnfollow,
  theme,
  toggleTheme,
  blockedCount,
  blockedCommentCount,
  onOpenSettings
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
        const results = await searchSubreddits(searchQuery);
        setSearchResults(results);
    } catch (error) {
        console.error("Search failed", error);
    } finally {
        setIsSearching(false);
    }
  };

  const handleSearchPosts = () => {
    if (!searchQuery.trim()) return;
    onNavigate('search', undefined, searchQuery);
    clearSearch();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="w-full md:w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 h-full flex flex-col shrink-0 transition-colors">
      {/* Header */}
      <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-start shrink-0 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
        <div className="cursor-pointer" onClick={() => onNavigate('popular')}>
            <h1 className="text-2xl font-light text-stone-800 dark:text-stone-100 flex items-center gap-2 select-none">
                <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"></span>
                ZenReddit
            </h1>
            <p className="text-xs text-stone-400 mt-1">Peaceful browsing, AI filtered.</p>
        </div>
        <div className="flex gap-1">
             <button 
                onClick={onOpenSettings} 
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 btn-press"
                title="AI Settings"
            >
                <Settings size={18} />
            </button>
            <button 
                onClick={toggleTheme} 
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 btn-press"
                title="Toggle Theme"
            >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
        </div>
      </div>

      {/* Fixed Search Area */}
      <div className="px-4 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0 bg-stone-50/50 dark:bg-stone-900/50 backdrop-blur-sm z-10">
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-3 top-2.5 text-stone-400 group-focus-within:text-emerald-500 transition-colors" size={14} />
            <input 
              type="text" 
              placeholder="Search / Add sub..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg pl-9 pr-8 py-2 text-sm text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-stone-400"
            />
            {searchQuery && (
                <button type="button" onClick={clearSearch} className="absolute right-2 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
                    <X size={14} />
                </button>
            )}
          </form>
      </div>

      {/* Scrollable Nav Area */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* Search Results Display */}
        {searchQuery.length > 0 && (
            <div className="animate-fade-in">
                 <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Results</h3>
                    <button onClick={clearSearch} className="text-xs text-stone-400 hover:text-stone-600">Clear</button>
                 </div>
                <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-sm overflow-hidden">
                    {/* Search Posts Option */}
                    <button
                        onClick={handleSearchPosts}
                        className="w-full text-left px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2 border-b border-stone-100 dark:border-stone-800 transition-colors"
                    >
                        <Search size={14} className="text-emerald-500" />
                        <span className="truncate font-medium">Search posts for "{searchQuery}"</span>
                        <ArrowRight size={12} className="ml-auto text-stone-400" />
                    </button>

                    {searchResults.map(sub => (
                        <div 
                            key={sub}
                            className="w-full flex items-center border-b border-stone-100 dark:border-stone-800 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                        >
                            <button 
                                onClick={() => {
                                    onNavigate('subreddit', sub);
                                    clearSearch();
                                }}
                                className="flex-1 text-left px-3 py-2 text-sm text-stone-600 dark:text-stone-300 truncate"
                            >
                                r/{sub}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFollow(sub);
                                    clearSearch();
                                }}
                                className="p-2 px-3 text-stone-400 hover:text-emerald-500 transition-colors border-l border-stone-100 dark:border-stone-800/50"
                                title="Follow"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    ))}
                    {searchResults.length === 0 && !isSearching && (
                        <div className="px-3 py-4 text-center text-xs text-stone-400">
                            No subreddits found.
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Standard Feeds */}
        {!searchQuery && (
          <div>
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-2">Feeds</h3>
            <div className="space-y-1">
              <button
                onClick={() => onNavigate('popular')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentFeed === 'popular' 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Flame size={18} />
                Popular
              </button>
              <button
                onClick={() => onNavigate('all')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentFeed === 'all' 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <Globe size={18} />
                All
              </button>
            </div>
          </div>
        )}

        {/* Following List */}
        {!searchQuery && (
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Following</h3>
                <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded-full">{followedSubs.length}</span>
            </div>
            
            <div className="space-y-1">
              {followedSubs.map(sub => (
                <div 
                    key={sub}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                        currentFeed === 'subreddit' && currentSub === sub
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                >
                  <button
                    onClick={() => onNavigate('subreddit', sub)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <Hash size={16} className="shrink-0 opacity-70" />
                    <span className="text-sm font-medium truncate">r/{sub}</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if(confirm(`Unfollow r/${sub}?`)) onUnfollow(sub);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all"
                    title="Unfollow"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              
              {followedSubs.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-stone-200 dark:border-stone-800 rounded-lg">
                      <p className="text-xs text-stone-400">No subscriptions yet.</p>
                      <p className="text-[10px] text-stone-300 dark:text-stone-600 mt-1">Use search to add some!</p>
                  </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Footer Stats */}
      <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 shrink-0">
          <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  Zen Shield Active
              </span>
          </div>
          <div className="space-y-1.5">
               <div className="flex justify-between text-[10px] text-stone-400">
                   <span>Blocked Posts</span>
                   <span className="font-mono">{blockedCount}</span>
               </div>
               <div className="w-full h-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(blockedCount, 100)}%` }}></div>
               </div>
               
               <div className="flex justify-between text-[10px] text-stone-400 mt-2">
                   <span>Toxic Comments Hidden</span>
                   <span className="font-mono">{blockedCommentCount}</span>
               </div>
               <div className="w-full h-1 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(blockedCommentCount, 100)}%` }}></div>
               </div>
          </div>
      </div>
    </div>
  );
};

export default Sidebar;