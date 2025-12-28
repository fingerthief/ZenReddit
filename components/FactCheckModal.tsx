
import React from 'react';
import { FactCheckResult } from '../types';
import { X, ExternalLink, CheckCircle, XCircle, AlertTriangle, HelpCircle, Scale } from 'lucide-react';

interface FactCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: FactCheckResult | null;
  isLoading: boolean;
  originalText: string;
}

const FactCheckModal: React.FC<FactCheckModalProps> = ({ 
    isOpen, onClose, result, isLoading, originalText 
}) => {
  if (!isOpen) return null;

  const getVerdictStyle = (verdict: string) => {
      switch (verdict) {
          case 'True': return { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800', icon: CheckCircle };
          case 'False': return { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', icon: XCircle };
          case 'Misleading': return { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800', icon: AlertTriangle };
          case 'Opinion': return { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: Scale };
          default: return { color: 'text-stone-600', bg: 'bg-stone-50 dark:bg-stone-800', border: 'border-stone-200 dark:border-stone-700', icon: HelpCircle };
      }
  };

  const style = result ? getVerdictStyle(result.verdict) : getVerdictStyle('Unverified');
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
        
        <div className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-700 animate-scale-in relative z-10 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50">
                <div className="flex items-center gap-2">
                    <Scale size={20} className="text-emerald-600 dark:text-emerald-400" />
                    <h2 className="font-bold text-stone-800 dark:text-stone-100">Zen Fact Check</h2>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors">
                    <X size={20} className="text-stone-500" />
                </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
                {/* Original Text Quote */}
                <div className="mb-6 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-300 dark:bg-stone-700 rounded-full"></div>
                    <p className="pl-4 text-sm text-stone-600 dark:text-stone-300 italic line-clamp-4">
                        "{originalText}"
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-emerald-100 dark:border-emerald-900 border-t-emerald-500 animate-spin"></div>
                            <Scale size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-stone-500 animate-pulse">Researching claims...</p>
                    </div>
                ) : result ? (
                    <div className="space-y-6">
                        {/* Verdict Banner */}
                        <div className={`flex items-center gap-3 p-4 rounded-xl border ${style.bg} ${style.border}`}>
                            <Icon size={32} className={style.color} />
                            <div>
                                <h3 className={`font-bold text-lg ${style.color}`}>{result.verdict}</h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 font-medium opacity-80">AI Assessment</p>
                            </div>
                        </div>

                        {/* Explanation */}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-2">Analysis</h4>
                            <div className="text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap">
                                {result.explanation}
                            </div>
                        </div>

                        {/* References */}
                        {result.sources.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider mb-3">References</h4>
                                <ul className="space-y-2">
                                    {result.sources.map((source, idx) => (
                                        <li key={idx}>
                                            <a 
                                                href={source.uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-100 dark:border-stone-700 transition-colors group"
                                            >
                                                <ExternalLink size={14} className="mt-0.5 text-stone-400 group-hover:text-emerald-500 shrink-0" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 leading-snug">
                                                        {source.title}
                                                    </span>
                                                    <span className="text-xs text-stone-400 truncate max-w-[250px] mt-0.5">
                                                        {new URL(source.uri).hostname}
                                                    </span>
                                                </div>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        <div className="text-[10px] text-stone-400 text-center pt-2">
                            Automated fact-checking via OpenRouter AI. Results may vary.
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-stone-500">
                        <AlertTriangle className="mx-auto mb-2 text-stone-400" size={24} />
                        <p>Unable to verify this comment.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default FactCheckModal;
