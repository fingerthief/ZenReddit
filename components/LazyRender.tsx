
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
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin,
        threshold: 0
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [rootMargin]);

  // Measure content height when visible using an inner wrapper
  useEffect(() => {
    if (!isVisible || !contentRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            // Measure the inner content wrapper
            // borderBoxSize is preferred, fallback to contentRect
            const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
            
            if (newHeight > 0) {
                setMeasuredHeight(prev => {
                    // Small optimization: don't trigger state update if height is effectively same
                    if (prev && Math.abs(prev - newHeight) < 1) return prev;
                    return newHeight;
                });
            }
        }
    });

    resizeObserver.observe(contentRef.current);
    return () => resizeObserver.disconnect();
  }, [isVisible]);

  // Determine the effective height to apply to the container
  // If we have a measured height, use it. Otherwise use default minHeight.
  const effectiveHeight = measuredHeight || minHeight;

  return (
    <div 
        ref={containerRef} 
        className={className}
        style={{ 
            ...style,
            // When hidden: force height to exact measured value to maintain scroll position
            height: !isVisible ? effectiveHeight : undefined,
            // When visible: use minHeight to reserve space prevents 'pop-in' on scroll up,
            // but because we update effectiveHeight based on the INNER wrapper,
            // if the inner content shrinks (collapse), this minHeight will update and allow shrinking.
            minHeight: isVisible ? effectiveHeight : undefined,
            contain: !isVisible ? 'size layout paint' : undefined,
            overflow: 'hidden' // Ensure clean clipping during resizing
        }}
    >
      {isVisible && (
          // flow-root creates a new block formatting context, preventing margin collapse issues
          <div ref={contentRef} style={{ display: 'flow-root' }}>
            {children}
          </div>
      )}
    </div>
  );
};

export default LazyRender;
