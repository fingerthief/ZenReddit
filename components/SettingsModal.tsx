
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, CircleAlert, Loader2, Shield, Key, Check, Search, Sparkles, Layers } from 'lucide-react';
import { AIConfig, AIProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave, pageSize, onPageSizeChange }) => {
  const [provider] = useState<AIProvider>('openrouter');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.0-flash-lite-preview-02-05:free');
  const [minZenScore, setMinZenScore] = useState(50);
  const [customInstructions, setCustomInstructions] = useState('');
  const [localPageSize, setLocalPageSize] = useState(pageSize);
  
  // New state for models
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Dropdown state
  const [showModelList, setShowModelList] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOpenRouterKey(config.openRouterKey || '');
      setOpenRouterModel(config.openRouterModel || 'google/gemini-2.0-flash-lite-preview-02-05:free');
      setMinZenScore(config.minZenScore ?? 50);
      setCustomInstructions(config.customInstructions || '');
      setLocalPageSize(pageSize);
    }
  }, [isOpen, config, pageSize]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effect to fetch models when key changes
  useEffect(() => {
    // Debounce the fetch to avoid hitting API on every keystroke
    const timeoutId = setTimeout(async () => {
        if (openRouterKey.trim().length > 5 && models.length === 0) {
            setLoadingModels(true);
            try {
                const response = await fetch("https://openrouter.ai/api/v1/models", {
                    headers: {
                        "Authorization": `Bearer ${openRouterKey}`,
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && Array.isArray(data.data)) {
                        const sortedModels = data.data
                            .map((m: any) => ({ id: m.id, name: m.name || m.id }))
                            .sort((a: any, b: any) => a.name.localeCompare(b.name));
                        setModels(sortedModels);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch OpenRouter models", error);
            } finally {
                setLoadingModels(false);
            }
        }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [openRouterKey, models.length]); // Added models.length to dependency to prevent refetch if already loaded


  const handleSave = () => {
    onSave({
      provider,
      openRouterKey: openRouterKey,
      openRouterModel: openRouterModel,
      minZenScore,
      customInstructions
    });
    onPageSizeChange(localPageSize);
    onClose();
  };

  const getStrictnessLabel = (val: number) => {
      if (val < 30) return { text: "Relaxed", color: "text-blue-500" };
      if (val < 70) return { text: "Balanced", color: "text-emerald-500" };
      return { text: "Strict", color: "text-purple-500" };
  };

  // Filter models based on input
  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(openRouterModel.toLowerCase()) || 
    m.id.toLowerCase().includes(openRouterModel.toLowerCase())
  ).slice(0, 50); // Limit to 50 results for performance

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 sticky top-0 z-10 shrink-0">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Settings</h2>
          <button onClick={onClose} className="p-1.5 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
            {/* Filter Strictness Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                     <label className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                        <Shield size={16} />
                        Filter Strictness
                    </label>
                    <span className={`text-xs font-bold uppercase tracking-wide ${getStrictnessLabel(minZenScore).color}`}>
                        {getStrictnessLabel(minZenScore).text} ({minZenScore})
                    </span>
                </div>
                
                <input 
                    type="range" 
                    min="10" 
                    max="90" 
                    step="5"
                    value={minZenScore}
                    onChange={(e) => setMinZenScore(Number(e.target.value))}
                    className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between mt-2 text-[10px] text-stone-400 uppercase font-medium">
                    <span>Allow More</span>
                    <span>Zen Only</span>
                </div>
                <p className="text-xs text-stone-500 mt-3 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-lg border border-stone-100 dark:border-stone-800">
                    {minZenScore < 40 && "Only extreme rage bait will be blocked. Mild annoyances will pass through."}
                    {minZenScore >= 40 && minZenScore <= 60 && "Standard filtering. Blocks obviously divisive content and anger-inducing posts."}
                    {minZenScore > 60 && "High purity. Filters out anything even slightly controversial or non-constructive."}
                </p>
            </div>
            
            <div className="border-t border-stone-100 dark:border-stone-800"></div>

            {/* Page Size Section */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                     <Layers size={16} className="text-stone-400" />
                     <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Posts per Load</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[25, 50, 100].map((size) => (
                        <button
                            key={size}
                            onClick={() => setLocalPageSize(size)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                                localPageSize === size
                                    ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-800 dark:border-stone-100'
                                    : 'bg-white dark:bg-stone-950 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                            }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-stone-400 mt-2">
                    Higher values load more posts but may be slower to analyze.
                </p>
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800"></div>

            {/* Custom Instructions Section */}
            <div>
                 <label className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                    <Sparkles size={16} />
                    Custom Instructions
                </label>
                <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g. I dislike politics, I love cats, Filter out spoilers..."
                    className="w-full h-24 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    These instructions will be passed to the AI to tailor your feed.
                </p>
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800"></div>

          {/* OpenRouter Config */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                 <Key size={16} className="text-stone-400" />
                 <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">OpenRouter Configuration</h3>
            </div>
            
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                This app uses OpenRouter to access AI models. You need an API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">openrouter.ai</a>.
            </p>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={openRouterKey}
                onChange={(e) => setOpenRouterKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <p className="text-xs text-stone-400 mt-1">Stored locally in your browser.</p>
            </div>

            <div ref={dropdownRef}>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                Model ID
              </label>
              <div className="relative">
                  <div className="relative">
                      <input
                        type="text"
                        value={openRouterModel}
                        onChange={(e) => {
                            setOpenRouterModel(e.target.value);
                            setShowModelList(true);
                        }}
                        onFocus={() => setShowModelList(true)}
                        placeholder="Search or enter model ID..."
                        className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg pl-3 pr-10 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <div className="absolute right-2 top-2 text-stone-400">
                          {loadingModels ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                      </div>
                  </div>

                  {/* Custom Dropdown */}
                  {showModelList && (
                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {models.length === 0 && !loadingModels && (
                              <div className="p-4 text-center text-sm text-stone-500">
                                  {openRouterKey.length < 5 ? "Enter API Key to load models" : "No models found or loading..."}
                              </div>
                          )}
                          
                          {filteredModels.map(model => (
                              <button
                                  key={model.id}
                                  onClick={() => {
                                      setOpenRouterModel(model.id);
                                      setShowModelList(false);
                                  }}
                                  className="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 border-b border-stone-100 dark:border-stone-800 last:border-0 flex items-center justify-between group transition-colors"
                              >
                                  <div className="min-w-0 pr-2">
                                      <div className="font-medium text-stone-800 dark:text-stone-200 truncate">{model.name}</div>
                                      <div className="text-xs text-stone-500 truncate">{model.id}</div>
                                  </div>
                                  {openRouterModel === model.id && <Check size={16} className="text-emerald-500 shrink-0" />}
                              </button>
                          ))}
                          
                          {filteredModels.length === 0 && openRouterModel && models.length > 0 && (
                              <button
                                onClick={() => setShowModelList(false)}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-500 italic"
                              >
                                  Use custom ID: "{openRouterModel}"
                              </button>
                          )}
                      </div>
                  )}
              </div>
              
              <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-900/30">
                  <CircleAlert size={14} className="text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-700 dark:text-yellow-500">
                      Tip: Models with "flash" or "haiku" in the name are usually faster and cheaper.
                  </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800 flex justify-end sticky bottom-0 bg-white dark:bg-stone-900 shrink-0">
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 bg-stone-800 dark:bg-stone-100 text-stone-100 dark:text-stone-900 px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
