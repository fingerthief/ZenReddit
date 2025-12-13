
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { GalleryItem } from '../types';

interface ImageViewerProps {
  items: GalleryItem[];
  initialIndex?: number;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ items, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Gesture state refs
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const currentItem = items[currentIndex];

  // Reset zoom on index change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

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
          lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          setIsDragging(true);
      } else if (e.touches.length === 2) {
          initialPinchDistRef.current = getDistance(e.touches);
          initialScaleRef.current = scale;
          setIsDragging(false);
      }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      e.preventDefault(); 

      // Pan Logic (only if zoomed in)
      if (e.touches.length === 1 && isDragging && scale > 1) {
          const touch = e.touches[0];
          const last = lastTouchRef.current;
          if (!last) return;

          const dx = touch.clientX - last.x;
          const dy = touch.clientY - last.y;

          setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
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
      
      // Swipe Logic (only if NOT zoomed in)
      if (scale === 1 && swipeStartRef.current) {
          const endX = e.changedTouches[0].clientX;
          const diffX = endX - swipeStartRef.current.x;
          
          if (Math.abs(diffX) > 50) { // Threshold
              if (diffX < 0) handleNext();
              else handlePrev();
          }
      }
      swipeStartRef.current = null;

      // Snap back if scale went below 1
      if (scale <= 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
      }
  };

  const handleDoubleTap = () => {
      if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
      } else {
          setScale(2.5);
      }
  };

  return (
    <div 
        className="fixed inset-0 z-[60] bg-black flex items-center justify-center overflow-hidden animate-in fade-in duration-200"
        ref={containerRef}
        onClick={(e) => {
            if (e.target === containerRef.current) onClose();
        }}
    >
        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
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
                 <button 
                    onClick={handleDownload}
                    className="p-2 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-white/20 transition-colors pointer-events-auto"
                    title="Download"
                >
                    <Download size={24} />
                </button>
            </div>
        </div>

        {/* Image Container */}
        <div 
            className="w-full h-full flex items-center justify-center touch-none relative"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={handleDoubleTap}
        >
            <img 
                key={currentItem.src}
                src={currentItem.src} 
                alt={currentItem.caption || "Full size"}
                className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out select-none"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    cursor: scale > 1 ? 'grab' : 'default'
                }}
                draggable={false}
            />
            
            {/* Caption */}
            {currentItem.caption && scale === 1 && (
                <div className="absolute bottom-20 left-4 right-4 text-center pointer-events-none">
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
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 text-white rounded-full transition-all hidden md:block"
            >
                <ChevronLeft size={32} />
            </button>
        )}
        {currentIndex < items.length - 1 && (
            <button 
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/30 hover:bg-black/50 text-white rounded-full transition-all hidden md:block"
            >
                <ChevronRight size={32} />
            </button>
        )}

        {/* Zoom Controls (Bottom) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto z-10">
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
    </div>
  );
};

export default ImageViewer;
