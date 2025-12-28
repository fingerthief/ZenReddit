
import React from 'react';
import { Sparkles, Shield, Zap } from 'lucide-react';

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
      <div className="relative bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl shadow-2xl p-6 md:p-8 animate-scale-in border border-stone-200 dark:border-stone-700 overflow-hidden">
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
          <p className="text-center text-stone-500 dark:text-stone-400 mb-8 max-w-sm mx-auto">
            A peaceful way to browse. We use Artificial Intelligence to filter your feed in real-time.
          </p>

          <div className="space-y-6 mb-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Rage-Bait Shield</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  The AI analyzes every post to detect hostility, divisive politics, and content designed to induce stress. These are hidden automatically.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Zen Score</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                  Content is graded from 0-100 based on positivity and constructive value. You can adjust the strictness of this filter in the settings menu.
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
