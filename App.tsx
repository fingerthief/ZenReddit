import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import SettingsModal from './components/SettingsModal';
import ScanningVisualizer from './components/ScanningVisualizer';
import { FeedType, FilteredPost, RedditPostData, AIConfig } from './types';
import { fetchFeed } from './services/redditService';
import { analyzePostsForZen } from './services/geminiService';
import { Loader2, RefreshCw, Menu, Moon, Sun, X, Settings, TriangleAlert, CloudOff, Search, Heart, Check } from 'lucide-react';

// Helper to safely load from local storage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.warn(`Failed to load ${key} from storage`, e);
    return defaultValue;
  }
};

const SEEN_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours

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
  // --- State Initialization (Lazy loading from LocalStorage) ---
  
  // Navigation State
  // Default to 'popular' as the main feed
  const [currentFeed, setCurrentFeed] = useState<FeedType>(() => {
    const saved = loadFromStorage('zen_last_feed', 'popular');
    // Migration: If user had 'home' stored, switch to 'popular'
    // @ts-ignore
    if (saved === 'home') return 'popular';
    return saved;
  });
  const [currentSub, setCurrentSub] = useState<string | undefined>(() => loadFromStorage('zen_last_sub', undefined));
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>(() => loadFromStorage('zen_last_search', ''));
  
  // Data State
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<FilteredPost | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  
  // UI State - Input
  const [searchInput, setSearchInput] = useState('');

  // User Preferences State
  // Removed default subscriptions logic
  const [followedSubs, setFollowedSubs] = useState<string[]>(() => {
    return loadFromStorage<string[]>('zen_followed_subs', []);
  });

  const [blockedCount, setBlockedCount] = useState(() => loadFromStorage<number>('zen_blocked_count', 0));
  
  // Seen Posts State with auto-cleanup logic
  const [seenPosts, setSeenPosts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('zen_seen_posts');
      if (!saved) return {};
      
      const parsed = JSON.parse(saved);
      const now = Date.now();
      const cleaned: Record<string, number> = {};
      let hasChanges = false;
      
      // Filter out posts older than 72 hours
      Object.entries(parsed).forEach(([id, timestamp]) => {
         if (typeof timestamp === 'number' && (now - timestamp) < SEEN_EXPIRY_MS) {
             cleaned[id] = timestamp;
         } else {
             hasChanges = true;
         }
      });
      
      // Update storage immediately if we cleaned up old entries
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

  // --- Effects for Persistence ---

  // Apply Theme
  useEffect(() => {
    localStorage.setItem('zen_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Persist Navigation
  useEffect(() => {
    localStorage.setItem('zen_last_feed', JSON.stringify(currentFeed));
    if (currentSub) {
        localStorage.setItem('zen_last_sub', JSON.stringify(currentSub));
    } else {
        localStorage.removeItem('zen_last_sub');
    }
    if (currentSearchQuery) {
        localStorage.setItem('zen_last_search', JSON.stringify(currentSearchQuery));
    }
  }, [currentFeed, currentSub, currentSearchQuery]);

  // Persist Followed Subs
  useEffect(() => {
    localStorage.setItem('zen_followed_subs', JSON.stringify(followedSubs));
  }, [followedSubs]);

  // Persist Blocked Count
  useEffect(() => {
    localStorage.setItem('zen_blocked_count', blockedCount.toString());
  }, [blockedCount]);

  // Persist Seen Posts
  useEffect(() => {
    try {
      localStorage.setItem('zen_seen_posts', JSON.stringify(seenPosts));
    } catch (e) {
      console.warn("Local storage full, cannot save seen posts history");
    }
  }, [seenPosts]);

  // Persist AI Config
  useEffect(() => {
    localStorage.setItem('zen_ai_config', JSON.stringify(aiConfig));
  }, [aiConfig]);

  // Handle Browser Back Button for Modal
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If the user presses back and we have a post open, close it.
      // We rely on the fact that opening a post pushed a state.
      // If we are here, we popped that state.
      if (selectedPost) {
        setSelectedPost(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPost]);


  // --- Handlers ---

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleFollow = (sub: string) => {
      if (!followedSubs.includes(sub)) {
          setFollowedSubs(prev => [...prev, sub]);
      }
  };

  const handleUnfollow = (sub: string) => {
      setFollowedSubs(prev => prev.filter(s => s !== sub));
  };

  const handleSaveSettings = (config: AIConfig) => {
      setAiConfig(config);
      // Logic handled by effect now
  };

  const handlePostClick = (post: FilteredPost) => {
      // Push state so back button works on mobile
      try {
        // Use null for URL to avoid security errors in blob/iframe contexts
        window.history.pushState({ postOpen: true }, '', null);
      } catch (e) {
        console.debug("History pushState failed (expected in some preview environments)", e);
      }
      setSelectedPost(post);

      // Mark as seen with current timestamp
      setSeenPosts(prev => ({
          ...prev,
          [post.id]: Date.now()
      }));
  };

  const handlePostClose = () => {
      // If we are closing via UI button, we should go back to pop the history state
      // This prevents the user from having to click back twice later.
      if (window.history.state?.postOpen) {
          try {
            window.history.back();
          } catch(e) {
             // Fallback if history.back fails
             setSelectedPost(null);
          }
      } else {
          setSelectedPost(null);
      }
  };

  const handleNavigate = (type: FeedType, sub?: string) => {
    setCurrentFeed(type);
    setCurrentSub(sub);
    if (type !== 'search') {
        setCurrentSearchQuery(''); // Clear search context if navigating away
    }
    setMobileMenuOpen(false);
    // If a post is open, close it to show the feed
    if (selectedPost) {
        handlePostClose();
    }
  };

  const handleNavigateSub = (sub: string) => {
      handleNavigate('subreddit', sub);
  };

  // --- Search Logic ---
  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
        const query = searchInput.trim();
        
        // Check for direct subreddit navigation "r/name"
        if (query.toLowerCase().startsWith('r/')) {
            const subName = query.substring(2);
            if (subName) {
                handleNavigate('subreddit', subName);
                setSearchInput(''); // Clear input after nav
                return;
            }
        }

        // Perform standard search
        setCurrentSearchQuery(query);
        setCurrentFeed('search');
        setCurrentSub(undefined);
        setMobileMenuOpen(false);
    }
  };

  // --- Main Data Fetching Logic ---
  
  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (loading || analyzing) return;
    
    // For initial load, clear posts if not loading more
    if (!isLoadMore) {
        setPosts([]); 
        setLoading(true);
        setError(null);
    } else {
        setAnalyzing(true); // Show analyzing spinner at bottom
    }

    try {
      const { posts: rawPostsData, after: newAfter } = await fetchFeed(
        currentFeed, 
        currentSub, 
        isLoadMore ? after : null,
        followedSubs,
        currentSearchQuery // Pass search query
      );

      setAfter(newAfter);

      // Extract data part
      const rawPosts = rawPostsData.map(p => p.data);

      if (rawPosts.length === 0) {
          // No posts returned, possibly end of feed
          if (!isLoadMore) setLoading(false);
          setAnalyzing(false);
          return;
      }

      // Analyze with Gemini/AI Service
      if (!isLoadMore) setLoading(false); // Stop main loader if initial load
      setAnalyzing(true);

      const analysisResults = await analyzePostsForZen(rawPosts, aiConfig);
      
      // Update Blocked Count
      const blockedInThisBatch = analysisResults.filter(r => r.isRageBait).length;
      if (blockedInThisBatch > 0) {
          setBlockedCount(prev => prev + blockedInThisBatch);
      }

      // Merge results
      const processedPosts: FilteredPost[] = rawPosts.map(post => {
        const analysis = analysisResults.find(a => a.id === post.id);
        const zenScore = analysis ? analysis.zenScore : 50;
        
        // Double check rage bait logic client side for safety
        const threshold = aiConfig.minZenScore ?? 50;
        const calculatedIsRageBait = zenScore < threshold;

        return {
          ...post,
          isRageBait: calculatedIsRageBait,
          zenScore: zenScore,
          zenReason: analysis ? analysis.reason : 'Pending'
        };
      }).filter(p => !p.isRageBait); // FILTER OUT RAGE BAIT

      setPosts(prev => isLoadMore ? [...prev, ...processedPosts] : processedPosts);
    } catch (e: any) {
      console.error(e);
      // Only set error if we don't have posts to show (initial load)
      if (!isLoadMore) {
        setError(e.message || "Failed to load content. Reddit might be blocking connections.");
      }
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }, [currentFeed, currentSub, after, followedSubs, loading, analyzing, aiConfig, currentSearchQuery]);

  // Initial load when feed changes
  useEffect(() => {
    // Reset state when navigation changes
    setPosts([]);
    setAfter(null);
    loadPosts(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFeed, currentSub, currentSearchQuery]); // Added currentSearchQuery to dependency
  
  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
        entries => {
            if (entries[0].isIntersecting && !loading && !analyzing && posts.length > 0 && !error) {
                loadPosts(true);
            }
        },
        { threshold: 0.1 }
    );
    
    const currentTarget = observerTarget.current;
    if (currentTarget) {
        observer.observe(currentTarget);
    }

    return () => {
        if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [loading, analyzing, posts.length, loadPosts, error]);

  return (
    <div className="flex min-h-screen bg-stone-100 dark:bg-stone-950 font-sans text-stone-900 dark:text-stone-100 transition-colors">
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 z-40 flex items-center justify-between px-4 transition-colors">
        <h1 className="text-xl font-light text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
            ZenReddit
        </h1>
        <div className="flex items-center gap-2">
             <button onClick={() => setSettingsOpen(true)} className="p-2 text-stone-600 dark:text-stone-400">
                <Settings size={20} />
            </button>
            <button onClick={toggleTheme} className="p-2 text-stone-600 dark:text-stone-400">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-stone-600 dark:text-stone-400">
                <Menu />
            </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-stone-900 md:hidden overflow-y-auto">
            <div className="flex justify-end p-4 border-b border-stone-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-10">
                <button onClick={() => setMobileMenuOpen(false)} className="text-stone-800 dark:text-stone-200"><X /></button>
            </div>
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
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 max-w-4xl mx-auto w-full">
        
        {/* Missing API Key Warning */}
        {!aiConfig.openRouterKey && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 fade-in">
                <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
                    <TriangleAlert size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">AI Not Configured</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 mb-3">
                        ZenReddit requires an OpenRouter API key to filter content. Without it, posts won't be analyzed for rage-bait.
                    </p>
                    <button 
                        onClick={() => setSettingsOpen(true)}
                        className="text-sm font-medium bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors"
                    >
                        Add API Key
                    </button>
                </div>
            </div>
        )}

        {/* Global Search Bar */}
        <div className="mb-6 relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400 group-focus-within:text-emerald-500 transition-colors">
                <Search size={20} />
            </div>
            <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchSubmit}
                placeholder="Search Reddit or type 'r/subreddit' to visit..."
                className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl py-3 pl-10 pr-4 text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 shadow-sm transition-all"
            />
            {searchInput && (
                <button 
                    onClick={() => setSearchInput('')} 
                    className="absolute inset-y-0 right-3 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                    <X size={16} />
                </button>
            )}
        </div>

        {/* Header Area */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-3xl font-light text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
                    {currentFeed === 'popular' && "Popular on Reddit"}
                    {currentFeed === 'all' && "All of Reddit"}
                    {currentFeed === 'subreddit' && (
                        <>
                            <span>r/{currentSub}</span>
                            {currentSub && (
                                <button
                                    onClick={() => followedSubs.includes(currentSub) ? handleUnfollow(currentSub) : handleFollow(currentSub)}
                                    className={`text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                                        followedSubs.includes(currentSub)
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                            : "bg-white text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-600"
                                    }`}
                                >
                                    {followedSubs.includes(currentSub) ? (
                                        <>
                                            <Check size={14} />
                                            <span>Joined</span>
                                        </>
                                    ) : (
                                        <>
                                            <Heart size={14} />
                                            <span>Join</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </>
                    )}
                    {currentFeed === 'search' && `Results for "${currentSearchQuery}"`}
                </h2>
                <p className="text-stone-500 dark:text-stone-400 mt-1">
                    {analyzing ? "AI is purifying your stream..." : "Curated for calm."}
                </p>
            </div>
            
            <button 
                onClick={() => loadPosts(false)}
                className="flex items-center justify-center space-x-2 bg-white dark:bg-stone-900 px-4 py-2 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm font-medium text-stone-600 dark:text-stone-300"
            >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                <span>Refresh</span>
            </button>
        </div>

        {/* Feed */}
        <div className="space-y-4">
            {/* Show skeleton loader while fetching initial data from Reddit */}
            {loading && posts.length === 0 && (
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <PostSkeleton key={i} />
                    ))}
                </div>
            )}

            {/* Error State */}
            {error && posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
                    <CloudOff size={40} className="text-red-400 dark:text-red-500" />
                  </div>
                  <h3 className="text-lg font-medium text-stone-800 dark:text-stone-200 mb-2">Connection Issue</h3>
                  <p className="text-stone-500 dark:text-stone-400 max-w-sm mb-6">
                    {error}
                  </p>
                  <button 
                    onClick={() => loadPosts(false)}
                    className="px-6 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-lg hover:bg-stone-700 dark:hover:bg-stone-600 transition-colors font-medium text-sm"
                  >
                    Try Again
                  </button>
              </div>
            )}

            {/* Show visualizer while AI analyzes initial batch */}
            {analyzing && posts.length === 0 && (
                <ScanningVisualizer mode="full" />
            )}

            {!loading && !error && posts.length === 0 && !analyzing && (
                <div className="text-center py-20 text-stone-400 dark:text-stone-500">
                    <p>No zen content found right now.</p>
                    {!aiConfig.openRouterKey && (
                        <p className="text-sm mt-4 text-emerald-600 dark:text-emerald-400 cursor-pointer" onClick={() => setSettingsOpen(true)}>
                            Open Settings to add your OpenRouter Key
                        </p>
                    )}
                </div>
            )}

            {posts.map(post => (
                <PostCard 
                    key={post.id} 
                    post={post} 
                    isSeen={!!seenPosts[post.id]}
                    onClick={handlePostClick} 
                    onNavigateSub={handleNavigateSub}
                />
            ))}

            {/* Infinite Scroll Sentinel */}
            {posts.length > 0 && !error && (
                <div ref={observerTarget} className="flex justify-center py-8 min-h-[100px]">
                     {(analyzing || loading) && (
                        <ScanningVisualizer mode="compact" />
                     )}
                </div>
            )}
        </div>
      </main>

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetail 
            post={selectedPost} 
            onClose={handlePostClose}
            onNavigateSub={handleNavigateSub}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={aiConfig}
        onSave={handleSaveSettings}
      />

    </div>
  );
};

export default App;