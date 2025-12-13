
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import ImageViewer from './components/ImageViewer';
import SettingsModal from './components/SettingsModal';
import ScanningVisualizer from './components/ScanningVisualizer';
import QuickSubSwitcher from './components/QuickSubSwitcher';
import { FeedType, FilteredPost, RedditPostData, AIConfig, SortOption, TopTimeOption, CachedAnalysis, GalleryItem } from './types';
import { fetchFeed } from './services/redditService';
import { analyzePostsForZen, AnalysisResult } from './services/aiService';
import { Loader2, RefreshCw, Menu, CloudOff, TriangleAlert, Search, ChevronDown } from 'lucide-react';

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

const PostSkeleton = () => (
  <div className="bg-white dark:bg-stone-900 p-3 md:p-4 rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 mb-4 animate-pulse">
    <div className="flex">
      <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-200 dark:bg-stone-800 rounded-md mr-3 md:mr-4 shrink-0"></div>
      <div className="flex-1 min-w-0 py-1 space-y-3">
        <div className="flex items-center space-x-2">
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-24"></div>
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-4"></div>
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-16"></div>
        </div>
        <div className="space-y-2">
             <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4"></div>
             <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-1/2"></div>
        </div>
        <div className="flex gap-4 pt-1">
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-12"></div>
            <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-12"></div>
        </div>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // Navigation State
  const [currentFeed, setCurrentFeed] = useState<FeedType>(() => {
    const saved = loadFromStorage('zen_last_feed', 'popular');
    // @ts-ignore
    if (saved === 'home') return 'popular';
    return saved;
  });
  const [currentSub, setCurrentSub] = useState<string | undefined>(() => loadFromStorage('zen_last_sub', undefined));
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>(() => loadFromStorage('zen_last_search', ''));
  const [navHistory, setNavHistory] = useState<{feed: FeedType, sub?: string, query?: string}[]>([]);
  
  // Local UI state for search input
  const [searchInput, setSearchInput] = useState('');

  // Sorting State
  const [currentSort, setCurrentSort] = useState<SortOption>(() => loadFromStorage<SortOption>('zen_sort', 'hot'));
  const [currentTopTime, setCurrentTopTime] = useState<TopTimeOption>(() => loadFromStorage<TopTimeOption>('zen_top_time', 'day'));

  // Page Size State
  const [pageSize, setPageSize] = useState<number>(() => loadFromStorage<number>('zen_page_size', 25));

  // Text Size State
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>(() => loadFromStorage<'small' | 'medium' | 'large'>('zen_text_size', 'medium'));

  // Data State
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPost, setSelectedPost] = useState<FilteredPost | null>(null);
  const [viewingGallery, setViewingGallery] = useState<{ items: GalleryItem[], index: number } | null>(null);
  
  const [after, setAfter] = useState<string | null>(null);
  
  // Cache State
  const [analysisCache, setAnalysisCache] = useState<Record<string, CachedAnalysis>>(() => loadFromStorage<Record<string, CachedAnalysis>>('zen_analysis_cache', {}));
  
  // User Preferences State
  const [followedSubs, setFollowedSubs] = useState<string[]>(() => {
    return loadFromStorage<string[]>('zen_followed_subs', []);
  });

  const [blockedCount, setBlockedCount] = useState(() => loadFromStorage<number>('zen_blocked_count', 0));
  
  // Seen Posts State
  const [seenPosts, setSeenPosts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('zen_seen_posts');
      if (!saved) return {};
      
      const parsed = JSON.parse(saved);
      const now = Date.now();
      const cleaned: Record<string, number> = {};
      let hasChanges = false;
      
      Object.entries(parsed).forEach(([id, timestamp]) => {
         if (typeof timestamp === 'number' && (now - timestamp) < SEEN_EXPIRY_MS) {
             cleaned[id] = timestamp;
         } else {
             hasChanges = true;
         }
      });
      
      if (hasChanges) {
          localStorage.setItem('zen_seen_posts', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch (e) {
      console.warn("Failed to parse seen posts", e);
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
    ...loadFromStorage('zen_ai_config', {})
  }));
  
  // UI State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{x: number, y: number} | null>(null);

  // --- Effects for Persistence ---
  useEffect(() => {
    localStorage.setItem('zen_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('zen_last_feed', JSON.stringify(currentFeed));
    if (currentSub) localStorage.setItem('zen_last_sub', JSON.stringify(currentSub));
    else localStorage.removeItem('zen_last_sub');
    if (currentSearchQuery) localStorage.setItem('zen_last_search', JSON.stringify(currentSearchQuery));
  }, [currentFeed, currentSub, currentSearchQuery]);

  useEffect(() => localStorage.setItem('zen_sort', JSON.stringify(currentSort)), [currentSort]);
  useEffect(() => localStorage.setItem('zen_top_time', JSON.stringify(currentTopTime)), [currentTopTime]);
  useEffect(() => localStorage.setItem('zen_page_size', JSON.stringify(pageSize)), [pageSize]);
  useEffect(() => localStorage.setItem('zen_text_size', JSON.stringify(textSize)), [textSize]);
  useEffect(() => localStorage.setItem('zen_followed_subs', JSON.stringify(followedSubs)), [followedSubs]);
  useEffect(() => localStorage.setItem('zen_blocked_count', blockedCount.toString()), [blockedCount]);
  useEffect(() => {
    try {
      localStorage.setItem('zen_seen_posts', JSON.stringify(seenPosts));
    } catch (e) {}
  }, [seenPosts]);
  useEffect(() => localStorage.setItem('zen_ai_config', JSON.stringify(aiConfig)), [aiConfig]);

  useEffect(() => {
    try {
        const now = Date.now();
        const expiry = 7 * 24 * 60 * 60 * 1000;
        const cleaned: Record<string, CachedAnalysis> = {};
        Object.entries(analysisCache).forEach(([key, val]) => {
            const cachedVal = val as CachedAnalysis;
            if (now - cachedVal.timestamp < expiry) {
                cleaned[key] = cachedVal;
            }
        });
        localStorage.setItem('zen_analysis_cache', JSON.stringify(cleaned));
    } catch (e) {
        console.warn("Failed to save analysis cache", e);
    }
  }, [analysisCache]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (viewingGallery) setViewingGallery(null);
      else if (selectedPost) setSelectedPost(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPost, viewingGallery]);

  // Sync search input with currentSearchQuery when it changes externally
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

  const handlePostClick = (post: FilteredPost) => {
      try { window.history.pushState({ postOpen: true }, '', null); } catch (e) {}
      setSelectedPost(post);
      setSeenPosts(prev => ({ ...prev, [post.id]: Date.now() }));
  };

  const handleGalleryClick = (items: GalleryItem[], index: number) => {
      try { window.history.pushState({ imageOpen: true }, '', null); } catch (e) {}
      setViewingGallery({ items, index });
  };

  const handlePostClose = () => {
      if (window.history.state?.postOpen) try { window.history.back(); } catch(e) { setSelectedPost(null); }
      else setSelectedPost(null);
  };

  const handleGalleryClose = () => {
      if (window.history.state?.imageOpen) try { window.history.back(); } catch(e) { setViewingGallery(null); }
      else setViewingGallery(null);
  };

  const handleNavigate = (type: FeedType, sub?: string, query?: string) => {
    if (type === currentFeed && sub === currentSub && query === currentSearchQuery) {
        setMobileMenuOpen(false);
        return;
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
    if (selectedPost) handlePostClose();
    setViewingGallery(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
        handleNavigate('search', undefined, searchInput.trim());
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const startX = touchStartRef.current.x;
      const startY = touchStartRef.current.y;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      touchStartRef.current = null;

      if (startX < 40 && !viewingGallery) {
          const dx = endX - startX;
          const dy = Math.abs(endY - startY);
          if (dx > 80 && dy < 60 && navHistory.length > 0) {
              const prev = navHistory[navHistory.length - 1];
              setNavHistory(prevH => prevH.slice(0, -1));
              handleNavigate(prev.feed, prev.sub, prev.query);
          }
      }
  };

  const handlePostNavigateSub = (sub: string) => handleNavigate('subreddit', sub);

  // --- Main Data Fetching Logic ---
  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (loading || analyzing) return;
    
    if (!isLoadMore) {
        setPosts([]); 
        setLoading(true);
        setError(null);
    } else {
        setAnalyzing(true);
    }

    try {
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

      setAfter(newAfter);
      const rawPosts = rawPostsData.map(p => p.data);

      if (rawPosts.length === 0) {
          if (!isLoadMore) setLoading(false);
          setAnalyzing(false);
          return;
      }

      // --- Caching & Analysis Logic ---
      const postsToAnalyze: RedditPostData[] = [];
      const newCache = { ...analysisCache };
      let newAnalysisResults: AnalysisResult[] = [];

      // Check cache for each post
      const postsWithCache = rawPosts.map(p => {
          if (newCache[p.id]) {
              return { ...p, ...newCache[p.id] };
          } else {
              postsToAnalyze.push(p);
              return p; 
          }
      });

      // Analyze new posts
      if (postsToAnalyze.length > 0) {
          try {
             newAnalysisResults = await analyzePostsForZen(postsToAnalyze, aiConfig);
             
             // Update Cache
             newAnalysisResults.forEach(res => {
                 newCache[res.id] = { ...res, timestamp: Date.now() };
             });
             setAnalysisCache(newCache);
          } catch (e) {
              console.warn("Analysis error", e);
          }
      }

      // Merge analysis results
      const finalPosts = postsWithCache.map((p: any) => {
           const fresh = newAnalysisResults.find(r => r.id === p.id);
           if (fresh) return { ...p, ...fresh };
           if (newCache[p.id]) return { ...p, ...newCache[p.id] };
           return p;
      });

      // Filter Logic
      const threshold = aiConfig.minZenScore ?? 50;
      const filtered = finalPosts.filter((p: any) => (p.zenScore ?? 50) >= threshold);
      
      const blocked = finalPosts.length - filtered.length;
      if (blocked > 0) setBlockedCount(prev => prev + blocked);

      setPosts(prev => isLoadMore ? [...prev, ...filtered] : filtered);

    } catch (err: any) {
        setError(err.message || "Failed to load feed");
    } finally {
        setLoading(false);
        setAnalyzing(false);
    }
  }, [loading, analyzing, currentFeed, currentSub, after, followedSubs, currentSearchQuery, currentSort, currentTopTime, pageSize, analysisCache, aiConfig]);

  // Initial Load & Triggers
  useEffect(() => {
      loadPosts(false);
  }, [currentFeed, currentSub, currentSearchQuery, currentSort, currentTopTime, pageSize, aiConfig.provider, aiConfig.openRouterModel, aiConfig.customInstructions, followedSubs]); 

  // Infinite Scroll
  useEffect(() => {
      if (!observerTarget.current || loading || analyzing || !after) return;
      
      const observer = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) {
              loadPosts(true);
          }
      }, { threshold: 0.1 });
      
      observer.observe(observerTarget.current);
      return () => observer.disconnect();
  }, [observerTarget, loading, analyzing, after, loadPosts]);


  return (
    <div className="flex bg-stone-100 dark:bg-stone-950 min-h-screen text-stone-900 dark:text-stone-100 transition-colors font-sans" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 z-40 flex items-center justify-between px-4">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-stone-600 dark:text-stone-300">
           <Menu size={24} />
        </button>
        <span className="font-semibold text-lg">ZenReddit</span>
        <div className="w-8"></div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
              <div className="absolute top-0 left-0 bottom-0 w-64 bg-white dark:bg-stone-900 shadow-xl animate-in slide-in-from-left duration-200">
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
                    onOpenSettings={() => { setSettingsOpen(true); setMobileMenuOpen(false); }}
                  />
              </div>
          </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
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
            onOpenSettings={() => setSettingsOpen(true)}
          />
      </div>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-16 md:pt-8 md:px-8 pb-8 min-h-screen">
         
         {/* Search Bar */}
         <form onSubmit={handleSearchSubmit} className="relative mb-4 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Reddit..."
                className="block w-full pl-10 pr-3 py-2.5 border border-stone-200 dark:border-stone-800 rounded-xl leading-5 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-sm"
            />
         </form>

         {/* Toolbar */}
         <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                 {/* Sort Buttons */}
                 {(['hot', 'new', 'top', 'rising'] as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => setCurrentSort(option)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize whitespace-nowrap ${
                        currentSort === option 
                          ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 shadow-md' 
                          : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      {option}
                    </button>
                 ))}

                 {/* Top Time Select (Conditional) */}
                 {currentSort === 'top' && (
                    <div className="relative shrink-0 animate-in fade-in slide-in-from-left-2 duration-200">
                       <select 
                          value={currentTopTime} 
                          onChange={(e) => setCurrentTopTime(e.target.value as TopTimeOption)}
                          className="appearance-none bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full pl-4 pr-8 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
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

             <button 
                onClick={() => loadPosts(false)} 
                className={`p-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors shrink-0 ml-2 ${loading ? 'animate-spin' : ''}`}
                title="Refresh"
             >
                 <RefreshCw size={20} className="text-stone-500" />
             </button>
         </div>

         {/* Content Area */}
         {loading && posts.length === 0 ? (
             <div className="space-y-4">
                 {[1,2,3].map(i => <PostSkeleton key={i} />)}
                 <ScanningVisualizer mode="compact" />
             </div>
         ) : error ? (
             <div className="flex flex-col items-center justify-center py-20 text-center">
                 <CloudOff size={48} className="text-stone-300 mb-4" />
                 <h3 className="text-xl font-medium text-stone-600 dark:text-stone-400">Connection Error</h3>
                 <p className="text-stone-500 dark:text-stone-500 mt-2 mb-6 max-w-sm">{error}</p>
                 <button onClick={() => loadPosts(false)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Try Again</button>
             </div>
         ) : (
             <>
                {posts.length === 0 && !loading && !analyzing ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <TriangleAlert size={48} className="text-stone-300 mb-4" />
                        <h3 className="text-xl font-medium text-stone-600 dark:text-stone-400">No Posts Found</h3>
                        <p className="text-stone-500 dark:text-stone-500 mt-2 max-w-sm">
                            Try adjusting your filters or checking a different subreddit. 
                            If you have "Strict" filtering on, try relaxing it in settings.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {posts.map(post => (
                            <PostCard 
                                key={post.id} 
                                post={post} 
                                isSeen={!!seenPosts[post.id]}
                                onClick={handlePostClick}
                                onNavigateSub={handlePostNavigateSub}
                                onImageClick={handleGalleryClick}
                            />
                        ))}
                    </div>
                )}
                
                {/* Loader / Scanner at bottom */}
                <div ref={observerTarget} className="py-8 flex flex-col items-center justify-center min-h-[100px]">
                    {(loading || analyzing) && (
                         analyzing ? <ScanningVisualizer mode="compact" /> : <Loader2 className="animate-spin text-stone-400" size={32} />
                    )}
                </div>
             </>
         )}
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
