
import React from 'react';
import { Sparkles, Shield, Zap, MessageSquare, Sliders } from 'lucide-react';

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
      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 animate-scale-in border border-stone-200 dark:border-stone-700 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center rotate-3 shadow-lg ring-1 ring-emerald-500/20">
                <Sparkles className="text-emerald-600 dark:text-emerald-400" size={32} />
             </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-stone-900 dark:text-stone-100 mb-2">
            Welcome to ZenReddit
          </h2>
          <p className="text-center text-stone-500 dark:text-stone-400 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
            Experience Reddit without the stress. We use advanced AI to curate your feed in real-time.
          </p>

          <div className="space-y-6 mb-8">
            {/* Feature 1: Post Analysis */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Rage-Bait & Stress Shield</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  The AI reads titles and body text to detect hostility, divisive politics, and anxiety-inducing patterns. Content is graded 0-100 (Zen Score) and hidden if it fails your strictness settings.
                </p>
              </div>
            </div>

            {/* Feature 2: Comment Context */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Contextual Comment Analysis</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  We don't just look at keywords. The AI analyzes thread context to distinguish between friendly banter and actual toxicity, collapsing harmful discussions automatically.
                </p>
              </div>
            </div>

            {/* Feature 3: Customization */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Tailored to You</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  You control the AI. Go to <strong>Settings</strong> to add custom prompts (e.g., "I hate spoilers," "No political news," or "I love cats") to shape exactly how the analysis works.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] btn-press"
          >
            Start Browsing
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
