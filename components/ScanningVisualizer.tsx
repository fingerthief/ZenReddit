import React, { useState, useEffect } from 'react';
import { Sparkles, Shield, Brain, Zap } from 'lucide-react';

const ScanningVisualizer: React.FC = () => {
  const [textIndex, setTextIndex] = useState(0);
  
  const scanTexts = [
    "Analyzing content sentiment...",
    "Filtering out rage bait...",
    "Detecting high stress topics...",
    "Measuring zen levels...",
    "Curating peaceful vibes..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % scanTexts.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in duration-500 w-full">
      <div className="relative">
        {/* Pulsing rings */}
        <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping duration-[3000ms]"></div>
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping delay-75"></div>
        
        {/* Central Icon */}
        <div className="relative bg-white dark:bg-stone-800 p-6 rounded-full shadow-xl border border-stone-100 dark:border-stone-700 z-10">
           <Brain className="text-emerald-500 animate-pulse" size={40} />
           <div className="absolute -top-1 -right-1 bg-white dark:bg-stone-800 rounded-full p-1.5 shadow-sm border border-stone-100 dark:border-stone-700">
             <Sparkles size={14} className="text-amber-400" />
           </div>
        </div>
      </div>
      
      <div className="flex flex-col items-center space-y-4 max-w-xs w-full">
        <div className="h-6 overflow-hidden relative w-full text-center">
             <p className="text-sm font-medium text-stone-600 dark:text-stone-300 transition-all duration-300 key={textIndex} animate-in slide-in-from-bottom-2 fade-in">
                {scanTexts[textIndex]}
             </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-emerald-500/60 rounded-full w-1/3 animate-progress-indeterminate"></div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-8 text-stone-300 dark:text-stone-600">
         <div className="flex flex-col items-center gap-2">
            <Shield size={16} />
            <span className="text-[10px] uppercase tracking-wider">Safety</span>
         </div>
         <div className="flex flex-col items-center gap-2">
            <Zap size={16} />
            <span className="text-[10px] uppercase tracking-wider">Speed</span>
         </div>
         <div className="flex flex-col items-center gap-2">
            <Sparkles size={16} />
            <span className="text-[10px] uppercase tracking-wider">Vibe</span>
         </div>
      </div>
    </div>
  );
};

export default ScanningVisualizer;