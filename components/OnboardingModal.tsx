
import React from 'react';
import { Sparkles, Shield, Zap, MessageSquare, Scale, CheckCircle } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      
      {/* Modal Content */}
      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl shadow-2xl p-0 animate-scale-in border border-stone-200 dark:border-stone-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center rotate-3 shadow-lg ring-1 ring-emerald-500/20">
                <Sparkles className="text-emerald-600 dark:text-emerald-400" size={32} />
             </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-stone-900 dark:text-stone-100 mb-2">
            Welcome to ZenReddit
          </h2>
          <p className="text-center text-stone-500 dark:text-stone-400 mb-8 max-w-sm mx-auto leading-relaxed">
            A peaceful, intelligent way to browse. Experience Reddit without the noise, powered by the AI model of your choice.
          </p>

          <div className="space-y-6 mb-4">
            {/* Feature 1: Shield */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 mt-1">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Rage-Bait Shield</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  Your configured AI scans content in real-time to detect hostility, clickbait, and divisive politics. Stress-inducing posts are automatically filtered out before you see them.
                </p>
              </div>
            </div>

            {/* Feature 2: Zen Score */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 mt-1">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Zen Score System</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  Every post gets a score (0-100) based on positivity and constructive value. You can adjust your personal "Zen Threshold" in settings to control how strict the filter is.
                </p>
              </div>
            </div>

            {/* Feature 3: Context Aware */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 mt-1">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Smart Discussion Filter</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  The AI doesn't just read keywords—it understands context. It analyzes comment threads to identify toxic behavior while preserving healthy, constructive debates.
                </p>
              </div>
            </div>

            {/* Feature 4: Fact Check */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 mt-1">
                <Scale size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Instant Fact-Checking</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  Spot a dubious claim? Use the "Fact Check" button on any comment. Your AI will verify the information against reliable web sources and provide a verdict.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 pt-2 bg-white dark:bg-stone-900 relative z-20 shrink-0">
            <button
                onClick={onClose}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] btn-press flex items-center justify-center gap-2"
            >
                <span>Start Browsing</span>
                <CheckCircle size={18} className="text-emerald-200" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
