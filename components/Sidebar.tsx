
import React, { useState } from 'react';
import { Flame, Globe, Plus, Hash, X, Trash2, Moon, Sun, ShieldCheck, Settings } from 'lucide-react';
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
    <div className="w-full md:w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 md:h-screen flex flex-col shrink-0 md:sticky md:top-0 transition-colors">
      <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-start">
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

      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Visual Tracker */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
            <div className="flex items-center space-x-3 mb-1">
                <div className="bg-emerald-100 dark:bg-emerald-800 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={20} />
                </div>
                <div>
                    <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 leading-none">
                        {blockedCount}
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium uppercase tracking-wide mt-1">
                        Rage Baits Blocked
                    </div>
                </div>
            </div>
        </div>

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

        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Following</h3>
          </div>
          
          <div className="space-y-1">
            {followedSubs.length === 0 ? (
                <p className="px-2 text-sm text-stone-400 italic">No subs followed yet.</p>
            ) : (
                followedSubs.map(sub => (
                    <div key={sub} className="group flex items-center justify-between">
                         <button 
                            onClick={() => onNavigate('subreddit', sub)}
                            className={`flex-1 flex items-center space-x-3 px-2 py-1.5 rounded-lg text-sm transition-colors text-left truncate ${currentFeed === 'subreddit' && currentSub === sub ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                        >
                            <Hash size={14} className="text-stone-400" />
                            <span className="truncate">{sub}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onUnfollow(sub); }} className="text-stone-300 dark:text-stone-600 hover:text-red-400 dark:hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2 px-2">Add Subreddit</h3>
          <form onSubmit={handleSearch} className="relative mb-2">
            <input 
              type="text" 
              placeholder="Search subs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-600 placeholder-stone-400"
            />
            {searchQuery && (
                <button type="button" onClick={clearSearch} className="absolute right-2 top-2.5 text-stone-400 hover:text-stone-600">
                    <X size={14} />
                </button>
            )}
          </form>

          {searchResults.length > 0 && (
            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg overflow-hidden">
                {searchResults.map(sub => (
                    <button 
                        key={sub}
                        onClick={() => {
                            onFollow(sub);
                            clearSearch();
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center justify-between"
                    >
                        <span>r/{sub}</span>
                        <Plus size={14} />
                    </button>
                ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
