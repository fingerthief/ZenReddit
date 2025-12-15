
import React, { useState, useEffect } from 'react';
import { Sparkles, Shield, Brain, Zap } from 'lucide-react';

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
        return prev + 1.5; 
      });
    }, 40);

    return () => {
        clearInterval(textInterval);
        clearInterval(progressInterval);
    };
  }, []);

  if (mode === 'compact') {
      return (
        <div className="w-full max-w-sm mx-auto flex flex-col items-center animate-fade-in">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mb-2 text-xs font-medium uppercase tracking-wide">
                <Brain size={14} className="text-emerald-500 animate-pulse" />
                <span className="animate-pulse">{scanTexts[textIndex]}</span>
            </div>
            <div className="w-full h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-600 rounded-full transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-gradient-x"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in duration-700 w-full relative">
      <div className="relative">
        {/* Pulsing rings */}
        <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping duration-[3000ms]"></div>
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping delay-100 duration-[2000ms]"></div>
        
        {/* Central Icon */}
        <div className="relative bg-white/80 dark:bg-stone-800/80 p-8 rounded-full shadow-2xl border border-white/50 dark:border-stone-700 backdrop-blur-xl z-10 group animate-float">
           <Brain className="text-emerald-500 group-hover:scale-110 transition-transform duration-500 drop-shadow-lg" size={48} strokeWidth={1.5} />
           
           <div className="absolute -top-2 -right-2 bg-white dark:bg-stone-800 rounded-full p-2.5 shadow-lg border border-stone-100 dark:border-stone-700 animate-bounce delay-75">
             <Sparkles size={18} className="text-amber-400" />
           </div>
           
           {/* Scan line effect */}
           <div className="absolute inset-0 overflow-hidden rounded-full opacity-40 pointer-events-none">
                <div className="w-full h-1/2 bg-gradient-to-b from-transparent to-emerald-400/30 absolute top-0 animate-[scan_2.5s_linear_infinite]"></div>
           </div>
        </div>
      </div>
      
      <div className="flex flex-col items-center space-y-5 max-w-xs w-full">
        <div className="h-6 overflow-hidden relative w-full text-center">
             <p className="text-sm font-medium text-stone-600 dark:text-stone-300 transition-all duration-300 key={textIndex} animate-in slide-in-from-bottom-2 fade-in">
                {scanTexts[textIndex]}
             </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative shadow-inner">
            <div 
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 rounded-full transition-all duration-75 ease-linear animate-gradient-x"
                style={{ width: `${progress}%` }}
            ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-10 text-stone-400 dark:text-stone-600">
         <div className="flex flex-col items-center gap-2 transition-colors duration-500 hover:text-emerald-500 group">
            <Shield size={18} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Safety</span>
         </div>
         <div className="flex flex-col items-center gap-2 transition-colors duration-500 hover:text-emerald-500 group">
            <Zap size={18} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Speed</span>
         </div>
         <div className="flex flex-col items-center gap-2 transition-colors duration-500 hover:text-emerald-500 group">
            <Sparkles size={18} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Vibe</span>
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