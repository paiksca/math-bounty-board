import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LatexRendererProps {
  content: string;
  className?: string;
}

export function LatexRenderer({ content, className = '' }: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Parse content for LaTeX expressions
    const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g);
    containerRef.current.innerHTML = '';

    parts.forEach((part) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        // Display math
        const math = part.slice(2, -2);
        const span = document.createElement('div');
        span.className = 'my-4';
        try {
          katex.render(math, span, { displayMode: true, throwOnError: false });
        } catch {
          span.textContent = part;
        }
        containerRef.current?.appendChild(span);
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline math
        const math = part.slice(1, -1);
        const span = document.createElement('span');
        try {
          katex.render(math, span, { displayMode: false, throwOnError: false });
        } catch {
          span.textContent = part;
        }
        containerRef.current?.appendChild(span);
      } else {
        // Regular text
        const textNode = document.createTextNode(part);
        containerRef.current?.appendChild(textNode);
      }
    });
  }, [content]);

  return <div ref={containerRef} className={className} />;
}
