import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$(?!\$)[^\$\n]+?\$|\\\([\s\S]+?\\\))/g;

interface LatexProps {
  text: string;
  className?: string;
}

export const Latex = React.memo(function Latex({ text, className }: LatexProps) {
  if (!text) return null;

  // Split text by matching delimiters. Odd indices will be the math matches
  // because MATH_REGEX uses a capturing group.
  const parts = text.split(MATH_REGEX);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMath = index % 2 !== 0;

        if (!isMath) {
          return <span key={index}>{part}</span>;
        }

        // Identify block vs inline math and clean delimiters
        let mathContent = part;
        let displayMode = false;

        if (part.startsWith("$$") && part.endsWith("$$")) {
          mathContent = part.slice(2, -2);
          displayMode = true;
        } else if (part.startsWith("\\[") && part.endsWith("\\]")) {
          mathContent = part.slice(2, -2);
          displayMode = true;
        } else if (part.startsWith("$") && part.endsWith("$")) {
          mathContent = part.slice(1, -1);
          displayMode = false;
        } else if (part.startsWith("\\(") && part.endsWith("\\)")) {
          mathContent = part.slice(2, -2);
          displayMode = false;
        }

        try {
          // Render math content to HTML string using KaTeX
          const html = katex.renderToString(mathContent, {
            displayMode,
            throwOnError: true, // Throw error on malformed LaTeX so try-catch fallback works
          });

          return (
            <span
              key={index}
              className={displayMode ? "katex-block-wrapper block my-2" : "katex-inline-wrapper inline-block mx-0.5"}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (error) {
          console.warn("Failed to parse LaTeX equation: ", part, error);
          // Fall back gracefully to raw LaTeX text on error
          return <span key={index}>{part}</span>;
        }
      })}
    </span>
  );
});
