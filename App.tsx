import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import ImageViewer from './components/ImageViewer';
import SettingsModal from './components/SettingsModal';
import ScanningVisualizer from './components/ScanningVisualizer';
import QuickSubSwitcher from './components/QuickSubSwitcher';
import LazyRender from './components/LazyRender';
import { FeedType, FilteredPost, RedditPostData, AIConfig, SortOption, TopTimeOption, CachedAnalysis, GalleryItem, ViewMode } from './types';
import { fetchFeed } from './services/redditService';
import { analyzePostsForZen, AnalysisResult } from './services/aiService';
import { Loader2, RefreshCw, Menu, CloudOff, TriangleAlert, Search, ChevronDown, LayoutGrid, List } from 'lucide-react';

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.warn(`Failed to load ${key} from storage`, e);
    return defaultValue;
  }
};

const SEEN_EXPIRY_MS = 72 * 60 * 60 * 1000;

// Optimized skeleton component
const PostSkeleton: React.FC<{ viewMode: ViewMode }> = React.memo(({ viewMode }) => {
    if (viewMode === 'compact') {
        return (
            <div className="bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 mb-2 animate-pulse flex overflow-hidden w-full h-[100px]">
                 <div className="w-[80px] sm:w-[110px] bg-stone-200 dark:bg-stone-800 shrink-0 h-full"></div>
                 <div className="flex-1 p-3 flex flex-col justify-between">
                     <div className="space-y-2">
                         <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-full"></div>
                         <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-2/3"></div>
                     </div>
                 </div>
            </div>
        )
    }
    
    return (
      <div className="bg-white dark:bg-stone-900 p-4 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 mb-6 animate-pulse break-inside-avoid w-full h-[400px]">
        <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-stone-200 dark:bg-stone-800 rounded-full"></div>
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-24"></div>
        </div>
        <div className="space-y-2 mb-4">
            <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4"></div>
        </div>
        <div className="h-48 bg-stone-200 dark:bg-stone-800 rounded-lg mb-3"></div>
      </div>
    );
});

const App: React.FC = () => {
  // Navigation State
  const [currentFeed, setCurrentFeed] = useState<FeedType>(() => loadFromStorage('zen_last_feed', 'popular'));
  const [currentSub, setCurrentSub] = useState<string | undefined>(() => loadFromStorage('zen_last_sub', undefined));
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>(() => loadFromStorage('zen_last_search', ''));
  const [navHistory, setNavHistory] = useState<{feed: FeedType, sub?: string, query?: string}[]>([]);
  
  // Local UI state for search input
  const [searchInput, setSearchInput] = useState('');

  // Sorting State
  const [currentSort, setCurrentSort] = useState<SortOption>(() => loadFromStorage<SortOption>('zen_sort', 'hot'));
  const [currentTopTime, setCurrentTopTime] = useState<TopTimeOption>(() => loadFromStorage<TopTimeOption>('zen_top_time', 'day'));

  // View Mode State
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadFromStorage<ViewMode>('zen_view_mode', 'card'));

  // Page Size State
  const [pageSize, setPageSize] = useState<number>(() => loadFromStorage<number>('zen_page_size', 25));

  // Text Size State
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>(() => loadFromStorage<'small' | 'medium' | 'large'>('zen_text_size', 'medium'));

  // Data State
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedPost, setSelectedPost] = useState<FilteredPost | null>(null);
  const [viewingGallery, setViewingGallery] = useState<{ items: GalleryItem[], index: number } | null>(null);
  
  const [after, setAfter] = useState<string | null>(null);
  
  // Cache State
  const [analysisCache, setAnalysisCache] = useState<Record<string, CachedAnalysis>>(() => loadFromStorage<Record<string, CachedAnalysis>>('zen_analysis_cache', {}));
  
  // User Preferences State
  const [followedSubs, setFollowedSubs] = useState<string[]>(() => loadFromStorage<string[]>('zen_followed_subs', []));
  const [blockedCount, setBlockedCount] = useState(() => loadFromStorage<number>('zen_blocked_count', 0));
  const [blockedCommentCount, setBlockedCommentCount] = useState(() => loadFromStorage<number>('zen_blocked_comment_count', 0));
  
  // Seen Posts State
  const [seenPosts, setSeenPosts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('zen_seen_posts');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      // Clean up old seen posts on boot
      const now = Date.now();
      const cleaned: Record<string, number> = {};
      Object.entries(parsed).forEach(([id, timestamp]) => {
         if (typeof timestamp === 'number' && (now - timestamp) < SEEN_EXPIRY_MS) {
             cleaned[id] = timestamp;
         }
      });
      return cleaned;
    } catch (e) {
      return {};
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('zen_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => ({
    provider: 'openrouter',
    minZenScore: 50,
    analyzeComments: false,
    ...loadFromStorage('zen_ai_config', {})
  }));
  
  // UI State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Touch / Gestures state
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const isAtTopRef = useRef(false);
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // --- Effects for Persistence ---
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('zen_theme', theme);
  }, [theme]);

  // Batch save effect for simple configs
  useEffect(() => {
    localStorage.setItem('zen_last_feed', JSON.stringify(currentFeed));
    if (currentSub) localStorage.setItem('zen_last_sub', JSON.stringify(currentSub));
    else localStorage.removeItem('zen_last_sub');
    if (currentSearchQuery) localStorage.setItem('zen_last_search', JSON.stringify(currentSearchQuery));
    localStorage.setItem('zen_sort', JSON.stringify(currentSort));
    localStorage.setItem('zen_top_time', JSON.stringify(currentTopTime));
    localStorage.setItem('zen_page_size', JSON.stringify(pageSize));
    localStorage.setItem('zen_text_size', JSON.stringify(textSize));
    localStorage.setItem('zen_view_mode', viewMode);
    localStorage.setItem('zen_followed_subs', JSON.stringify(followedSubs));
    localStorage.setItem('zen_ai_config', JSON.stringify(aiConfig));
    localStorage.setItem('zen_blocked_count', blockedCount.toString());
    localStorage.setItem('zen_blocked_comment_count', blockedCommentCount.toString());
  }, [currentFeed, currentSub, currentSearchQuery, currentSort, currentTopTime, pageSize, textSize, viewMode, followedSubs, aiConfig, blockedCount, blockedCommentCount]);

  // Debounced save for expensive objects (seenPosts, analysisCache)
  useEffect(() => {
    const timer = setTimeout(() => {
        try {
            localStorage.setItem('zen_seen_posts', JSON.stringify(seenPosts));
        } catch(e) {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [seenPosts]);

  useEffect(() => {
    const timer = setTimeout(() => {
        try {
            const now = Date.now();
            const expiry = 7 * 24 * 60 * 60 * 1000;
            const cleaned: Record<string, CachedAnalysis> = {};
            // Basic pruning of cache
            const entries = Object.entries(analysisCache) as [string, CachedAnalysis][];
            // Limit cache size to 500 items to prevent storage overflow
            const startIndex = Math.max(0, entries.length - 500);
            
            for (let i = startIndex; i < entries.length; i++) {
                const [key, val] = entries[i];
                if (now - val.timestamp < expiry) {
                    cleaned[key] = val;
                }
            }
            localStorage.setItem('zen_analysis_cache', JSON.stringify(cleaned));
        } catch (e) {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [analysisCache]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (viewingGallery) setViewingGallery(null);
      else if (selectedPost) setSelectedPost(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPost, viewingGallery]);

  // Sync search input with currentSearchQuery
  useEffect(() => {
    if (currentFeed === 'search') {
      setSearchInput(currentSearchQuery);
    } else {
      setSearchInput('');
    }
  }, [currentSearchQuery, currentFeed]);

  // --- Handlers ---
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const handleFollow = (sub: string) => !followedSubs.includes(sub) && setFollowedSubs(prev => [...prev, sub]);
  const handleUnfollow = (sub: string) => setFollowedSubs(prev => prev.filter(s => s !== sub));
  const handleSaveSettings = (config: AIConfig) => setAiConfig(config);

  const handlePostClick = useCallback((post: FilteredPost) => {
      try { window.history.pushState({ postOpen: true }, '', null); } catch (e) {}
      setSelectedPost(post);
      setSeenPosts(prev => ({ ...prev, [post.id]: Date.now() }));
  }, []);

  const handleGalleryClick = useCallback((items: GalleryItem[], index: number) => {
      try { window.history.pushState({ imageOpen: true }, '', null); } catch (e) {}
      setViewingGallery({ items, index });
  }, []);

  const handlePostClose = () => {
      if (window.history.state?.postOpen) try { window.history.back(); } catch(e) { setSelectedPost(null); }
      else setSelectedPost(null);
  };

  const handleGalleryClose = () => {
      if (window.history.state?.imageOpen) try { window.history.back(); } catch(e) { setViewingGallery(null); }
      else setViewingGallery(null);
  };

  const handleCommentsBlocked = (count: number) => {
      setBlockedCommentCount(prev => prev + count);
  };

  const handleNavigate = (type: FeedType, sub?: string, query?: string) => {
    if (type === currentFeed && sub === currentSub && query === currentSearchQuery) {
        setMobileMenuOpen(false);
        return;
    }
    
    // Abort any ongoing fetches immediately
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }

    setNavHistory(prev => [...prev, { feed: currentFeed, sub: currentSub, query: currentSearchQuery }]);
    setCurrentFeed(type);
    setCurrentSub(sub);
    if (type === 'search' && query) {
        setCurrentSearchQuery(query);
    } else if (type !== 'search') {
        setCurrentSearchQuery('');
    }
    setMobileMenuOpen(false);
    if (selectedPost) setSelectedPost(null);
    setViewingGallery(null);
    
    // Scroll back to top on navigate
    if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
        handleNavigate('search', undefined, searchInput.trim());
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if (viewingGallery || selectedPost || settingsOpen) return;
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (mainScrollRef.current) {
          isAtTopRef.current = mainScrollRef.current.scrollTop <= 1;
      }
      setIsPulling(false); 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || viewingGallery || selectedPost || settingsOpen) return;
    const currentY = e.touches[0].clientY;
    const dy = currentY - touchStartRef.current.y;
    const dx = e.touches[0].clientX - touchStartRef.current.x;

    if (isAtTopRef.current && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
         const newPullY = Math.min(dy * 0.45, 150);
         setPullY(newPullY);
         setIsPulling(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const startX = touchStartRef.current.x;
      const startY = touchStartRef.current.y;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      setIsPulling(false);
      
      if (pullY > 60) { 
          setPullY(60); 
          setIsRefreshing(true);
          loadPosts(false).finally(() => {
              setIsRefreshing(false);
              setPullY(0);
          });
      } else {
          setPullY(0); 
      }

      // Swipe back navigation
      if (pullY < 10 && startX < 40 && !viewingGallery && !selectedPost && !settingsOpen) {
          const dx = endX - startX;
          const dy = Math.abs(endY - startY);
          if (dx > 80 && dy < 60 && navHistory.length > 0) {
              const prev = navHistory[navHistory.length - 1];
              setNavHistory(prevH => prevH.slice(0, -1));
              handleNavigate(prev.feed, prev.sub, prev.query);
          }
      }
      
      touchStartRef.current = null;
  };

  const handlePostNavigateSub = (sub: string) => handleNavigate('subreddit', sub);

  const loadPosts = useCallback(async (isLoadMore = false) => {
    // If loading or analyzing, allow refresh (isLoadMore=false), but block duplicate loadMore
    if ((loading || analyzing) && isLoadMore) return;
    
    // Cancel previous request if starting a new feed load
    if (!isLoadMore) {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
    }

    if (!isLoadMore) {
        if (!isRefreshing) setPosts([]); 
        setLoading(true);
        setError(null);
    } else {
        setAnalyzing(true);
    }

    try {
      // Small delay to allow UI to update if switching feeds rapidly
      if (!isLoadMore) await new Promise(resolve => setTimeout(resolve, 50));
      
      if (abortControllerRef.current?.signal.aborted) return;

      const { posts: rawPostsData, after: newAfter } = await fetchFeed(
        currentFeed, 
        currentSub, 
        isLoadMore ? after : null,
        followedSubs,
        currentSearchQuery,
        currentSort,
        currentTopTime,
        pageSize
      );
      
      if (abortControllerRef.current?.signal.aborted) return;

      setAfter(newAfter);
      const rawPosts = rawPostsData.map(p => p.data);

      if (rawPosts.length === 0) {
          if (!isLoadMore) setLoading(false);
          setAnalyzing(false);
          return;
      }

      const postsToAnalyze: RedditPostData[] = [];
      const newCache = { ...analysisCache };
      let newAnalysisResults: AnalysisResult[] = [];

      const postsWithCache = rawPosts.map(p => {
          if (newCache[p.id]) {
              return { ...p, ...newCache[p.id] };
          } else {
              postsToAnalyze.push(p);
              return p; 
          }
      });

      if (postsToAnalyze.length > 0) {
          try {
             // Only analyze if we have an API key, otherwise fallback happens inside service
             newAnalysisResults = await analyzePostsForZen(postsToAnalyze, aiConfig);
             
             if (abortControllerRef.current?.signal.aborted) return;

             newAnalysisResults.forEach(res => {
                 newCache[res.id] = { ...res, timestamp: Date.now() };
             });
             setAnalysisCache(newCache);
          } catch (e) {
              console.warn("Analysis error", e);
          }
      }

      const finalPosts = postsWithCache.map((p: any) => {
           const fresh = newAnalysisResults.find(r => r.id === p.id);
           if (fresh) return { ...p, ...fresh };
           if (newCache[p.id]) return { ...p, ...newCache[p.id] };
           return p;
      });

      const threshold = aiConfig.minZenScore ?? 50;
      const filtered = finalPosts.filter((p: any) => (p.zenScore ?? 50) >= threshold);
      
      const blocked = finalPosts.length - filtered.length;
      if (blocked > 0) setBlockedCount(prev => prev + blocked);

      setPosts(prev => isLoadMore ? [...prev, ...filtered] : filtered);

    } catch (err: any) {
        if (err.name !== 'AbortError') {
             setError(err.message || "Failed to load feed");
        }
    } finally {
        if (!abortControllerRef.current?.signal.aborted) {
            setLoading(false);
            setAnalyzing(false);
        }
    }
  }, [loading, analyzing, currentFeed, currentSub, after, followedSubs, currentSearchQuery, currentSort, currentTopTime, pageSize, analysisCache, aiConfig, isRefreshing]);

  // Initial Load & Config Change Reload
  useEffect(() => {
      loadPosts(false);
      return () => {
          if (abortControllerRef.current) abortControllerRef.current.abort();
      };
  }, [currentFeed, currentSub, currentSearchQuery, currentSort, currentTopTime, pageSize, aiConfig.provider, aiConfig.openRouterModel, aiConfig.customInstructions, followedSubs]); 

  // Infinite Scroll Observer
  useEffect(() => {
      if (!observerTarget.current || loading || analyzing || !after) return;
      
      const observer = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) {
              loadPosts(true);
          }
      }, { 
          threshold: 0.1,
          root: mainScrollRef.current
      });
      
      observer.observe(observerTarget.current);
      return () => observer.disconnect();
  }, [observerTarget, loading, analyzing, after, loadPosts]);

  return (
    <div 
        className="flex bg-stone-100 dark:bg-stone-950 h-screen w-full overflow-hidden font-sans text-stone-900 dark:text-stone-100 transition-colors" 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 z-40 flex items-center justify-between px-4 transition-all duration-300">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-stone-600 dark:text-stone-300 btn-press rounded-full">
           <Menu size={24} />
        </button>
        <span className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">ZenReddit</span>
        <div className="w-8"></div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)}></div>
              <div className="absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-stone-900 shadow-2xl animate-modal-spring origin-left">
                  <Sidebar 
                    currentFeed={currentFeed}
                    currentSub={currentSub}
                    onNavigate={handleNavigate}
                    followedSubs={followedSubs}
                    onFollow={handleFollow}
                    onUnfollow={handleUnfollow}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    blockedCount={blockedCount}
                    blockedCommentCount={blockedCommentCount}
                    onOpenSettings={() => { setSettingsOpen(true); setMobileMenuOpen(false); }}
                  />
              </div>
          </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0 h-full w-64 z-20 shadow-lg">
          <Sidebar 
            currentFeed={currentFeed}
            currentSub={currentSub}
            onNavigate={handleNavigate}
            followedSubs={followedSubs}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            theme={theme}
            toggleTheme={toggleTheme}
            blockedCount={blockedCount}
            blockedCommentCount={blockedCommentCount}
            onOpenSettings={() => setSettingsOpen(true)}
          />
      </div>

      {/* Pull to Refresh Indicator */}
      <div className="fixed top-20 left-0 right-0 md:left-64 z-0 flex justify-center pointer-events-none">
         <div 
             className="bg-white dark:bg-stone-800 p-2.5 rounded-full shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center transition-all duration-200 ease-out"
             style={{ 
                 opacity: Math.min(pullY / 40, 1), 
                 transform: `scale(${Math.min(pullY/50, 1)}) translateY(${pullY * 0.2}px)`,
                 visibility: pullY > 0 || isRefreshing ? 'visible' : 'hidden'
             }}
         >
            <Loader2 
                className={`text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} 
                size={24} 
                style={{ transform: !isRefreshing ? `rotate(${pullY * 3}deg)` : 'none' }} 
            />
         </div>
      </div>

      {/* Main Content */}
      <main 
        id="main-scroll"
        ref={mainScrollRef}
        className="flex-1 h-full overflow-y-auto w-full relative z-10 bg-stone-100 dark:bg-stone-950 scroll-smooth"
        style={{ 
            transform: `translateY(${pullY}px)`, 
            transition: isPulling ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' 
        }}
      >
         <div className="max-w-[1800px] mx-auto px-4 pt-16 md:pt-8 md:px-6 pb-8">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative mb-6 group max-w-3xl mx-auto transform transition-all duration-300 hover:scale-[1.01]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-stone-400 group-focus-within:text-emerald-500 transition-colors duration-300" />
                </div>
                <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search Reddit..."
                    className="block w-full pl-11 pr-4 py-3 border border-stone-200 dark:border-stone-800 rounded-2xl leading-5 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-sm group-focus-within:shadow-md"
                />
            </form>

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 max-w-3xl mx-auto xl:max-w-none">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar mask-gradient-right">
                    {/* Sort Buttons */}
                    {(['hot', 'new', 'top', 'rising'] as SortOption[]).map((option) => (
                        <button
                        key={option}
                        onClick={() => setCurrentSort(option)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 capitalize whitespace-nowrap btn-press ${
                            currentSort === option 
                            ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md transform scale-105' 
                            : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`}
                        >
                        {option}
                        </button>
                    ))}

                    {/* Top Time Select (Conditional) */}
                    {currentSort === 'top' && (
                        <div className="relative shrink-0 animate-list-enter origin-left">
                        <select 
                            value={currentTopTime} 
                            onChange={(e) => setCurrentTopTime(e.target.value as TopTimeOption)}
                            className="appearance-none bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-4 pr-9 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                            <option value="hour">Now</option>
                            <option value="day">Today</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                            <option value="year">Year</option>
                            <option value="all">All Time</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-1 shrink-0 shadow-sm">
                        <button 
                            onClick={() => setViewMode('card')}
                            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'card' ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
                            title="Card View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('compact')}
                            className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'compact' ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}
                            title="Compact View"
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <button 
                        onClick={() => loadPosts(false)} 
                        className={`p-2 rounded-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all duration-200 shrink-0 shadow-sm btn-press ${loading ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCw size={18} className="text-stone-500 dark:text-stone-400" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {loading && posts.length === 0 ? (
                <div className={viewMode === 'card' ? "columns-1 md:columns-2 xl:columns-3 gap-6" : "flex flex-col gap-3 max-w-4xl mx-auto"}>
                    {/* Memoized skeletons array */}
                    {[1,2,3,4,5,6].map(i => <PostSkeleton key={i} viewMode={viewMode} />)}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-list-enter">
                    <CloudOff size={48} className="text-stone-300 mb-4" />
                    <h3 className="text-xl font-medium text-stone-600 dark:text-stone-400">Connection Error</h3>
                    <p className="text-stone-500 dark:text-stone-500 mt-2 mb-6 max-w-sm">{error}</p>
                    <button onClick={() => loadPosts(false)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 btn-press">Try Again</button>
                </div>
            ) : (
                <>
                    {posts.length === 0 && !loading && !analyzing ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-list-enter">
                            <TriangleAlert size={48} className="text-stone-300 mb-4" />
                            <h3 className="text-xl font-medium text-stone-600 dark:text-stone-400">No Posts Found</h3>
                            <p className="text-stone-500 dark:text-stone-500 mt-2 max-w-sm">
                                Try adjusting your filters or checking a different subreddit. 
                                If you have "Strict" filtering on, try relaxing it in settings.
                            </p>
                        </div>
                    ) : (
                        <div className={viewMode === 'card' ? "columns-1 md:columns-2 xl:columns-3 gap-6" : "flex flex-col gap-3 max-w-4xl mx-auto pb-4"}>
                            {posts.map((post, index) => (
                                <LazyRender 
                                    key={post.id} 
                                    className="break-inside-avoid mb-6" 
                                    minHeight={viewMode === 'compact' ? 100 : 300}
                                    rootMargin="800px"
                                >
                                    <div className="animate-list-enter" style={{ animationDelay: `${Math.min(index % 10, 5) * 50}ms` }}>
                                        <PostCard 
                                            post={post} 
                                            isSeen={!!seenPosts[post.id]}
                                            onClick={handlePostClick}
                                            onNavigateSub={handlePostNavigateSub}
                                            onImageClick={handleGalleryClick}
                                            viewMode={viewMode}
                                        />
                                    </div>
                                </LazyRender>
                            ))}
                        </div>
                    )}
                    
                    {/* Loader / Scanner at bottom */}
                    <div ref={observerTarget} className="py-8 flex flex-col items-center justify-center min-h-[100px] w-full">
                        {(loading || analyzing) && (
                            analyzing ? <ScanningVisualizer mode="compact" /> : <Loader2 className="animate-spin text-stone-400" size={32} />
                        )}
                    </div>
                </>
            )}
         </div>
      </main>

      {/* Floating Action Button for Mobile Subreddit Switching */}
      <QuickSubSwitcher 
        followedSubs={followedSubs}
        onNavigate={handleNavigate}
        currentFeed={currentFeed}
        currentSub={currentSub}
      />

      {/* Modals */}
      {selectedPost && (
          <PostDetail 
            post={selectedPost} 
            onClose={handlePostClose} 
            onNavigateSub={handlePostNavigateSub}
            textSize={textSize}
            aiConfig={aiConfig}
            onCommentsBlocked={handleCommentsBlocked}
          />
      )}

      {viewingGallery && (
          <ImageViewer 
            items={viewingGallery.items}
            initialIndex={viewingGallery.index}
            onClose={handleGalleryClose} 
          />
      )}

      <SettingsModal 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={aiConfig}
        onSave={handleSaveSettings}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        textSize={textSize}
        onTextSizeChange={setTextSize}
      />

    </div>
  );
};

export default App;