import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// --- HELPERS ---

function preprocessMarkdown(content: string): string {
  if (!content) return "";

  let clean = content.replace(/\\(\$\$)/g, " $1");
  clean = clean.replace(/\\(\$)/g, " $1");

  return clean
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("\\") && !trimmed.includes("$")) {
        return "$$" + trimmed + "$$";
      }
      return line;
    })
    .join("\n");
}

function parseYamlOrJson(text: string) {
  try {
    return JSON.parse(text.trim());
  } catch {
    // Try simple key-value parser fallback
    const result: Record<string, any> = {};
    const lines = text.split("\n");
    let currentKey = "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex !== -1 && !trimmed.startsWith("-")) {
        currentKey = trimmed.substring(0, colonIndex).trim();
        const val = trimmed.substring(colonIndex + 1).trim();
        result[currentKey] = val;
      }
    }
    return result;
  }
}

// --- PREMIUM COMPONENTS ---

// 1. Premium Comparison Table
function PremiumTable({ children }: any) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-[var(--border)]/60 bg-white/50 shadow-sm">
      <table className="w-full border-collapse text-left text-xs leading-5">
        <thead className="bg-[var(--bg-elevated)]/60 border-b border-[var(--border)]/60">
          {children[0]}
        </thead>
        <tbody className="divide-y divide-[var(--border)]/40">
          {children.slice(1)}
        </tbody>
      </table>
    </div>
  );
}

// 2. Premium Blockquote & Callout Renderer
function PremiumBlockquote({ children }: any) {
  // Extract text from children to detect admonitions like [!NOTE], [!WARNING], [!TIP]
  let text = "";
  React.Children.forEach(children, (child) => {
    if (typeof child === "string") text += child;
    else if (child?.props?.children) {
      React.Children.forEach(child.props.children, (sub) => {
        if (typeof sub === "string") text += sub;
      });
    }
  });

  const lowercase = text.toLowerCase();
  
  if (lowercase.includes("[!warning]") || lowercase.includes("warning:")) {
    const cleanChildren = removePrefix(children, /\[!warning\]|warning:/i);
    return (
      <div className="my-5 rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] p-4 text-xs font-semibold text-[var(--danger)] leading-6 flex gap-3 items-start">
        <span className="text-base select-none">⚠️</span>
        <div className="flex-1">{cleanChildren}</div>
      </div>
    );
  }

  if (lowercase.includes("[!tip]") || lowercase.includes("tip:") || lowercase.includes("idea:")) {
    const cleanChildren = removePrefix(children, /\[!tip\]|tip:|idea:/i);
    return (
      <div className="my-5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-4 text-xs font-semibold text-emerald-700 leading-6 flex gap-3 items-start">
        <span className="text-base select-none">💡</span>
        <div className="flex-1">{cleanChildren}</div>
      </div>
    );
  }

  if (lowercase.includes("[!note]") || lowercase.includes("note:") || lowercase.includes("info:")) {
    const cleanChildren = removePrefix(children, /\[!note\]|note:|info:/i);
    return (
      <div className="my-5 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-4 text-xs font-semibold text-[var(--accent)] leading-6 flex gap-3 items-start">
        <span className="text-base select-none">ℹ️</span>
        <div className="flex-1">{cleanChildren}</div>
      </div>
    );
  }

  return (
    <blockquote className="my-5 border-l-3 border-[var(--border)] pl-4 italic text-[var(--text-secondary)] leading-7">
      {children}
    </blockquote>
  );
}

function removePrefix(children: any, regex: RegExp): any {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return child.replace(regex, "").trim();
    }
    if (child?.props?.children) {
      return React.cloneElement(child, {
        children: removePrefix(child.props.children, regex)
      });
    }
    return child;
  });
}

// 3. Compact Side-by-Side Formula Component
function FormulaBlock({ code }: { code: string }) {
  let expression = "";
  const variables: Record<string, string> = {};
  
  // Parse simple YAML
  const lines = code.split("\n");
  let inVariables = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith("expression:")) {
      expression = trimmed.substring("expression:".length).trim();
      inVariables = false;
    } else if (trimmed.startsWith("variables:")) {
      inVariables = true;
    } else if (inVariables) {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx !== -1) {
        let key = trimmed.substring(0, colonIdx).trim();
        if (key.startsWith("-")) key = key.substring(1).trim();
        const val = trimmed.substring(colonIdx + 1).trim();
        if (key) variables[key] = val;
      }
    }
  }

  if (!expression) {
    // If no custom syntax parsed, treat entire block as math expression
    expression = code.trim();
  }

  return (
    <div className="explainer-formula-block my-4 py-3 px-4 border-l-2 border-[var(--accent)] bg-[var(--bg-elevated)]/40 rounded-r-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1 text-center md:text-left py-1 overflow-x-auto">
        <AiMarkdown content={expression.includes("$") ? expression : `$$${expression}$$`} />
      </div>
      {Object.keys(variables).length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)] border-t md:border-t-0 md:border-l border-[var(--border)]/60 pt-2.5 md:pt-0 md:pl-4 min-w-[200px] max-w-md">
          <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--text-faint)] w-full block md:inline mb-0.5 select-none">Notation:</span>
          {Object.entries(variables).map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1.5 whitespace-nowrap bg-white border border-[var(--border)]/50 px-2 py-0.5 rounded text-[11px] shadow-sm">
              <span className="font-bold text-[var(--text-primary)]">
                <AiMarkdown content={key.includes("$") ? key : `$${key}$`} />
              </span>
              <span className="text-[var(--text-faint)]">=</span>
              <span className="text-[var(--text-secondary)] font-medium">{String(value)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// 4. Time and Space Complexity Badges
function ComplexityBadges({ code }: { code: string }) {
  const parsed = parseYamlOrJson(code);
  const time = parsed.time || parsed.Time || "O(1)";
  const space = parsed.space || parsed.Space || "O(1)";

  return (
    <div className="my-4 flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center rounded-lg border border-coral-500/20 bg-coral-50/50 p-1.5 text-xs font-semibold">
        <span className="bg-coral-500 text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 select-none">Time</span>
        <code className="text-coral-700 font-bold">{time}</code>
      </div>
      <div className="inline-flex items-center rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-1.5 text-xs font-semibold">
        <span className="bg-[var(--accent)] text-white text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded mr-2 select-none">Space</span>
        <code className="text-[var(--accent)] font-bold">{space}</code>
      </div>
    </div>
  );
}

// 5. Vertical Timeline Component
function TimelineComponent({ code }: { code: string }) {
  let steps: Array<{ title: string; content: string }> = [];
  
  try {
    const parsed = JSON.parse(code.trim());
    if (Array.isArray(parsed)) steps = parsed;
  } catch {
    // Parse line by line:
    // Step 1: title \n description
    const lines = code.split("\n");
    let currentStep: { title: string; content: string } | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.toLowerCase().startsWith("step") || trimmed.match(/^\d+\./)) {
        if (currentStep) steps.push(currentStep);
        
        const colonIdx = trimmed.indexOf(":");
        const title = colonIdx !== -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;
        currentStep = { title, content: "" };
      } else if (currentStep) {
        currentStep.content += (currentStep.content ? "\n" : "") + trimmed;
      }
    }
    if (currentStep) steps.push(currentStep);
  }

  return (
    <div className="my-6 pl-4 relative border-l border-[var(--border)] ml-3 flex flex-col gap-6">
      {steps.map((step, idx) => (
        <div key={idx} className="relative group">
          <div className="absolute -left-[25px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[var(--accent)] grid place-items-center text-[8px] font-bold text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition duration-200 select-none">
            {idx + 1}
          </div>
          <div className="pl-3">
            <h4 className="font-bold text-sm text-[var(--text-primary)] mb-1">{step.title}</h4>
            <p className="text-xs text-[var(--text-secondary)] leading-5 font-medium">{step.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// 6. Interactive MCQ Quiz Block
function QuizComponent({ code }: { code: string }) {
  interface Question {
    question: string;
    options: string[];
    answer: number;
    explanation?: string;
  }
  
  let quizData: Question[] = [];
  try {
    const parsed = JSON.parse(code.trim());
    quizData = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return <pre className="text-[10px] bg-red-50 text-red-700 p-2 rounded">Failed to parse Quiz JSON format.</pre>;
  }

  const [selected, setSelected] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  return (
    <div className="explainer-quiz my-6 flex flex-col gap-5">
      {quizData.map((q, qIdx) => {
        const isAnswered = selected[qIdx] !== undefined;
        return (
          <div key={qIdx} className="border border-[var(--border)] bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-[var(--text-primary)] mb-3 leading-5">
              <span className="text-[var(--accent)] mr-1">Q{qIdx + 1}.</span> {q.question}
            </p>
            <div className="grid gap-2">
              {q.options.map((opt, oIdx) => {
                const isSelected = selected[qIdx] === oIdx;
                const isCorrect = oIdx === q.answer;
                
                let btnStyle = "border-[var(--border)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]";
                if (isAnswered) {
                  if (isCorrect) {
                    btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold";
                  } else if (isSelected) {
                    btnStyle = "border-red-500 bg-red-50 text-red-800 font-semibold";
                  } else {
                    btnStyle = "border-[var(--border)] opacity-60 text-[var(--text-secondary)]";
                  }
                }

                return (
                  <button
                    key={oIdx}
                    disabled={isAnswered}
                    onClick={() => {
                      setSelected(prev => ({ ...prev, [qIdx]: oIdx }));
                      setShowExplanation(prev => ({ ...prev, [qIdx]: true }));
                    }}
                    className={`explainer-quiz-btn text-left text-xs p-2.5 rounded-lg border transition duration-150 cursor-pointer flex justify-between items-center ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswered && isCorrect && <span className="text-emerald-600 font-bold">✓</span>}
                    {isAnswered && isSelected && !isCorrect && <span className="text-red-600 font-bold">✗</span>}
                  </button>
                );
              })}
            </div>
            {showExplanation[qIdx] && q.explanation && (
              <div className="mt-3.5 border-t border-[var(--border)]/60 pt-3 text-[11px] text-[var(--text-secondary)] leading-5">
                <span className="font-bold text-[var(--accent)] mr-1">Explanation:</span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 7. Interactive Flip Cards (Flashcards)
function FlashcardsComponent({ code }: { code: string }) {
  interface Card {
    front: string;
    back: string;
  }
  
  let cards: Card[] = [];
  try {
    const parsed = JSON.parse(code.trim());
    cards = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return <pre className="text-[10px] bg-red-50 text-red-700 p-2 rounded">Failed to parse Flashcard JSON format.</pre>;
  }

  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  return (
    <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card, idx) => {
        const isFlipped = flipped[idx] || false;
        return (
          <div
            key={idx}
            onClick={() => setFlipped(prev => ({ ...prev, [idx]: !isFlipped }))}
            className="explainer-flashcard h-32 [perspective:1000px] cursor-pointer"
          >
            <div className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
              {/* Front side */}
              <div className="absolute inset-0 bg-white border border-[var(--border)] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm [backface-visibility:hidden]">
                <span className="text-[9px] uppercase tracking-wider text-[var(--text-faint)] font-bold mb-1.5 select-none">Click to Reveal</span>
                <p className="text-xs font-semibold text-[var(--text-primary)] leading-5 px-2">{card.front}</p>
              </div>
              {/* Back side */}
              <div className="absolute inset-0 bg-[var(--accent-soft)] border border-[var(--accent)]/10 rounded-xl p-4 flex items-center justify-center text-center shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <p className="text-xs font-semibold text-[var(--accent)] leading-5 px-2">{card.back}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 8. Expandable Interview Cards
function InterviewQuestionsComponent({ code }: { code: string }) {
  interface QAPair {
    question: string;
    answer: string;
  }
  
  let questions: QAPair[] = [];
  try {
    const parsed = JSON.parse(code.trim());
    questions = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return <pre className="text-[10px] bg-red-50 text-red-700 p-2 rounded">Failed to parse Interview JSON format.</pre>;
  }

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="explainer-interview-cards my-5 flex flex-col gap-3">
      {questions.map((qa, idx) => {
        const isExpanded = expanded[idx] || false;
        return (
          <div key={idx} className="border border-[var(--border)]/70 bg-white rounded-xl overflow-hidden shadow-sm transition">
            <button
              type="button"
              onClick={() => setExpanded(prev => ({ ...prev, [idx]: !isExpanded }))}
              className="flex justify-between items-center w-full text-left p-3.5 hover:bg-[var(--bg-elevated)]/40 transition cursor-pointer select-none"
            >
              <span className="text-xs font-bold text-[var(--text-primary)] leading-5 pr-4 flex items-start gap-2">
                <span className="text-amber-500 font-bold">Q.</span> {qa.question}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-semibold shrink-0">
                {isExpanded ? "Hide Answer" : "Reveal Answer"}
              </span>
            </button>
            {isExpanded && (
              <div className="border-t border-[var(--border)]/60 p-4 bg-slate-50/30 text-xs text-[var(--text-secondary)] leading-6 font-medium">
                {qa.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 9. Diagram Renderer using public rendering service
function MermaidDiagram({ code }: { code: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const cleanCode = code.trim();
  let base64 = "";
  try {
    base64 = btoa(unescape(encodeURIComponent(cleanCode)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch {
    return <pre className="text-[10px] bg-red-50 text-red-700 p-2 rounded">Failed to encode diagram.</pre>;
  }
  
  const url = `https://mermaid.ink/svg/${base64}`;

  return (
    <div className="explainer-diagram my-6 rounded-xl border border-[var(--border)]/60 bg-white p-4 flex flex-col items-center justify-center relative min-h-[140px] shadow-sm">
      <span className="text-[9px] uppercase tracking-wider text-[var(--text-faint)] font-bold mb-3 select-none">Flowchart & System Diagram</span>
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)] select-none">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[var(--accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Compiling diagram...
        </div>
      )}
      {error ? (
        <div className="text-xs text-[var(--danger)] font-semibold p-2">Failed to render diagram. Check syntax.</div>
      ) : (
        <img
          src={url}
          alt="System Diagram"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className="max-w-full h-auto object-contain py-1"
        />
      )}
    </div>
  );
}

// 10. Inline SVG Renderer
function SvgViewer({ code }: { code: string }) {
  const cleanCode = code.trim();
  if (!cleanCode.startsWith("<svg")) {
    return <pre className="text-[10px] bg-red-50 text-red-700 p-2 rounded">Invalid SVG markup.</pre>;
  }

  return (
    <div
      className="my-5 flex items-center justify-center overflow-x-auto p-4 rounded-xl border border-[var(--border)]/60 bg-white/50"
      dangerouslySetInnerHTML={{ __html: cleanCode }}
    />
  );
}

// 11. Custom Code block line highlights & Copy
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const lines = code.trim().split("\n");

  const highlightLine = (lineText: string) => {
    if (!lineText) return "\n";
    
    // Simple regex highlighting for common keywords, types, strings, comments
    const escaped = lineText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|export|import|from|int|float|double|char|void|struct|public|private|protected|virtual|override|std|include|import|def|elif|in|is|and|or|not|try|except|finally|with|as|lambda|namespace|typename|template|typedef)\b/g;
    const strings = /(["'`])(.*?)\1/g;
    const comments = /(\/\/.*|#.*)/g;
    const numbers = /\b(\d+)\b/g;

    let html = escaped;
    
    const commentTokens: string[] = [];
    html = html.replace(comments, (match) => {
      commentTokens.push(match);
      return `___COMMENT_TOKEN_${commentTokens.length - 1}___`;
    });

    const stringTokens: string[] = [];
    html = html.replace(strings, (match) => {
      stringTokens.push(match);
      return `___STRING_TOKEN_${stringTokens.length - 1}___`;
    });

    html = html.replace(keywords, '<span class="text-[var(--accent)] font-semibold">$1</span>');
    html = html.replace(numbers, '<span class="text-amber-600 font-medium">$1</span>');

    html = html.replace(/___STRING_TOKEN_(\d+)___/g, (_, idx) => {
      return `<span class="text-emerald-600">${stringTokens[parseInt(idx)]}</span>`;
    });

    html = html.replace(/___COMMENT_TOKEN_(\d+)___/g, (_, idx) => {
      return `<span class="text-gray-400 italic font-normal">${commentTokens[parseInt(idx)]}</span>`;
    });

    return html;
  };

  return (
    <div className="my-6 border border-[var(--border)]/65 bg-slate-900 rounded-xl overflow-hidden shadow-sm max-w-full">
      <div className="bg-slate-800/80 px-4 py-2 flex justify-between items-center border-b border-slate-700/60 select-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 px-2 py-0.5 rounded transition cursor-pointer"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto py-3 pl-3 pr-4 font-mono text-[11px] leading-6 text-slate-100 bg-slate-950/40">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-800/30">
                <td className="w-8 select-none text-slate-500 text-right pr-3 border-r border-slate-800 text-[10px]">
                  {idx + 1}
                </td>
                <td
                  className="pl-3 whitespace-pre font-mono"
                  dangerouslySetInnerHTML={{ __html: highlightLine(line) }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 12. Interactive Function Plotter Graph Component
function FunctionGraphBlock({ equation, range }: { equation: string; range?: [number, number] }) {
  const minX = range ? range[0] : -5;
  const maxX = range ? range[1] : 5;
  
  const evaluate = (eq: string, x: number): number => {
    try {
      let expr = eq.toLowerCase().replace(/\s+/g, "");
      expr = expr.replace(/sin/g, "Math.sin");
      expr = expr.replace(/cos/g, "Math.cos");
      expr = expr.replace(/tan/g, "Math.tan");
      expr = expr.replace(/log/g, "Math.log");
      expr = expr.replace(/exp/g, "Math.exp");
      expr = expr.replace(/sqrt/g, "Math.sqrt");
      expr = expr.replace(/abs/g, "Math.abs");
      expr = expr.replace(/pi/g, "Math.PI");
      expr = expr.replace(/e/g, "Math.E");
      expr = expr.replace(/x\^(\d+)/g, "Math.pow(x,$1)");
      
      const fn = new Function("x", `return ${expr}`);
      const val = fn(x);
      return isNaN(val) || !isFinite(val) ? 0 : val;
    } catch {
      return 0;
    }
  };

  const points: { x: number; y: number }[] = [];
  const stepsCount = 100;
  const step = (maxX - minX) / stepsCount;
  for (let i = 0; i <= stepsCount; i++) {
    const x = minX + i * step;
    points.push({ x, y: evaluate(equation, x) });
  }

  let minY = Math.min(...points.map(p => p.y));
  let maxY = Math.max(...points.map(p => p.y));
  
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  } else {
    const pad = (maxY - minY) * 0.1;
    minY -= pad;
    maxY += pad;
  }

  const width = 450;
  const height = 240;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const getSvgX = (x: number) => padL + ((x - minX) / (maxX - minX)) * chartW;
  const getSvgY = (y: number) => padT + chartH - ((y - minY) / (maxY - minY)) * chartH;

  const zeroX = getSvgX(0);
  const zeroY = getSvgY(0);

  const d = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${getSvgX(p.x)} ${getSvgY(p.y)}`)
    .join(" ");

  const gridLinesX = [];
  const gridLinesY = [];
  
  const xRange = maxX - minX;
  const xStepVal = xRange / 4;
  for (let i = 0; i <= 4; i++) {
    const val = minX + i * xStepVal;
    gridLinesX.push({ x: getSvgX(val), val: val.toFixed(1) });
  }

  const yRange = maxY - minY;
  const yStepVal = yRange / 4;
  for (let i = 0; i <= 4; i++) {
    const val = minY + i * yStepVal;
    gridLinesY.push({ y: getSvgY(val), val: val.toFixed(1) });
  }

  return (
    <div className="my-6 rounded-xl border border-[var(--border)]/65 bg-white p-4 shadow-sm max-w-full overflow-hidden flex flex-col items-center">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 select-none">Graph: y = {equation}</span>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-[450px]">
        {gridLinesY.map((line, idx) => (
          <g key={idx}>
            <line x1={padL} y1={line.y} x2={width - padR} y2={line.y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 8} y={line.y + 4} textAnchor="end" fontSize="9" className="fill-slate-400 font-medium font-sans">{line.val}</text>
          </g>
        ))}
        {gridLinesX.map((line, idx) => (
          <g key={idx}>
            <line x1={line.x} y1={padT} x2={line.x} y2={height - padB} stroke="#f1f5f9" strokeWidth="1" />
            <text x={line.x} y={height - padB + 14} textAnchor="middle" fontSize="9" className="fill-slate-400 font-medium font-sans">{line.val}</text>
          </g>
        ))}
        {zeroY >= padT && zeroY <= height - padB && (
          <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#cbd5e1" strokeWidth="1.5" />
        )}
        {zeroX >= padL && zeroX <= width - padR && (
          <line x1={zeroX} y1={padT} x2={zeroX} y2={height - padB} stroke="#cbd5e1" strokeWidth="1.5" />
        )}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// 13. Interactive Pie Chart Component
function PieChartBlock({ labels, data }: { labels: string[]; data: number[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = data.reduce((acc, v) => acc + (Number(v) || 0), 0);

  const colors = ["var(--accent)", "#0d9488", "#7c3aed", "#ea580c", "#ec4899", "#3b82f6"];
  const cx = 120;
  const cy = 120;
  const r = 80;

  let accumulatedAngle = 0;

  return (
    <div className="my-6 rounded-xl border border-[var(--border)]/65 bg-white p-4 shadow-sm max-w-full overflow-hidden flex flex-col items-center sm:flex-row sm:justify-around gap-6">
      <svg width={240} height={240} viewBox="0 0 240 240" className="max-w-[240px]">
        {data.map((val, idx) => {
          const percentage = total > 0 ? (val / total) : 0;
          const angle = percentage * 360;

          const x1 = cx + r * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
          const y1 = cy + r * Math.sin((accumulatedAngle - 90) * Math.PI / 180);

          accumulatedAngle += angle;

          const x2 = cx + r * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
          const y2 = cy + r * Math.sin((accumulatedAngle - 90) * Math.PI / 180);

          const largeArcFlag = angle > 180 ? 1 : 0;

          if (percentage >= 0.999) {
            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={r}
                fill={colors[idx % colors.length]}
                className="cursor-pointer opacity-90 hover:opacity-100 transition"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          }

          const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
          const isHovered = hoveredIdx === idx;

          return (
            <path
              key={idx}
              d={pathData}
              fill={colors[idx % colors.length]}
              opacity={isHovered ? 0.95 : 0.8}
              transform={isHovered ? `translate(${5 * Math.cos((accumulatedAngle - angle / 2 - 90) * Math.PI / 180)}, ${5 * Math.sin((accumulatedAngle - angle / 2 - 90) * Math.PI / 180)})` : ""}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-2 min-w-[120px]">
        {labels.map((lbl, idx) => {
          const val = data[idx] || 0;
          const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={idx}
              className={`flex items-center gap-2 p-1 rounded transition duration-150 ${isHovered ? "bg-slate-50 scale-105" : ""}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
              <div className="text-[11px] font-sans">
                <span className="font-bold text-[var(--text-primary)]">{lbl}</span>
                <span className="text-[var(--text-secondary)] font-medium ml-1">({percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 14. Interactive Multi-series SVG Chart Component (Line, Bar, Scatter)
function SvgChartBlock({ type, labels, datasets }: { type: string; labels: string[]; datasets: any[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<{ dsIdx: number; itemIdx: number } | null>(null);

  if (!datasets || datasets.length === 0) return null;

  const allValues: number[] = [];
  datasets.forEach(ds => {
    if (Array.isArray(ds.data)) {
      ds.data.forEach((val: any) => allValues.push(Number(val) || 0));
    }
  });

  let minVal = Math.min(...allValues, 0);
  let maxVal = Math.max(...allValues, 10);
  
  if (minVal === maxVal) {
    maxVal += 10;
  } else {
    const pad = (maxVal - minVal) * 0.1;
    maxVal += pad;
  }

  const colors = [
    { stroke: "var(--accent)", fill: "var(--accent-soft)", bar: "var(--accent)" },
    { stroke: "#0d9488", fill: "#f0fdfa", bar: "#0d9488" },
    { stroke: "#7c3aed", fill: "#f5f3ff", bar: "#7c3aed" },
    { stroke: "#ea580c", fill: "#fff7ed", bar: "#ea580c" }
  ];

  const width = 450;
  const height = 240;
  const padL = 40;
  const padR = 20;
  const padT = 30;
  const padB = 30;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const getSvgX = (idx: number) => {
    if (labels.length <= 1) return padL + chartW / 2;
    return padL + (idx / (labels.length - 1)) * chartW;
  };
  const getSvgY = (val: number) => padT + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

  const yLines = [];
  const range = maxVal - minVal;
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (i / 4) * range;
    yLines.push({ y: getSvgY(val), val: Math.round(val) });
  }

  if (type === "pie") {
    return <PieChartBlock labels={labels} data={datasets[0]?.data || []} />;
  }

  return (
    <div className="my-6 rounded-xl border border-[var(--border)]/65 bg-white p-4 shadow-sm max-w-full overflow-hidden flex flex-col items-center relative group">
      <div className="flex justify-between items-center w-full mb-3 select-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {datasets[0]?.label || "Data Visualization"}
        </span>
        {hoveredIdx !== null && (
          <div className="text-[10px] font-semibold bg-slate-900 text-white px-2 py-0.5 rounded shadow-sm">
            {labels[hoveredIdx.itemIdx]}: {datasets[hoveredIdx.dsIdx].data[hoveredIdx.itemIdx]}
          </div>
        )}
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="max-w-[450px]">
        {yLines.map((line, idx) => (
          <g key={idx}>
            <line x1={padL} y1={line.y} x2={width - padR} y2={line.y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={padL - 8} y={line.y + 4} textAnchor="end" fontSize="9" className="fill-slate-400 font-medium font-sans">{line.val}</text>
          </g>
        ))}
        {labels.map((lbl, idx) => {
          const x = type === "bar" 
            ? padL + (idx / labels.length) * chartW + (chartW / labels.length) / 2
            : getSvgX(idx);
          return (
            <text key={idx} x={x} y={height - 8} textAnchor="middle" fontSize="9" className="fill-slate-400 font-semibold font-sans">{lbl}</text>
          );
        })}
        {type === "bar" && datasets.map((ds, dsIdx) => {
          const barW = (chartW / labels.length) * 0.6;
          const offsetW = (chartW / labels.length) * 0.2;
          return ds.data.map((val: number, itemIdx: number) => {
            const x = padL + (itemIdx / labels.length) * chartW + offsetW;
            const y = getSvgY(val);
            const rectH = Math.max(height - padB - y, 2);
            const isHovered = hoveredIdx?.dsIdx === dsIdx && hoveredIdx?.itemIdx === itemIdx;

            return (
              <rect
                key={itemIdx}
                x={x}
                y={y}
                width={barW}
                height={rectH}
                rx="3"
                ry="3"
                fill={colors[dsIdx % colors.length].bar}
                opacity={isHovered ? 0.9 : 0.75}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx({ dsIdx, itemIdx })}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          });
        })}
        {type === "line" && datasets.map((ds, dsIdx) => {
          const color = colors[dsIdx % colors.length];
          const pathD = ds.data.map((val: number, itemIdx: number) => 
            `${itemIdx === 0 ? "M" : "L"} ${getSvgX(itemIdx)} ${getSvgY(val)}`
          ).join(" ");

          return (
            <g key={dsIdx}>
              <path d={pathD} fill="none" stroke={color.stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {ds.data.map((val: number, itemIdx: number) => {
                const cx = getSvgX(itemIdx);
                const cy = getSvgY(val);
                const isHovered = hoveredIdx?.dsIdx === dsIdx && hoveredIdx?.itemIdx === itemIdx;

                return (
                  <circle
                    key={itemIdx}
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill="white"
                    stroke={color.stroke}
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredIdx({ dsIdx, itemIdx })}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </g>
          );
        })}
        {type === "scatter" && datasets.map((ds, dsIdx) => {
          const color = colors[dsIdx % colors.length];
          return ds.data.map((val: number, itemIdx: number) => {
            const cx = getSvgX(itemIdx);
            const cy = getSvgY(val);
            const isHovered = hoveredIdx?.dsIdx === dsIdx && hoveredIdx?.itemIdx === itemIdx;

            return (
              <circle
                key={itemIdx}
                cx={cx}
                cy={cy}
                r={isHovered ? 7 : 5}
                fill={color.stroke}
                opacity={isHovered ? 0.95 : 0.75}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIdx({ dsIdx, itemIdx })}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}

// 15. Unified Chart/Graph Parsing Component
function ChartBlock({ code }: { code: string }) {
  let data: any = null;
  try {
    data = JSON.parse(code.trim());
  } catch {
    data = parseYamlOrJson(code);
  }

  if (!data || !data.type) {
    return <pre className="text-[10px] bg-red-50 text-red-700 p-2 rounded">Invalid Chart Config</pre>;
  }

  if (data.type === "function") {
    return <FunctionGraphBlock equation={data.equation || "x"} range={data.range} />;
  }

  return <SvgChartBlock type={data.type} labels={data.labels || []} datasets={data.datasets || []} />;
}

// --- MAIN WRAPPER COMPONENT ---

export function AiMarkdown({ content }: { content: string }) {
  if (!content) return null;
  const processed = preprocessMarkdown(content);

  return (
    <div className="ai-markdown max-w-none text-sm text-[var(--text-primary)] font-medium leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ node, ...props }) => <PremiumTable {...props} />,
          blockquote: ({ node, ...props }) => <PremiumBlockquote {...props} />,
          code: ({ node, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const lang = match ? match[1] : "";
            const rawContent = String(children).replace(/\n$/, "");

            if (lang === "formula") {
              return <FormulaBlock code={rawContent} />;
            }
            if (lang === "chart" || lang === "graph") {
              return <ChartBlock code={rawContent} />;
            }
            if (lang === "complexity") {
              return <ComplexityBadges code={rawContent} />;
            }
            if (lang === "timeline") {
              return <TimelineComponent code={rawContent} />;
            }
            if (lang === "quiz") {
              return <QuizComponent code={rawContent} />;
            }
            if (lang === "flashcards" || lang === "flashcard") {
              return <FlashcardsComponent code={rawContent} />;
            }
            if (lang === "interview") {
              return <InterviewQuestionsComponent code={rawContent} />;
            }
            if (lang === "mermaid" || lang === "diagram" || lang === "flowchart") {
              return <MermaidDiagram code={rawContent} />;
            }
            if (lang === "svg") {
              return <SvgViewer code={rawContent} />;
            }

            // If it's inline code (no block wrap) or no lang
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-slate-100 text-slate-800 font-mono text-[11px] px-1 py-0.5 rounded border border-slate-200/60 font-semibold" {...props}>
                  {children}
                </code>
              );
            }

            // Normal code block
            return <CodeBlock code={rawContent} lang={lang} />;
          }
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
