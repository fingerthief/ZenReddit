
import React, { useState, useRef, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, Minimize, Maximize } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Gesture state refs (to avoid re-renders during rapid events)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);

  // Reset zoom on open
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  // Handle Zoom Constraints
  useEffect(() => {
    if (scale < 1) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }
    if (scale > 1) {
        // Clamp position to edges
        // This is a simplified clamping, usually depends on viewport vs image size
    }
  }, [scale]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 4));
  const handleZoomOut = () => {
    setScale(s => {
        const next = s - 0.5;
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return Math.max(next, 1);
    });
  };

  const handleDownload = async () => {
    try {
        const response = await fetch(src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zen-reddit-${Date.now()}.jpg`; // generic name
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        // Fallback for CORS issues
        window.open(src, '_blank');
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
          setIsDragging(true);
      } else if (e.touches.length === 2) {
          initialPinchDistRef.current = getDistance(e.touches);
          initialScaleRef.current = scale;
          setIsDragging(false);
      }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent page scroll

      if (e.touches.length === 1 && isDragging && scale > 1) {
          const touch = e.touches[0];
          const last = lastTouchRef.current;
          if (!last) return;

          const dx = touch.clientX - last.x;
          const dy = touch.clientY - last.y;

          setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

      } else if (e.touches.length === 2 && initialPinchDistRef.current) {
          const dist = getDistance(e.touches);
          const ratio = dist / initialPinchDistRef.current;
          setScale(Math.max(1, Math.min(initialScaleRef.current * ratio, 5)));
      }
  };

  const onTouchEnd = () => {
      setIsDragging(false);
      lastTouchRef.current = null;
      initialPinchDistRef.current = null;
      
      // Snap back if scale is 1
      if (scale <= 1) {
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

            <div className="flex gap-2 pointer-events-auto">
                 <button 
                    onClick={handleDownload}
                    className="p-2 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-white/20 transition-colors"
                    title="Download"
                >
                    <Download size={24} />
                </button>
            </div>
        </div>

        {/* Image Container */}
        <div 
            className="w-full h-full flex items-center justify-center touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={handleDoubleTap}
        >
            <img 
                ref={imgRef}
                src={src} 
                alt={alt}
                className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out select-none"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    cursor: scale > 1 ? 'grab' : 'default'
                }}
                draggable={false}
            />
        </div>

        {/* Zoom Controls (Bottom) */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto">
            <div className="flex bg-stone-900/80 backdrop-blur-md rounded-full px-2 py-1 border border-stone-800">
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
