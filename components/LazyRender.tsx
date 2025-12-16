
import React, { useRef, useState, useEffect, ReactNode } from 'react';

interface LazyRenderProps {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}

const LazyRender: React.FC<LazyRenderProps> = ({ 
  children, 
  rootMargin = '800px', 
  minHeight = 100,
  className = '',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
            setIsVisible(true);
        } else {
            // When scrolling away, capture the exact height of the element
            // before it unmounts. This prevents the document height from jumping.
            const currentHeight = entry.boundingClientRect.height;
            if (currentHeight > 0) {
                setPlaceholderHeight(currentHeight);
            }
            setIsVisible(false);
        }
      },
      { 
          rootMargin,
          // Threshold 0 means "as soon as 1 pixel is visible/invisible"
          threshold: 0 
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div 
        ref={containerRef} 
        className={className}
        style={{ 
            ...style,
            // If visible, allow auto height so content can resize (e.g. images loading).
            // If not visible, lock to the last measured height to maintain scroll position.
            // If never measured (initial load off-screen), use minHeight.
            height: isVisible ? undefined : (placeholderHeight || minHeight),
            minHeight: isVisible ? undefined : (placeholderHeight || minHeight),
            // Ensure the placeholder maintains layout block behavior
            display: 'block', 
            // containment isn't strictly necessary with explicit height but helps performance
            // preventing layout thrashing when hidden.
            contain: isVisible ? 'none' : 'strict' 
        }}
    >
      {isVisible ? children : null}
    </div>
  );
};

export default LazyRender;
