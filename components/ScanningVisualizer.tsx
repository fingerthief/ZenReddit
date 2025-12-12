import React, { useState, useEffect } from 'react';
import { Sparkles, Shield, Brain, Zap, ScanLine } from 'lucide-react';

interface ScanningVisualizerProps {
  mode?: 'full' | 'compact';
}

const ScanningVisualizer: React.FC<ScanningVisualizerProps> = ({ mode = 'full' }) => {
  const [textIndex, setTextIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const scanTexts = [
    "Analyzing content sentiment...",
    "Filtering out rage bait...",
    "Detecting high stress topics...",
    "Measuring zen levels...",
    "Curating peaceful vibes..."
  ];

  useEffect(() => {
    const textInterval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % scanTexts.length);
    }, 1200);

    // Simulate a progress bar that fills up repeatedly to indicate ongoing work
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 0;
        // Accelerate slightly as it goes
        return prev + 2; 
      });
    }, 50);

    return () => {
        clearInterval(textInterval);
        clearInterval(progressInterval);
    };
  }, []);

  if (mode === 'compact') {
      return (
        <div className="w-full max-w-sm mx-auto flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mb-2 text-xs font-medium uppercase tracking-wide">
                <Brain size={14} className="text-emerald-500 animate-pulse" />
                <span className="animate-pulse">{scanTexts[textIndex]}</span>
            </div>
            <div className="w-full h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in duration-500 w-full">
      <div className="relative">
        {/* Pulsing rings */}
        <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping duration-[3000ms]"></div>
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping delay-75 duration-[2000ms]"></div>
        
        {/* Central Icon */}
        <div className="relative bg-white dark:bg-stone-800 p-6 rounded-full shadow-2xl border border-stone-100 dark:border-stone-700 z-10 group">
           <Brain className="text-emerald-500 group-hover:scale-110 transition-transform duration-500" size={48} strokeWidth={1.5} />
           <div className="absolute -top-1 -right-1 bg-white dark:bg-stone-800 rounded-full p-2 shadow-sm border border-stone-100 dark:border-stone-700 animate-bounce">
             <Sparkles size={16} className="text-amber-400" />
           </div>
           
           {/* Scan line effect */}
           <div className="absolute inset-0 overflow-hidden rounded-full opacity-30 pointer-events-none">
                <div className="w-full h-1/2 bg-gradient-to-b from-transparent to-emerald-500/20 absolute top-0 animate-[scan_2s_linear_infinite]"></div>
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
        <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative shadow-inner">
            <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-zen-accent rounded-full transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
            ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-8 text-stone-300 dark:text-stone-600">
         <div className="flex flex-col items-center gap-2 transition-colors duration-500 hover:text-emerald-400">
            <Shield size={16} />
            <span className="text-[10px] uppercase tracking-wider">Safety</span>
         </div>
         <div className="flex flex-col items-center gap-2 transition-colors duration-500 hover:text-emerald-400">
            <Zap size={16} />
            <span className="text-[10px] uppercase tracking-wider">Speed</span>
         </div>
         <div className="flex flex-col items-center gap-2 transition-colors duration-500 hover:text-emerald-400">
            <Sparkles size={16} />
            <span className="text-[10px] uppercase tracking-wider">Vibe</span>
         </div>
      </div>

        <style>{`
            @keyframes scan {
                0% { transform: translateY(-100%); }
                100% { transform: translateY(200%); }
            }
        `}</style>
    </div>
  );
};

export default ScanningVisualizer;