
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, CircleAlert, Loader2, Shield, Key, Check, Search, Sparkles, Layers, Type, MessageSquare, Archive, Upload, Download } from 'lucide-react';
import { AIConfig, AIProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  textSize: 'small' | 'medium' | 'large';
  onTextSizeChange: (size: 'small' | 'medium' | 'large') => void;
}

const POPULAR_MODELS = [
  { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite', isFree: true },
  { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B', isFree: true },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', isFree: true },
  { id: 'liquid/lfm-40b:free', name: 'Liquid LFM 40B', isFree: true },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, config, onSave, pageSize, onPageSizeChange, textSize, onTextSizeChange 
}) => {
  const [provider] = useState<AIProvider>('openrouter');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('meta-llama/llama-3-8b-instruct:free');
  const [minZenScore, setMinZenScore] = useState(50);
  const [customInstructions, setCustomInstructions] = useState('');
  const [analyzeComments, setAnalyzeComments] = useState(false);
  
  const [localPageSize, setLocalPageSize] = useState(pageSize);
  const [localTextSize, setLocalTextSize] = useState(textSize);
  
  // New state for models
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  // Dropdown state
  const [showModelList, setShowModelList] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOpenRouterKey(config.openRouterKey || '');
      setOpenRouterModel(config.openRouterModel || 'meta-llama/llama-3-8b-instruct:free');
      setMinZenScore(config.minZenScore ?? 50);
      setCustomInstructions(config.customInstructions || '');
      setAnalyzeComments(config.analyzeComments || false);
      setLocalPageSize(pageSize);
      setLocalTextSize(textSize);
    }
  }, [isOpen, config, pageSize, textSize]);

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
  }, [openRouterKey, models.length]);


  const handleSave = () => {
    onSave({
      provider,
      openRouterKey: openRouterKey,
      openRouterModel: openRouterModel,
      minZenScore,
      customInstructions,
      analyzeComments
    });
    onPageSizeChange(localPageSize);
    onTextSizeChange(localTextSize);

    onClose();
  };

  const getStrictnessLabel = (val: number) => {
      if (val < 30) return { text: "Relaxed", color: "text-blue-500" };
      if (val < 70) return { text: "Balanced", color: "text-emerald-500" };
      return { text: "Strict", color: "text-purple-500" };
  };

  // Export Logic
  const handleExport = () => {
    const data = {
      timestamp: Date.now(),
      zen_followed_subs: localStorage.getItem('zen_followed_subs'),
      zen_ai_config: localStorage.getItem('zen_ai_config'),
      zen_blocked_count: localStorage.getItem('zen_blocked_count'),
      zen_blocked_comment_count: localStorage.getItem('zen_blocked_comment_count'),
      zen_theme: localStorage.getItem('zen_theme'),
      zen_sort: localStorage.getItem('zen_sort'),
      zen_page_size: localStorage.getItem('zen_page_size'),
      zen_text_size: localStorage.getItem('zen_text_size')
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zen-reddit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Logic
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Basic validation check
        if (!json.zen_followed_subs && !json.zen_ai_config) {
            alert("Invalid backup file.");
            return;
        }

        if (confirm("This will overwrite your current settings and subscriptions. Continue?")) {
            if (json.zen_followed_subs) localStorage.setItem('zen_followed_subs', json.zen_followed_subs);
            if (json.zen_ai_config) localStorage.setItem('zen_ai_config', json.zen_ai_config);
            if (json.zen_blocked_count) localStorage.setItem('zen_blocked_count', json.zen_blocked_count);
            if (json.zen_blocked_comment_count) localStorage.setItem('zen_blocked_comment_count', json.zen_blocked_comment_count);
            if (json.zen_theme) localStorage.setItem('zen_theme', json.zen_theme);
            if (json.zen_sort) localStorage.setItem('zen_sort', json.zen_sort);
            if (json.zen_page_size) localStorage.setItem('zen_page_size', json.zen_page_size);
            if (json.zen_text_size) localStorage.setItem('zen_text_size', json.zen_text_size);
            
            window.location.reload();
        }
      } catch (err) {
        alert("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Filter models based on input
  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(openRouterModel.toLowerCase()) || 
    m.id.toLowerCase().includes(openRouterModel.toLowerCase())
  ).slice(0, 50);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-[90vh] flex flex-col animate-scale-in">
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

            {/* AI Comment Analysis Toggle */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                    <label className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                        <MessageSquare size={16} />
                        Zen Comments
                    </label>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                        Analyze comments when you open a post and hide toxic or aggressive threads automatically.
                    </p>
                </div>
                <div 
                    className={`w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors ${analyzeComments ? 'bg-emerald-500' : 'bg-stone-300 dark:bg-stone-700'}`}
                    onClick={() => setAnalyzeComments(!analyzeComments)}
                >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${analyzeComments ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800"></div>

            {/* Display Options Section */}
            <div>
                 <div className="flex items-center gap-2 mb-3">
                     <Layers size={16} className="text-stone-400" />
                     <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Display Options</h3>
                </div>
                
                <div className="space-y-4">
                    {/* Page Size */}
                    <div>
                        <label className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2 block">Posts per Load</label>
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
                    </div>

                    {/* Text Size */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <Type size={14} className="text-stone-400" />
                             <label className="text-xs font-medium text-stone-500 dark:text-stone-400">Content Text Size</label>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {(['small', 'medium', 'large'] as const).map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setLocalTextSize(size)}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all capitalize ${
                                        localTextSize === size
                                            ? 'bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-800 dark:border-stone-100'
                                            : 'bg-white dark:bg-stone-950 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                                    }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-stone-100 dark:border-stone-800"></div>
            
            {/* Data Management (Import/Export) */}
            <div>
                 <div className="flex items-center gap-2 mb-3">
                     <Archive size={16} className="text-stone-400" />
                     <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Data Management</h3>
                </div>
                
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                    Backup your settings and subscriptions to transfer between devices.
                </p>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleExport}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all group"
                    >
                        <Download size={20} className="text-stone-400 group-hover:text-emerald-500 mb-2 transition-colors" />
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">Export Backup</span>
                    </button>
                    
                    <button 
                        onClick={handleImportClick}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
                    >
                        <Upload size={20} className="text-stone-400 group-hover:text-blue-500 mb-2 transition-colors" />
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">Import Data</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".json"
                        onChange={handleFileChange}
                    />
                </div>
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
                    className="w-full h-24 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-shadow"
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
                className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-shadow"
              />
              <p className="text-xs text-stone-400 mt-1">Stored locally in your browser.</p>
            </div>

            <div ref={dropdownRef} className="relative">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">
                Model Selection
              </label>

              {/* Quick Select Chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                 {POPULAR_MODELS.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setOpenRouterModel(m.id)}
                        className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                            openRouterModel === m.id 
                            ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400 font-medium shadow-sm'
                            : 'bg-stone-50 border-stone-200 text-stone-600 dark:bg-stone-800 dark:border-stone-700 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700'
                        }`}
                    >
                        {m.name}
                    </button>
                 ))}
              </div>

              <div className="relative group">
                  <input
                    type="text"
                    value={openRouterModel}
                    onChange={(e) => {
                        setOpenRouterModel(e.target.value);
                        setShowModelList(true);
                    }}
                    onFocus={() => setShowModelList(true)}
                    placeholder="Search model ID (e.g. anthropic/claude-3)..."
                    className="w-full bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl pl-10 pr-10 py-3 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                      <Search size={16} />
                  </div>
                  
                  {/* Right Actions: Loading or Clear */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       {loadingModels && <Loader2 className="animate-spin text-stone-400" size={16} />}
                       {!loadingModels && openRouterModel && (
                           <button 
                             onClick={() => {
                                 setOpenRouterModel('');
                                 setShowModelList(true);
                             }}
                             className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
                           >
                               <X size={14} />
                           </button>
                       )}
                  </div>
              </div>

              {/* Inline Dropdown for Mobile Friendliness */}
              {showModelList && (
                  <div className="mt-2 w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl shadow-inner max-h-[300px] overflow-y-auto custom-scrollbar animate-fade-in">
                      {models.length === 0 && !loadingModels && (
                          <div className="p-4 text-center text-sm text-stone-500">
                              {openRouterKey.length < 5 ? "Enter API Key to load models" : "No models found."}
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
                            className="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-500 italic border-t border-stone-100 dark:border-stone-800"
                          >
                              Use custom ID: "{openRouterModel}"
                          </button>
                      )}
                  </div>
              )}
              
              <div className="flex items-start gap-2 mt-3 p-2 bg-stone-50 dark:bg-stone-900/50 rounded-lg border border-stone-100 dark:border-stone-800">
                  <CircleAlert size={14} className="text-stone-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-relaxed">
                      Models with "free", "flash", or "haiku" in the name are usually the fastest and cheapest options for filtering.
                  </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-stone-100 dark:border-stone-800 flex justify-end sticky bottom-0 bg-white dark:bg-stone-900 shrink-0">
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 bg-stone-800 dark:bg-stone-100 text-stone-100 dark:text-stone-900 px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity active:scale-95"
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
