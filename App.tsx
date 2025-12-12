import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import PostCard from './components/PostCard';
import PostDetail from './components/PostDetail';
import { FeedType, FilteredPost, RedditPostData } from './types';
import { fetchFeed } from './services/redditService';
import { analyzePostsForZen } from './services/geminiService';
import { Loader2, RefreshCw, Menu, Moon, Sun, X } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [currentFeed, setCurrentFeed] = useState<FeedType>('home');
  const [currentSub, setCurrentSub] = useState<string | undefined>(undefined);
  const [posts, setPosts] = useState<FilteredPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FilteredPost | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [followedSubs, setFollowedSubs] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [blockedCount, setBlockedCount] = useState(0);
  
  // Infinite Scroll Ref
  const observerTarget = useRef<HTMLDivElement>(null);

  // Theme Init
  useEffect(() => {
    const savedTheme = localStorage.getItem('zen_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Blocked Count Init
  useEffect(() => {
    const savedCount = localStorage.getItem('zen_blocked_count');
    if (savedCount) {
        setBlockedCount(parseInt(savedCount, 10));
    }
  }, []);

  // Persist blocked count
  useEffect(() => {
    localStorage.setItem('zen_blocked_count', blockedCount.toString());
  }, [blockedCount]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('zen_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Load followed subs from local storage
  useEffect(() => {
    const saved = localStorage.getItem('zen_followed_subs');
    if (saved) {
      setFollowedSubs(JSON.parse(saved));
    } else {
        // Default follows for new users so Home isn't empty/boring
        const defaults = ['CozyPlaces', 'MadeMeSmile', 'wholesomememes', 'nature'];
        setFollowedSubs(defaults);
        localStorage.setItem('zen_followed_subs', JSON.stringify(defaults));
    }
  }, []);

  const saveFollows = (subs: string[]) => {
      setFollowedSubs(subs);
      localStorage.setItem('zen_followed_subs', JSON.stringify(subs));
  };

  const handleFollow = (sub: string) => {
      if (!followedSubs.includes(sub)) {
          saveFollows([...followedSubs, sub]);
      }
  };

  const handleUnfollow = (sub: string) => {
      saveFollows(followedSubs.filter(s => s !== sub));
  };

  // Main Data Fetching Logic
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

      // Analyze with Gemini
      if (!isLoadMore) setLoading(false); // Stop main loader if initial load
      setAnalyzing(true);

      const analysisResults = await analyzePostsForZen(rawPosts);
      
      // Update Blocked Count
      const blockedInThisBatch = analysisResults.filter(r => r.isRageBait).length;
      if (blockedInThisBatch > 0) {
          setBlockedCount(prev => prev + blockedInThisBatch);
      }

      // Merge results
      const processedPosts: FilteredPost[] = rawPosts.map(post => {
        const analysis = analysisResults.find(a => a.id === post.id);
        return {
          ...post,
          isRageBait: analysis ? analysis.isRageBait : false,
          zenScore: analysis ? analysis.zenScore : 50,
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
  }, [currentFeed, currentSub, after, followedSubs, loading, analyzing]);

  // Initial load when feed changes
  useEffect(() => {
    // Reset state when navigation changes
    setPosts([]);
    setAfter(null);
    loadPosts(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFeed, currentSub]); 
  
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
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 max-w-4xl mx-auto w-full">
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
            {loading && posts.length === 0 && (
                <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800"></div>
                    ))}
                </div>
            )}

            {!loading && posts.length === 0 && !analyzing && (
                <div className="text-center py-20 text-stone-400 dark:text-stone-500">
                    <p>No zen content found right now.</p>
                    {currentFeed === 'home' && <p className="text-sm mt-2">Try following more subreddits.</p>}
                </div>
            )}

            {posts.map(post => (
                <PostCard 
                    key={post.id} 
                    post={post} 
                    onClick={setSelectedPost} 
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
            onClose={() => setSelectedPost(null)} 
        />
      )}

    </div>
  );
};

export default App;