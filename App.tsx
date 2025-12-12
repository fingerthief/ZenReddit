import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import SettingsModal from './components/SettingsModal';
import ScanningVisualizer from './components/ScanningVisualizer';
import { FeedType, FilteredPost, RedditPostData, AIConfig } from './types';
import { fetchFeed } from './services/redditService';
import { analyzePostsForZen } from './services/geminiService';
import { Loader2, RefreshCw, Menu, Moon, Sun, X, Settings, TriangleAlert } from 'lucide-react';

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

const App: React.FC = () => {
  // --- State Initialization (Lazy loading from LocalStorage) ---
  
  // Navigation State
  // Default to 'all' (Popular) instead of 'home'
  const [currentFeed, setCurrentFeed] = useState<FeedType>(() => loadFromStorage('zen_last_feed', 'all'));
  const [currentSub, setCurrentSub] = useState<string | undefined>(() => loadFromStorage('zen_last_sub', undefined));
  
  // Data State
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FilteredPost | null>(null);
  const [after, setAfter] = useState<string | null>(null);

  // User Preferences State
  // Removed default subscriptions logic
  const [followedSubs, setFollowedSubs] = useState<string[]>(() => {
    return loadFromStorage<string[]>('zen_followed_subs', []);
  });

  const [blockedCount, setBlockedCount] = useState(() => loadFromStorage<number>('zen_blocked_count', 0));
  
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
  }, [currentFeed, currentSub]);

  // Persist Followed Subs
  useEffect(() => {
    localStorage.setItem('zen_followed_subs', JSON.stringify(followedSubs));
  }, [followedSubs]);

  // Persist Blocked Count
  useEffect(() => {
    localStorage.setItem('zen_blocked_count', blockedCount.toString());
  }, [blockedCount]);

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

  // --- Main Data Fetching Logic ---
  
  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (loading || analyzing) return;
    
    // For initial load, clear posts if not loading more
    if (!isLoadMore) {
        setPosts([]); 
        setLoading(true);
    } else {
        setAnalyzing(true); // Show analyzing spinner at bottom
    }

    try {
      const { posts: rawPostsData, after: newAfter } = await fetchFeed(
        currentFeed, 
        currentSub, 
        isLoadMore ? after : null,
        followedSubs
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }, [currentFeed, currentSub, after, followedSubs, loading, analyzing, aiConfig]);

  // Initial load when feed changes
  useEffect(() => {
    // Reset state when navigation changes
    setPosts([]);
    setAfter(null);
    loadPosts(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFeed, currentSub]); 

  // Reload Home feed if subscriptions change while we are on Home
  useEffect(() => {
    if (currentFeed === 'home') {
        setPosts([]);
        setAfter(null);
        loadPosts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followedSubs]); // Only re-run if followedSubs changes
  
  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
        entries => {
            if (entries[0].isIntersecting && !loading && !analyzing && posts.length > 0) {
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
  }, [loading, analyzing, posts.length, loadPosts]);

  const handleNavigate = (type: FeedType, sub?: string) => {
    setCurrentFeed(type);
    setCurrentSub(sub);
    setMobileMenuOpen(false);
  };

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

        {/* Header Area */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-3xl font-light text-stone-800 dark:text-stone-100 tracking-tight">
                    {currentFeed === 'home' && "Your Zen Feed"}
                    {currentFeed === 'all' && "Popular & Peaceful"}
                    {currentFeed === 'subreddit' && `r/${currentSub}`}
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
                <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"></div>
                    ))}
                </div>
            )}

            {/* Show visualizer while AI analyzes initial batch */}
            {analyzing && posts.length === 0 && (
                <ScanningVisualizer />
            )}

            {!loading && posts.length === 0 && !analyzing && (
                <div className="text-center py-20 text-stone-400 dark:text-stone-500">
                    <p>No zen content found right now.</p>
                    {currentFeed === 'home' && <p className="text-sm mt-2">Try following more subreddits.</p>}
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
                    onClick={handlePostClick} 
                />
            ))}

            {/* Infinite Scroll Sentinel */}
            {posts.length > 0 && (
                <div ref={observerTarget} className="flex justify-center py-8 min-h-[100px]">
                     {(analyzing || loading) && (
                        <div className="flex items-center space-x-2 text-stone-400">
                            <Loader2 className="animate-spin" size={20} />
                            <span>Filtering Rage Bait...</span>
                        </div>
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