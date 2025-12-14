

import React, { useState } from 'react';
import { Flame, Globe, Plus, Hash, X, Trash2, Moon, Sun, ShieldCheck, Settings, Search } from 'lucide-react';
import { FeedType } from '../types';
import { searchSubreddits } from '../services/redditService';

interface SidebarProps {
  currentFeed: FeedType;
  currentSub?: string;
  onNavigate: (type: FeedType, sub?: string) => void;
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
    const results = await searchSubreddits(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="w-full md:w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 h-full md:h-screen flex flex-col shrink-0 md:sticky md:top-0 transition-colors">
      {/* Header */}
      <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-start shrink-0">
        <div>
            <h1 className="text-2xl font-light text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                ZenReddit
            </h1>
            <p className="text-xs text-stone-400 mt-1">Peaceful browsing, AI filtered.</p>
        </div>
        <div className="flex gap-1">
             <button 
                onClick={onOpenSettings} 
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1"
                title="AI Settings"
            >
                <Settings size={18} />
            </button>
            <button 
                onClick={toggleTheme} 
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1"
                title="Toggle Theme"
            >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
        </div>
      </div>

      {/* Fixed Search Area - Moved to Top */}
      <div className="px-4 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0 bg-stone-50/50 dark:bg-stone-900/50 backdrop-blur-sm z-10">
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-3 top-2.5 text-stone-400 group-focus-within:text-emerald-500 transition-colors" size={14} />
            <input 
              type="text" 
              placeholder="Add subreddit..." 
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
        {searchResults.length > 0 && (
            <div className="animate-fade-in">
                 <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Results</h3>
                    <button onClick={clearSearch} className="text-xs text-stone-400 hover:text-stone-600">Clear</button>
                 </div>
                <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-sm overflow-hidden">
                    {searchResults.map(sub => (
                        <button 
                            key={sub}
                            onClick={() => {
                                onFollow(sub);
                                clearSearch();
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center justify-between border-b border-stone-100 dark:border-stone-800 last:border-0"
                        >
                            <span>r/{sub}</span>
                            <Plus size={14} className="text-emerald-500" />
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Feeds */}
        <div>
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 px-2">Feeds</h3>
          <button 
            onClick={() => onNavigate('popular')}
            className={`w-full flex items-center space-x-3 px-2 py-2 rounded-lg transition-colors ${currentFeed === 'popular' ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
          >
            <Flame size={18} />
            <span>Popular</span>
          </button>
          <button 
            onClick={() => onNavigate('all')}
            className={`w-full flex items-center space-x-3 px-2 py-2 rounded-lg transition-colors ${currentFeed === 'all' ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
          >
            <Globe size={18} />
            <span>All</span>
          </button>
        </div>

        {/* Following List */}
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Following</h3>
            <span className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded-full">{followedSubs.length}</span>
          </div>
          
          <div className="space-y-1">
            {followedSubs.length === 0 ? (
                <div className="px-2 py-4 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-lg">
                    <p className="text-sm text-stone-400 italic mb-1">No subs yet.</p>
                    <p className="text-xs text-stone-500">Use the search above to add your favorites!</p>
                </div>
            ) : (
                followedSubs.map(sub => (
                    <div key={sub} className="group flex items-center justify-between">
                         <button 
                            onClick={() => onNavigate('subreddit', sub)}
                            className={`flex-1 flex items-center space-x-3 px-2 py-1.5 rounded-lg text-sm transition-colors text-left truncate ${currentFeed === 'subreddit' && currentSub === sub ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                        >
                            <Hash size={14} className="text-stone-400 shrink-0" />
                            <span className="truncate">{sub}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onUnfollow(sub); }} className="text-stone-300 dark:text-stone-600 hover:text-red-400 dark:hover:text-red-400 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Stats / Tracker - Moved to bottom */}
        <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
             <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-2">Zen Stats</h3>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-start space-x-3 mb-3">
                     <div className="bg-emerald-100 dark:bg-emerald-800 p-2 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                         <h3 className="text-emerald-900 dark:text-emerald-100 font-semibold text-sm">Zen Shield</h3>
                         <p className="text-emerald-600 dark:text-emerald-500 text-[10px]">Active & Protecting</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-2 text-center backdrop-blur-sm">
                        <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 leading-none">
                            {blockedCount}
                        </div>
                        <div className="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wide mt-1">
                            Filtered
                        </div>
                    </div>
                    <div className="bg-white/60 dark:bg-black/20 rounded-lg p-2 text-center backdrop-blur-sm">
                        <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 leading-none">
                            {blockedCommentCount}
                        </div>
                        <div className="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wide mt-1">
                            Toxic Cmts
                        </div>
                    </div>
                </div>
            </div>
        </div>

      </nav>
    </div>
  );
};

export default Sidebar;
