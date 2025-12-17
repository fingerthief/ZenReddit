import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Images, Captions } from 'lucide-react';
import { GalleryItem } from '../types';
import Hls from 'hls.js';

interface ImageViewerProps {
  items: GalleryItem[];
  initialIndex?: number;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ items, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Swipe State
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Subtitle State
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Video logic helpers
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const hlsInstances = useRef<Map<number, Hls>>(new Map());

  // Gesture state refs
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Reset zoom on index change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsAnimating(true);
  }, [currentIndex]);

  // Clean up HLS instances
  useEffect(() => {
    return () => {
        hlsInstances.current.forEach(hls => hls.destroy());
        hlsInstances.current.clear();
    };
  }, []);

  // Manage Video Playback based on current index
  useEffect(() => {
    // Pause other videos
    videoRefs.current.forEach((vid, idx) => {
        if (!vid) return;
        if (idx !== currentIndex) {
            vid.pause();
        } else {
            // Play current if it is a video
            vid.play().catch(() => {});
            
            // HLS setup for current if needed
            const item = items[idx];
            if (item.type === 'video' && item.videoSources?.hls && Hls.isSupported() && !hlsInstances.current.has(idx)) {
                 const hls = new Hls({
                     enableWebVTT: true,
                     capLevelToPlayerSize: true
                 });
                 
                 // Listener for subtitles to update state if this is the current video
                 hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
                     if (idx === currentIndex) {
                        setHasSubtitles(hls.subtitleTracks.length > 0);
                        setSubtitlesEnabled(hls.subtitleTrack !== -1);
                     }
                 });

                 hls.loadSource(item.videoSources.hls);
                 hls.attachMedia(vid);
                 hlsInstances.current.set(idx, hls);
            } else if (item.type === 'video' && item.videoSources?.hls && vid.canPlayType('application/vnd.apple.mpegurl')) {
                 vid.src = item.videoSources.hls;
            }
        }
    });
  }, [currentIndex, items]);

  // Sync subtitle state when changing slides
  useEffect(() => {
      const hls = hlsInstances.current.get(currentIndex);
      if (hls && hls.subtitleTracks.length > 0) {
          setHasSubtitles(true);
          setSubtitlesEnabled(hls.subtitleTrack !== -1);
      } else {
          setHasSubtitles(false);
          setSubtitlesEnabled(false);
      }
  }, [currentIndex]);

  const toggleSubtitles = () => {
      const hls = hlsInstances.current.get(currentIndex);
      if (hls) {
          if (subtitlesEnabled) {
              hls.subtitleTrack = -1;
              setSubtitlesEnabled(false);
          } else {
              // Enable first track usually (index 0)
              hls.subtitleTrack = 0; 
              setSubtitlesEnabled(true);
          }
      }
  };

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) setCurrentIndex(c => c + 1);
  }, [currentIndex, items.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(c => c - 1);
  }, [currentIndex]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 4));
  const handleZoomOut = () => {
    setScale(s => {
        const next = s - 0.5;
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return Math.max(next, 1);
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const handleDownload = async () => {
    const currentItem = items[currentIndex];
    if (currentItem.type === 'video' && currentItem.videoSources?.mp4) {
        window.open(currentItem.videoSources.mp4, '_blank');
        return;
    }
    
    try {
        const response = await fetch(currentItem.src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zen-reddit-${Date.now()}.jpg`; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        window.open(currentItem.src, '_blank');
    }
  };

  // --- Touch Handlers ---

  const getDistance = (touches: React.TouchList) => {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
  };

  const onTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          // Single touch
          lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          
          if (scale === 1) {
              // Prepare for swipe
              setIsDragging(true);
              setIsAnimating(false); // Disable transition for direct 1:1 movement
          } else {
              // Prepare for pan
              setIsDragging(true);
          }
      } else if (e.touches.length === 2) {
          // Pinch start
          initialPinchDistRef.current = getDistance(e.touches);
          initialScaleRef.current = scale;
          setIsDragging(false);
      }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      e.preventDefault(); 

      if (e.touches.length === 1 && isDragging) {
          const touch = e.touches[0];
          const last = lastTouchRef.current;
          
          if (!last || !swipeStartRef.current) return;

          const dx = touch.clientX - last.x;
          const dy = touch.clientY - last.y;

          if (scale > 1) {
              // Pan logic
              setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          } else {
              // Swipe logic
              const totalDx = touch.clientX - swipeStartRef.current.x;
              
              // Add resistance at edges
              if ((currentIndex === 0 && totalDx > 0) || (currentIndex === items.length - 1 && totalDx < 0)) {
                  setDragOffset(totalDx * 0.3);
              } else {
                  setDragOffset(totalDx);
              }
          }
          
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      } 
      // Pinch Zoom Logic
      else if (e.touches.length === 2 && initialPinchDistRef.current) {
          const dist = getDistance(e.touches);
          const ratio = dist / initialPinchDistRef.current;
          setScale(Math.max(1, Math.min(initialScaleRef.current * ratio, 5)));
      }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
      setIsDragging(false);
      lastTouchRef.current = null;
      initialPinchDistRef.current = null;
      
      // Swipe End Logic
      if (scale === 1) {
          setIsAnimating(true); // Re-enable transition for snap
          const threshold = window.innerWidth * 0.2; // 20% width to swipe
          
          if (dragOffset < -threshold && currentIndex < items.length - 1) {
              setCurrentIndex(c => c + 1);
          } else if (dragOffset > threshold && currentIndex > 0) {
              setCurrentIndex(c => c - 1);
          }
          
          setDragOffset(0);
      } else {
          // Snap back if scale went below 1
          if (scale <= 1) {
              setScale(1);
              setPosition({ x: 0, y: 0 });
          }
      }
      
      swipeStartRef.current = null;
  };

  const handleDoubleTap = () => {
      if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
      } else {
          setScale(2.5);
      }
  };

  const currentItem = items[currentIndex];
  const isVideo = currentItem.type === 'video';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        {/* Main Content Container */}
        <div 
            ref={containerRef}
            className="relative w-full h-full md:w-[95vw] md:h-[90vh] md:max-w-7xl md:rounded-xl md:overflow-hidden md:bg-black md:shadow-2xl md:border md:border-stone-800 flex flex-col bg-black transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none transition-opacity duration-300">
                <button 
                    onClick={onClose}
                    className="p-2 bg-black/40 text-white rounded-full backdrop-blur-md pointer-events-auto hover:bg-white/20 transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="flex items-center gap-3">
                    {items.length > 1 && (
                        <div className="bg-black/40 text-white px-3 py-1.5 rounded-full backdrop-blur-md text-sm font-medium flex items-center gap-2">
                            <Images size={14} />
                            <span>{currentIndex + 1} / {items.length}</span>
                        </div>
                    )}
                    
                    {/* CC Button */}
                    {hasSubtitles && (
                        <button 
                            onClick={toggleSubtitles}
                            className={`p-2 rounded-full backdrop-blur-md transition-colors pointer-events-auto ${subtitlesEnabled ? 'bg-emerald-600 text-white' : 'bg-black/40 text-white hover:bg-white/20'}`}
                            title="Toggle Captions"
                        >
                            <Captions size={24} />
                        </button>
                    )}

                    <button 
                        onClick={handleDownload}
                        className="p-2 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-white/20 transition-colors pointer-events-auto"
                        title={isVideo ? "Open in New Tab" : "Download"}
                    >
                        <Download size={24} />
                    </button>
                </div>
            </div>

            {/* Media Track Container */}
            <div 
                className="w-full h-full touch-none relative flex-1"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onDoubleClick={handleDoubleTap}
            >
                {/* The Track */}
                <div 
                    className="flex h-full w-full"
                    style={{ 
                        transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
                        transition: isAnimating ? 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
                    }}
                >
                    {items.map((item, index) => {
                        // Optimization: Only render content for current, prev, and next slides
                        if (Math.abs(currentIndex - index) > 1) {
                            return <div key={item.id || index} className="w-full h-full flex-shrink-0" />;
                        }

                        const isCurrent = index === currentIndex;
                        const itemIsVideo = item.type === 'video';

                        return (
                            <div key={item.id || index} className="w-full h-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                                {itemIsVideo ? (
                                    <video
                                        ref={(el) => { videoRefs.current[index] = el; }}
                                        className="max-w-full max-h-full"
                                        controls={isCurrent}
                                        playsInline
                                        poster={item.src}
                                        onClick={(e) => e.stopPropagation()} 
                                        style={{
                                            // Only apply zoom transform to current slide
                                            transform: isCurrent ? `translate(${position.x}px, ${position.y}px) scale(${scale})` : 'none',
                                            transition: 'transform 0.1s ease-out'
                                        }}
                                    >
                                        <source src={item.videoSources?.mp4} type="video/mp4" />
                                    </video>
                                ) : (
                                    <img 
                                        src={item.src} 
                                        alt={item.caption || "Full size"}
                                        className="max-w-full max-h-full object-contain select-none"
                                        style={{ 
                                            transform: isCurrent ? `translate(${position.x}px, ${position.y}px) scale(${scale})` : 'none',
                                            transition: isDragging && scale > 1 ? 'none' : 'transform 0.2s ease-out',
                                            cursor: scale > 1 ? 'grab' : 'default'
                                        }}
                                        draggable={false}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {/* Caption */}
                {currentItem.caption && scale === 1 && (
                    <div className="absolute bottom-20 left-4 right-4 text-center pointer-events-none transition-opacity duration-300">
                        <span className="inline-block bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm">
                            {currentItem.caption}
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation Buttons (Desktop) */}
            {currentIndex > 0 && (
                <button 
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 text-white rounded-full transition-all hidden md:block z-20 hover:scale-110 active:scale-95"
                >
                    <ChevronLeft size={32} />
                </button>
            )}
            {currentIndex < items.length - 1 && (
                <button 
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 text-white rounded-full transition-all hidden md:block z-20 hover:scale-110 active:scale-95"
                >
                    <ChevronRight size={32} />
                </button>
            )}

            {/* Zoom Controls (Bottom) - Only for images */}
            {!isVideo && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto z-10 opacity-0 md:opacity-100 transition-opacity">
                    <div className="flex bg-stone-900/80 backdrop-blur-md rounded-full px-2 py-1 border border-stone-800 shadow-lg">
                        <button 
                            onClick={handleZoomOut}
                            className="p-3 text-stone-300 hover:text-white disabled:opacity-50"
                            disabled={scale <= 1}
                        >
                            <ZoomOut size={20} />
                        </button>
                        <div className="w-px bg-stone-700 my-2"></div>
                        <button 
                            onClick={handleZoomIn}
                            className="p-3 text-stone-300 hover:text-white disabled:opacity-50"
                            disabled={scale >= 4}
                        >
                            <ZoomIn size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default ImageViewer;