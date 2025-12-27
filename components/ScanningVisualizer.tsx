
import React from 'react';
import { Sparkles, Brain, Radio, Filter, Loader2 } from 'lucide-react';

export type LoadingPhase = 'idle' | 'fetching' | 'analyzing' | 'filtering';

interface ScanningVisualizerProps {
  mode?: 'full' | 'compact';
  phase?: LoadingPhase;
}

const ScanningVisualizer: React.FC<ScanningVisualizerProps> = ({ mode = 'full', phase = 'fetching' }) => {
  
  // Configuration for each phase
  const phases = {
    idle: {
      text: "Ready",
      progress: 0,
      icon: Brain,
      step: 0
    },
    fetching: {
      text: "Retrieving posts from the hive mind...",
      progress: 30,
      icon: Radio,
      step: 1
    },
    analyzing: {
      text: "AI is detecting rage-bait & toxicity...",
      progress: 66,
      icon: Brain,
      step: 2
    },
    filtering: {
      text: "Curating your zen space...",
      progress: 100,
      icon: Filter,
      step: 3
    }
  };

  const current = phases[phase] || phases.fetching;
  const Icon = current.icon;

  if (mode === 'compact') {
      return (
        <div className="w-full max-w-sm mx-auto flex flex-col items-center animate-fade-in">
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 mb-2 text-xs font-medium uppercase tracking-wide">
                <Icon size={14} className="text-emerald-500 animate-pulse" />
                <span className="animate-pulse transition-all duration-300">{current.text}</span>
            </div>
            <div className="w-full h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-600 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    style={{ width: `${current.progress}%` }}
                ></div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-700 w-full relative">
      <div className="relative">
        {/* Pulsing rings */}
        <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping duration-[3000ms]"></div>
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping delay-100 duration-[2000ms]"></div>
        
        {/* Central Icon */}
        <div className="relative bg-white/80 dark:bg-stone-800/80 p-8 rounded-full shadow-2xl border border-white/50 dark:border-stone-700 backdrop-blur-xl z-10 group animate-float transition-all duration-500">
           <Icon className="text-emerald-500 transition-all duration-500 drop-shadow-lg" size={48} strokeWidth={1.5} />
           
           <div className="absolute -top-2 -right-2 bg-white dark:bg-stone-800 rounded-full p-2.5 shadow-lg border border-stone-100 dark:border-stone-700 animate-bounce delay-75">
             <Sparkles size={18} className="text-amber-400" />
           </div>
           
           {/* Scan line effect - only active during analyzing */}
           {phase === 'analyzing' && (
               <div className="absolute inset-0 overflow-hidden rounded-full opacity-40 pointer-events-none">
                    <div className="w-full h-1/2 bg-gradient-to-b from-transparent to-emerald-400/30 absolute top-0 animate-[scan_2.5s_linear_infinite]"></div>
               </div>
           )}
        </div>
      </div>
      
      <div className="flex flex-col items-center space-y-6 max-w-sm w-full">
        {/* Step Indicators */}
        <div className="flex items-center gap-2 w-full justify-center">
            {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                    <div className={`h-1.5 rounded-full transition-all duration-500 ${current.step >= step ? 'w-8 bg-emerald-500' : 'w-2 bg-stone-200 dark:bg-stone-800'}`} />
                    {step < 3 && <div className="w-1" />} 
                </div>
            ))}
        </div>

        {/* Text */}
        <div className="h-12 flex items-center justify-center text-center">
             <p className="text-sm font-medium text-stone-600 dark:text-stone-300 transition-all duration-300 animate-in slide-in-from-bottom-2 fade-in">
                {current.text}
             </p>
        </div>

        {/* Smooth Progress Bar */}
        <div className="w-full h-1 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative shadow-inner">
            <div 
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${current.progress}%` }}
            ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-12 text-stone-400 dark:text-stone-600 pt-4">
         <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${phase === 'fetching' ? 'text-emerald-500 scale-110' : ''}`}>
            <Radio size={16} />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Fetch</span>
         </div>
         <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${phase === 'analyzing' ? 'text-emerald-500 scale-110' : ''}`}>
            <Brain size={16} />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Scan</span>
         </div>
         <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${phase === 'filtering' ? 'text-emerald-500 scale-110' : ''}`}>
            <Filter size={16} />
            <span className="text-[10px] uppercase tracking-wider font-semibold">Filter</span>
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
