import React from 'react';
import { Home, Search, Settings, ArrowUp } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'home' | 'explore' | 'settings';
  onTabChange: (tab: 'home' | 'explore' | 'settings') => void;
  onScrollTop: () => void;
  isScrolled: boolean;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ 
  activeTab, 
  onTabChange,
  onScrollTop,
  isScrolled
}) => {
  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleTabClick = (tab: 'home' | 'explore' | 'settings') => {
    triggerHaptic();
    if (activeTab === tab && tab === 'home') {
        onScrollTop();
    } else {
        onTabChange(tab);
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Gradient fade to ensure content doesn't look cut off */}
      <div className="absolute bottom-full left-0 right-0 h-6 bg-gradient-to-t from-stone-100/80 dark:from-stone-950/80 to-transparent pointer-events-none" />
      
      <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border-t border-stone-200 dark:border-stone-800 h-16">
        <div className="flex items-center justify-around h-full">
          <button 
            onClick={() => handleTabClick('home')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${activeTab === 'home' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}
          >
            {activeTab === 'home' && isScrolled ? (
                <ArrowUp size={24} className="animate-bounce" />
            ) : (
                <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            )}
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button 
            onClick={() => handleTabClick('explore')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${activeTab === 'explore' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}
          >
            <Search size={24} strokeWidth={activeTab === 'explore' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Explore</span>
          </button>

          <button 
            onClick={() => handleTabClick('settings')}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform ${activeTab === 'settings' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500'}`}
          >
            <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileBottomNav;