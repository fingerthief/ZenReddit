import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2, Shield } from 'lucide-react';
import { AIConfig, AIProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (config: AIConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.0-flash-lite-preview-02-05:free');
  const [minZenScore, setMinZenScore] = useState(50);
  
  // New state for models
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProvider(config.provider);
      setOpenRouterKey(config.openRouterKey || '');
      setOpenRouterModel(config.openRouterModel || 'google/gemini-2.0-flash-lite-preview-02-05:free');
      setMinZenScore(config.minZenScore ?? 50);
    }
  }, [isOpen, config]);

  // Effect to fetch models when key changes
  useEffect(() => {
    // Debounce the fetch to avoid hitting API on every keystroke
    const timeoutId = setTimeout(async () => {
        if (provider === 'openrouter' && openRouterKey.trim().length > 5) {
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
  }, [openRouterKey, provider]);


  const handleSave = () => {
    onSave({
      provider,
      openRouterKey: provider === 'openrouter' ? openRouterKey : undefined,
      openRouterModel: provider === 'openrouter' ? openRouterModel : undefined,
      minZenScore,
    });
    onClose();
  };

  const getStrictnessLabel = (val: number) => {
      if (val < 30) return { text: "Relaxed", color: "text-blue-500" };
      if (val < 70) return { text: "Balanced", color: "text-emerald-500" };
      return { text: "Strict", color: "text-purple-500" };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Settings</h2>
          <button onClick={onClose} className="p-1.5 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
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

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">AI Provider</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  provider === 'gemini'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:border-emerald-200'
                }`}
              >
                <span className="font-semibold">Gemini API</span>
                <span className="text-[10px] opacity-75">Built-in (Fast)</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('openrouter')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  provider === 'openrouter'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:border-emerald-200'
                }`}
              >
                <span className="font-semibold">OpenRouter</span>
                <span className="text-[10px] opacity-75">Custom Models</span>
              </button>
            </div>
          </div>

          {/* Gemini Info */}
          {provider === 'gemini' && (
             <div className="bg-stone-50 dark:bg-stone-800 p-4 rounded-lg text-sm text-stone-600 dark:text-stone-400">
               <p>Using the app's default Google Gemini integration. No configuration needed.</p>
             </div>
          )}

          {/* OpenRouter Config */}
          {provider === 'openrouter' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  OpenRouter API Key
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

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Model ID
                </label>
                <div className="relative">
                    <input
                      type="text"
                      list="openrouter-models"
                      value={openRouterModel}
                      onChange={(e) => setOpenRouterModel(e.target.value)}
                      placeholder="Type to search or enter model ID..."
                      className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 pr-8"
                    />
                    <datalist id="openrouter-models">
                        {models.map((model) => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                    </datalist>
                    {loadingModels && (
                        <div className="absolute right-3 top-2.5 text-stone-400 animate-spin">
                            <Loader2 size={16} />
                        </div>
                    )}
                </div>
                
                <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-100 dark:border-yellow-900/30">
                    <AlertCircle size={14} className="text-yellow-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-yellow-700 dark:text-yellow-500">
                        Ensure the model supports JSON Output or the app may fail to filter posts correctly.
                    </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800 flex justify-end sticky bottom-0 bg-white dark:bg-stone-900">
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