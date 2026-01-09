import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import ImageViewer from './components/ImageViewer';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import ScanningVisualizer, { LoadingPhase } from './components/ScanningVisualizer';
import QuickSubSwitcher from './components/QuickSubSwitcher';
import LazyRender from './components/LazyRender';
import SubredditHeader from './components/SubredditHeader';
import UserProfile from './components/UserProfile';
import MobileBottomNav from './components/MobileBottomNav';
import { FeedType, FilteredPost, RedditPostData, AIConfig, SortOption, TopTimeOption, CachedAnalysis, GalleryItem, ViewMode } from './types';
import { fetchFeed, fetchPostByPermalink } from './services/redditService';
import { analyzePostsForZen, AnalysisResult } from './services/aiService';
import { Loader2, RefreshCw, CloudOff, TriangleAlert, Search, ChevronDown, LayoutGrid, List, X, Flame } from 'lucide-react';

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return defaultValue;
    try {
      return JSON.parse(saved);
    } catch (e) {
      if (typeof defaultValue === 'string') {
          return saved as unknown as T;
      }
      return defaultValue;
    }
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
  const [searchRestricted, setSearchRestricted] = useState(true);

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
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('idle');
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Mobile Bottom Nav State
  const [mobileActiveTab, setMobileActiveTab] = useState<'home' | 'explore' | 'settings'>('home');

  // Refs
  const observerTarget = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Touch / Gestures state
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    // Check first launch
    const hasVisited = localStorage.getItem('zen_has_visited');
    if (!hasVisited) {
        setShowOnboarding(true);
        localStorage.setItem('zen_has_visited', 'true');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('zen_theme', theme);
  }, [theme]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (event.state) {
            // Restore state from history
            if (event.state.postId) {
                // If we have a postId but no selectedPost, try to find it or fetch it
                if (!selectedPost || selectedPost.id !== event.state.postId) {
                    const found = posts.find(p => p.id === event.state.postId);
                    if (found) setSelectedPost(found);
                    else {
                        // Optionally fetch single post if not in feed
                        // For now we just go back to feed if not found
                        window.history.replaceState(null, '');
                    }
                }
            } else {
                setSelectedPost(null);
            }
        } else {
            setSelectedPost(null);
        }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [posts, selectedPost]);

  // Persist State
  useEffect(() => { localStorage.setItem('zen_last_feed', currentFeed); }, [currentFeed]);
  useEffect(() => { if(currentSub) localStorage.setItem('zen_last_sub', currentSub); }, [currentSub]);
  useEffect(() => { if(currentSearchQuery) localStorage.setItem('zen_last_search', currentSearchQuery); }, [currentSearchQuery]);
  useEffect(() => { localStorage.setItem('zen_sort', currentSort); }, [currentSort]);
  useEffect(() => { localStorage.setItem('zen_top_time', currentTopTime); }, [currentTopTime]);
  useEffect(() => { localStorage.setItem('zen_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('zen_page_size', pageSize.toString()); }, [pageSize]);
  useEffect(() => { localStorage.setItem('zen_text_size', textSize); }, [textSize]);
  useEffect(() => { localStorage.setItem('zen_followed_subs', JSON.stringify(followedSubs)); }, [followedSubs]);
  useEffect(() => { localStorage.setItem('zen_blocked_count', blockedCount.toString()); }, [blockedCount]);
  useEffect(() => { localStorage.setItem('zen_blocked_comment_count', blockedCommentCount.toString()); }, [blockedCommentCount]);
  useEffect(() => { localStorage.setItem('zen_ai_config', JSON.stringify(aiConfig)); }, [aiConfig]);
  
  useEffect(() => {
      // Debounced save for caches to avoid spamming storage
      const timeout = setTimeout(() => {
          try {
            // Prune old seen posts
            const now = Date.now();
            const validSeen: Record<string, number> = {};
            let changed = false;
            Object.entries(seenPosts).forEach(([id, time]) => {
                if ((now - time) < SEEN_EXPIRY_MS) {
                    validSeen[id] = time;
                } else {
                    changed = true;
                }
            });
            localStorage.setItem('zen_seen_posts', JSON.stringify(validSeen));
            if (changed) setSeenPosts(validSeen);
            
            // Prune analysis cache (keep max 500 items)
            const entries = Object.entries(analysisCache);
            if (entries.length > 500) {
                const pruned = Object.fromEntries(entries.slice(entries.length - 500));
                localStorage.setItem('zen_analysis_cache', JSON.stringify(pruned));
            } else {
                localStorage.setItem('zen_analysis_cache', JSON.stringify(analysisCache));
            }
          } catch (e) {
              console.warn("Storage save failed", e);
          }
      }, 2000);
      return () => clearTimeout(timeout);
  }, [seenPosts, analysisCache]);

  const loadFeed = useCallback(async (refresh = false, nextAfter: string | null = null) => {
    if (loadingPhase !== 'idle' && !refresh && !nextAfter) return;
    
    // Abort previous request if refreshing
    if (refresh && abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (refresh) {
          setLoadingPhase('fetching');
          setIsRefreshing(true);
          setPosts([]);
      } else {
          // Pagination loading
      }
      
      setError(null);

      // Step 1: Fetch
      const { posts: rawPosts, after: newAfter } = await fetchFeed(
        currentFeed, 
        currentSub, 
        nextAfter,
        followedSubs,
        currentSearchQuery,
        currentSort,
        currentTopTime,
        pageSize,
        refresh, // skip cache if refreshing
        controller.signal
      );
      
      if (!rawPosts || rawPosts.length === 0) {
          if (refresh) setPosts([]);
          setAfter(null);
          setLoadingPhase('idle');
          setIsRefreshing(false);
          return;
      }

      setAfter(newAfter);
      
      // Step 2: Identify unanalyzed posts
      const unanalyzed = rawPosts.filter(p => !analysisCache[p.data.id]);
      
      // Identify valid cached posts
      const cachedResults: FilteredPost[] = rawPosts
        .filter(p => analysisCache[p.data.id])
        .map(p => ({
            ...p.data,
            ...analysisCache[p.data.id],
            zenScore: analysisCache[p.data.id].zenScore
        }));

      let newAnalyzedResults: AnalysisResult[] = [];

      // Step 3: Analyze only if needed
      if (unanalyzed.length > 0) {
          setLoadingPhase('analyzing');
          const toAnalyze = unanalyzed.map(p => p.data);
          
          newAnalyzedResults = await analyzePostsForZen(toAnalyze, aiConfig);
          
          // Update Cache
          setAnalysisCache(prev => {
              const next = { ...prev };
              newAnalyzedResults.forEach(r => {
                  next[r.id] = {
                      id: r.id,
                      isRageBait: r.isRageBait,
                      zenScore: r.zenScore,
                      reason: r.reason,
                      timestamp: Date.now()
                  };
              });
              return next;
          });
      }

      // Step 4: Filter & Merge
      setLoadingPhase('filtering');
      
      // Combine cached + newly analyzed
      const analyzedMap = new Map<string, AnalysisResult>();
      newAnalyzedResults.forEach(r => analyzedMap.set(r.id, r));
      
      const processedPosts: FilteredPost[] = rawPosts.map(p => {
         const cached = analysisCache[p.data.id];
         const fresh = analyzedMap.get(p.data.id);
         
         const analysis = fresh || cached || { isRageBait: false, zenScore: 50, reason: '', id: p.data.id };
         
         const currentThreshold = aiConfig.minZenScore ?? 50;
         const isRageBait = analysis.zenScore < currentThreshold;

         return {
             ...p.data,
             ...analysis,
             isRageBait: isRageBait,
             zenScore: analysis.zenScore
         };
      });

      // Filter out rage bait based on user strictness preference (minZenScore handles threshold logic in AI, but we double check)
      const visiblePosts = processedPosts.filter(p => !p.isRageBait);
      const blocked = processedPosts.length - visiblePosts.length;
      if (blocked > 0) setBlockedCount(prev => prev + blocked);

      if (refresh) {
          setPosts(visiblePosts);
          // Reset scroll
          if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
      } else {
          setPosts(prev => {
              const ids = new Set(prev.map(p => p.id));
              const uniqueNew = visiblePosts.filter(p => !ids.has(p.id));
              return [...prev, ...uniqueNew];
          });
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
          console.error(err);
          setError(err.message || "Failed to load feed");
      }
    } finally {
      setLoadingPhase('idle');
      setIsRefreshing(false);
      abortControllerRef.current = null;
    }
  }, [currentFeed, currentSub, currentSearchQuery, currentSort, currentTopTime, pageSize, followedSubs, aiConfig, analysisCache]);

  // Initial Load & Dependencies
  useEffect(() => {
    loadFeed(true);
  }, [currentFeed, currentSub, currentSort, currentTopTime, currentSearchQuery, aiConfig.minZenScore]); // Only re-load when feed params change

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && after && loadingPhase === 'idle') {
          loadFeed(false, after);
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [after, loadingPhase, loadFeed]);

  const handleNavigate = (type: FeedType, sub?: string, query?: string) => {
    setNavHistory(prev => [...prev, { feed: currentFeed, sub: currentSub, query: currentSearchQuery }]);
    
    setCurrentFeed(type);
    if (sub) setCurrentSub(sub);
    else setCurrentSub(undefined);
    
    if (query) setCurrentSearchQuery(query);
    else setCurrentSearchQuery('');
    
    // Mobile navigation logic
    if (type === 'search') {
        // handled in search submit
    }
    
    // Update active tab logic for mobile nav
    if (type === 'popular' || type === 'all') setMobileActiveTab('home');
    if (type === 'subreddit') setMobileActiveTab('home');
  };

  const scrollToTop = () => {
    if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePostClick = (post: FilteredPost) => {
      setSelectedPost(post);
      setSeenPosts(prev => ({ ...prev, [post.id]: Date.now() }));
      
      // Update URL/History without reload
      const url = `/r/${post.subreddit}/comments/${post.id}`;
      window.history.pushState({ postId: post.id }, '', url);
  };

  const handleCloseDetail = () => {
      setSelectedPost(null);
      // Go back in history to reset URL, or replace state
      if (window.history.state && window.history.state.postId) {
          window.history.back();
      } else {
          // Fallback if opened directly
          window.history.replaceState(null, '', '/');
      }
  };

  const handleFollow = (sub: string) => {
      if (!followedSubs.includes(sub)) {
          setFollowedSubs(prev => [...prev, sub]);
      }
  };

  const handleUnfollow = (sub: string) => {
      setFollowedSubs(prev => prev.filter(s => s !== sub));
  };
  
  const handleInternalLink = (url: string) => {
      // Parse reddit internal links
      // Format: /r/subreddit/comments/id/... or /r/subreddit
      const subMatch = url.match(/\/r\/([^/]+)/);
      const sub = subMatch ? subMatch[1] : null;
      
      const commentMatch = url.match(/\/comments\/([^/]+)/);
      const postId = commentMatch ? commentMatch[1] : null;
      
      if (postId && sub) {
          // It's a post link. Since we don't have the full post object, we try to fetch it or navigate
          // Ideally we fetch it quickly
          fetchPostByPermalink(url).then(post => {
              if (post) {
                  const filtered: FilteredPost = { ...post, isRageBait: false, zenScore: 50 }; // optimistically neutral
                  setSelectedPost(filtered);
              }
          });
      } else if (sub) {
          handleNavigate('subreddit', sub);
          setSelectedPost(null);
      }
  };

  // Mobile Bottom Nav Handler
  const handleMobileTabChange = (tab: 'home' | 'explore' | 'settings') => {
      setMobileActiveTab(tab);
      if (tab === 'home') {
          if (currentFeed === 'search') handleNavigate('popular');
      } else if (tab === 'explore') {
          setMobileExploreOpen(true);
      } else if (tab === 'settings') {
          setSettingsOpen(true);
      }
  };

  // Pull to refresh logic for mobile (simplified)
  const [pullY, setPullY] = useState(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
      if (mainScrollRef.current && mainScrollRef.current.scrollTop === 0) {
          touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
          touchStartRef.current = null;
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const y = e.touches[0].clientY;
      const diff = y - touchStartRef.current.y;
      if (diff > 0 && diff < 200) { // Limit pull distance
          setPullY(diff);
      }
  };

  const handleTouchEnd = () => {
      if (pullY > 80) { // Threshold
          loadFeed(true);
      }
      setPullY(0);
      touchStartRef.current = null;
  };

  return (
    <div className={`flex h-screen w-full bg-stone-100 dark:bg-black transition-colors duration-300 ${theme}`}>
      {/* Sidebar (Desktop) */}
      <div className="hidden md:flex md:w-64 shrink-0 h-full z-20 relative shadow-xl">
        <Sidebar 
            currentFeed={currentFeed}
            currentSub={currentSub}
            onNavigate={handleNavigate}
            followedSubs={followedSubs}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            theme={theme}
            toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            blockedCount={blockedCount}
            blockedCommentCount={blockedCommentCount}
            onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Main Content Area */}
      <div 
        ref={mainScrollRef}
        className="flex-1 h-full overflow-y-auto overflow-x-hidden relative w-full scroll-smooth no-scrollbar md:custom-scrollbar"
        id="main-scroll-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
          {/* Pull to refresh indicator */}
          <div 
            className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-transform duration-200"
            style={{ transform: `translateY(${pullY > 0 ? pullY / 2 : -50}px)`, opacity: pullY > 0 ? 1 : 0 }}
          >
              <div className="bg-white dark:bg-stone-800 p-2 rounded-full shadow-lg">
                  <RefreshCw size={20} className={`text-emerald-500 ${pullY > 80 ? 'animate-spin' : ''} transition-transform`} style={{ transform: `rotate(${pullY * 2}deg)` }} />
              </div>
          </div>

          <div className="max-w-4xl mx-auto pb-24 md:pb-10 pt-safe pl-safe pr-safe min-h-full">
            
            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-30 bg-white/80 dark:bg-stone-950/80 backdrop-blur-lg border-b border-stone-200 dark:border-stone-800 px-4 py-3 flex items-center justify-between mb-4 transition-all">
                <div 
                    className="flex items-center gap-2"
                    onClick={() => {
                        scrollToTop();
                        if (currentFeed !== 'popular') handleNavigate('popular');
                    }}
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white font-bold text-lg">
                        Z
                    </div>
                    <span className="font-semibold text-stone-800 dark:text-stone-100 tracking-tight">ZenReddit</span>
                </div>
                
                <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                        className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
                     >
                         {theme === 'light' ? <div className="w-5 h-5 bg-stone-800 rounded-full" /> : <div className="w-5 h-5 bg-stone-200 rounded-full" />}
                     </button>
                </div>
            </div>

            {/* Subreddit Header */}
            {currentFeed === 'subreddit' && currentSub && (
                <SubredditHeader 
                    subreddit={currentSub} 
                    isFollowed={followedSubs.includes(currentSub)}
                    onToggleFollow={() => followedSubs.includes(currentSub) ? handleUnfollow(currentSub) : handleFollow(currentSub)}
                />
            )}

            {/* User Profile Header */}
            {currentFeed === 'user' && currentSub && (
                 <UserProfile username={currentSub} />
            )}
            
            {/* Sort Controls & Feed Title */}
            <div className="flex items-center justify-between mb-6 px-4 md:px-0">
                <div className="flex flex-col">
                    {!['subreddit', 'user'].includes(currentFeed) && (
                        <h2 className="text-xl md:text-2xl font-bold text-stone-800 dark:text-stone-100 capitalize flex items-center gap-2">
                            {currentFeed === 'search' ? `Results: "${currentSearchQuery}"` : 
                             `${currentFeed} Posts`}
                        </h2>
                    )}
                    {loadingPhase !== 'idle' && loadingPhase !== 'fetching' && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 animate-pulse font-medium">
                            {loadingPhase === 'analyzing' ? 'AI is scanning for toxicity...' : 'Filtering content...'}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Sort Dropdown */}
                    <div className="relative group z-10">
                        <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                            <span className="capitalize">{currentSort}</span>
                            <ChevronDown size={14} className="text-stone-400" />
                        </button>
                        
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-stone-100 dark:border-stone-800 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-right">
                             {['hot', 'new', 'top', 'rising'].map((sort) => (
                                 <button
                                    key={sort}
                                    onClick={() => setCurrentSort(sort as SortOption)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 capitalize ${currentSort === sort ? 'text-emerald-600 font-bold' : 'text-stone-600 dark:text-stone-300'}`}
                                 >
                                     {sort}
                                 </button>
                             ))}
                        </div>
                    </div>

                    {currentSort === 'top' && (
                        <select 
                            value={currentTopTime} 
                            onChange={(e) => setCurrentTopTime(e.target.value as TopTimeOption)}
                            className="px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-sm font-medium text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                        >
                            <option value="hour">Hour</option>
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                            <option value="year">Year</option>
                            <option value="all">All Time</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
                        <CloudOff className="text-red-500" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-stone-800 dark:text-stone-200 mb-2">Something went wrong</h3>
                    <p className="text-stone-500 dark:text-stone-400 mb-6 max-w-xs">{error}</p>
                    <button 
                        onClick={() => loadFeed(true)}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Loading Visualizer (Initial) */}
            {loadingPhase !== 'idle' && posts.length === 0 && !error && (
                <ScanningVisualizer phase={loadingPhase} />
            )}

            {/* Post Feed */}
            <div className="space-y-4 md:space-y-6 columns-1 md:columns-1 lg:columns-1 gap-6 max-w-3xl mx-auto">
                {posts.map((post) => (
                    <LazyRender key={post.id} minHeight={200} className="break-inside-avoid">
                        <PostCard 
                            post={post} 
                            isSeen={!!seenPosts[post.id]}
                            onClick={handlePostClick}
                            onNavigateSub={(sub) => handleNavigate('subreddit', sub)}
                            onNavigateUser={(user) => handleNavigate('user', user)}
                            onImageClick={(items, idx) => setViewingGallery({ items, index: idx })}
                            viewMode={viewMode}
                        />
                    </LazyRender>
                ))}
            </div>

            {/* Skeletons for pagination loading */}
            {loadingPhase !== 'idle' && posts.length > 0 && (
                <div className="mt-6 max-w-3xl mx-auto space-y-6">
                    <PostSkeleton viewMode={viewMode} />
                    <PostSkeleton viewMode={viewMode} />
                </div>
            )}
            
            {/* Observer Target */}
            {!error && <div ref={observerTarget} className="h-20 w-full" />}
            
            {/* End of Feed */}
            {loadingPhase === 'idle' && posts.length > 0 && !after && (
                 <div className="text-center py-12 text-stone-400 dark:text-stone-600">
                     <p>You've reached the end of zen.</p>
                 </div>
            )}
          </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetail 
          post={selectedPost} 
          onClose={handleCloseDetail}
          onNavigateSub={(sub) => {
             setSelectedPost(null);
             handleNavigate('subreddit', sub);
          }}
          onNavigateUser={(user) => {
             setSelectedPost(null);
             handleNavigate('user', user);
          }}
          textSize={textSize}
          aiConfig={aiConfig}
          onCommentsBlocked={(count) => {
             setBlockedCommentCount(prev => prev + count);
          }}
          onImageClick={(items, idx) => {
             setViewingGallery({ items, index: idx });
          }}
          onInternalLinkClick={handleInternalLink}
        />
      )}

      {/* Image Gallery Viewer */}
      {viewingGallery && (
          <ImageViewer 
            items={viewingGallery.items} 
            initialIndex={viewingGallery.index} 
            onClose={() => setViewingGallery(null)} 
          />
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        config={aiConfig}
        onSave={setAiConfig}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        textSize={textSize}
        onTextSizeChange={setTextSize}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        blockedCount={blockedCount}
        blockedCommentCount={blockedCommentCount}
      />

      {/* Mobile Explore/Search Sheet */}
      <QuickSubSwitcher
        forceOpen={mobileExploreOpen}
        onClose={() => {
            setMobileExploreOpen(false);
            if (mobileActiveTab === 'explore') setMobileActiveTab('home');
        }}
        followedSubs={followedSubs}
        onNavigate={handleNavigate}
        onFollow={handleFollow}
        currentFeed={currentFeed}
        currentSub={currentSub}
      />

      {/* Onboarding */}
      <OnboardingModal 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />

      {/* Mobile Bottom Nav */}
      <MobileBottomNav 
        activeTab={mobileActiveTab} 
        onTabChange={handleMobileTabChange}
        onScrollTop={scrollToTop}
        isScrolled={mainScrollRef.current ? mainScrollRef.current.scrollTop > 200 : false}
      />
    </div>
  );
};

export default App;