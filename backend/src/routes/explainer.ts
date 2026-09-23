import type { Express, Request, Response } from "express";
import { jsonrepair } from "jsonrepair";
import type { AiProviderName } from "../lib/ai/provider";

/**
 * Concept explainer domain, extracted from server.ts (audit GA-114 step 5).
 * Behavior is identical to the inline version: same paths, same validation,
 * same spend guard, same five-strategy JSON recovery pipeline.
 *
 * Shared AI orchestration (spend guard, prompt loading, provider selection,
 * chat dispatch) stays in server.ts and is injected, so journal and routine
 * keep using the single implementation.
 */
export interface ExplainerDeps {
  allowAiSpend(req: Request, res: Response): boolean;
  loadPrompt(filename: string, variables?: Record<string, any>): string;
  isAiProviderName(value: unknown): value is AiProviderName;
  aiChat(
    systemPrompt: string,
    userPrompt: string,
    options?: { provider?: AiProviderName; model?: string; imageUrl?: string }
  ): Promise<string>;
}

function cleanControlCharacters(aiResponse: string): string {
  return aiResponse
    .replace(/\x0c(rac|orall\b)/g, '\\\\f$1')
    .replace(/\x08(eta|ar|egin\b)/g, '\\\\b$1')
    .replace(/\u0009(heta|au|imes|anh|an|ext|ilde|o\b)/g, '\\\\t$1')
    .replace(/\r(ho\b)/g, '\\\\r$1')
    .replace(/\n(eq|abla|u|eg\b)/g, '\\\\n$1');
}

function cleanLatexEscapes(jsonStr: string): string {
  const latexKeywords = [
    'frac', 'beta', 'neq', 'rho', 'theta', 'tau', 'uparrow', 'downarrow',
    'bar', 'begin', 'times', 'tan', 'tanh', 'text', 'tilde', 'to', 'delta',
    'Delta', 'alpha', 'gamma', 'Gamma', 'omega', 'Omega', 'lambda', 'Lambda',
    'phi', 'Phi', 'psi', 'Psi', 'sigma', 'Sigma', 'pi', 'Pi', 'mu', 'nu',
    'eta', 'chi', 'xi', 'Xi', 'zeta', 'partial', 'infty', 'int', 'sum',
    'prod', 'lim', 'sqrt', 'log', 'ln', 'sin', 'cos', 'cot', 'sec', 'csc',
    'sinh', 'cosh', 'deg', 'div', 'grad', 'curl', 'nabla', 'pm', 'mp',
    'le', 'ge', 'approx', 'equiv', 'propto', 'parallel', 'perp', 'angle',
    'triangle', 'cup', 'cap', 'subset', 'subseteq', 'in', 'notin', 'ni',
    'forall', 'exists', 'neg', 'lor', 'land', 'implies', 'iff', 'leftarrow',
    'rightarrow', 'leftrightarrow', 'u'
  ];
  const latexRegex = new RegExp(`(?<!\\\\)\\\\(${latexKeywords.join('|')})\\b`, 'g');
  return jsonStr.replace(latexRegex, '\\\\$1');
}

/**
 * Strip markdown code fences (```json ... ```) that LLMs often wrap around JSON.
 */
function stripMarkdownFences(raw: string): string {
  // Remove leading ```json or ``` and trailing ```
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?\s*```\s*$/i, '');
  return cleaned.trim();
}

/**
 * Fix common JSON corruption patterns that LLMs produce:
 *  - Unescaped newlines inside string values
 *  - Trailing commas before } or ]
 *  - Single-quoted strings
 *  - Unquoted property names
 *  - Truncated JSON (missing closing braces)
 */
function aggressiveSanitize(jsonStr: string): string {
  let s = jsonStr;

  // Fix unescaped literal newlines/tabs inside strings by walking character by character
  // This is the #1 cause of "Expected ':' after property name" errors
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
    }
    result += ch;
  }
  s = result;

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Balance braces: if truncated, close open braces/brackets
  let braces = 0;
  let brackets = 0;
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
    }
  }
  // If we ended inside a string, close it
  if (inStr) s += '"';
  // Close any open brackets/braces
  while (brackets > 0) { s += ']'; brackets--; }
  while (braces > 0) { s += '}'; braces--; }

  return s;
}

/**
 * Robust multi-strategy JSON extractor. Tries 5 strategies in order:
 *  1. Direct parse after sanitization
 *  2. jsonrepair after sanitization
 *  3. Strip markdown fences + retry
 *  4. Aggressive sanitize (fix newlines, balance braces) + jsonrepair
 *  5. Extract a minimal valid object from the raw text
 *
 * Returns { data, error } â€” data is null only if ALL strategies fail.
 */
export function robustJsonExtract(rawAiOutput: string): { data: any; error: string | null } {
  if (!rawAiOutput || rawAiOutput.trim().length === 0) {
    return { data: null, error: "AI returned empty response." };
  }

  // Pre-process: strip control chars and markdown fences
  let cleaned = cleanControlCharacters(rawAiOutput);
  cleaned = stripMarkdownFences(cleaned);

  // Extract the outermost { ... } block
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) {
    return { data: null, error: "No JSON object boundaries found in AI response." };
  }

  const extracted = cleaned.substring(start, end + 1);

  // â”€â”€ Strategy 1: Direct parse with LaTeX escape cleaning â”€â”€
  try {
    const s1 = cleanLatexEscapes(extracted);
    return { data: JSON.parse(s1), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 2: jsonrepair on LaTeX-cleaned string â”€â”€
  try {
    const s2 = cleanLatexEscapes(extracted);
    const repaired = jsonrepair(s2);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 3: Aggressive sanitize (fix newlines, balance braces) + jsonrepair â”€â”€
  try {
    const s3 = aggressiveSanitize(cleanLatexEscapes(extracted));
    const repaired = jsonrepair(s3);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 4: Raw jsonrepair on original extracted text (no LaTeX cleaning) â”€â”€
  try {
    const s4 = aggressiveSanitize(extracted);
    const repaired = jsonrepair(s4);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 5: Build minimal fallback object from whatever we can extract â”€â”€
  try {
    const topicMatch = extracted.match(/"(?:topic|concept)"\s*:\s*"([^"]+)"/);
    const overviewMatch = extracted.match(/"(?:overview|summary)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const fallback: any = {
      session: {
        topic: topicMatch ? topicMatch[1] : "Explanation",
        difficulty: "Medium",
        exam_tags: ["GATE"],
        prerequisites: [],
        next_topics: []
      },
      overview: overviewMatch ? overviewMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "The AI generated an explanation but it contained formatting errors. Here is a simplified version.",
      sections: [{
        id: "recovered-text",
        title: "Explanation (Recovered)",
        type: "text" as const,
        content: "The AI's response had formatting issues. Please try asking again or rephrase your question for a cleaner response."
      }],
      follow_up_questions: [],
      quiz: [],
      off_syllabus: false
    };

    // Try to recover any section content
    const contentMatches = extracted.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
    if (contentMatches && contentMatches.length > 0) {
      fallback.sections = contentMatches.slice(0, 6).map((m: string, i: number) => {
        const val = m.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        return {
          id: `recovered-${i}`,
          title: `Section ${i + 1}`,
          type: "text" as const,
          content: val ? val[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : ""
        };
      });
    }

    console.log("[AI JSON Recovery] All parse strategies failed. Returning recovered fallback object.");
    return { data: fallback, error: null };
  } catch (finalErr: any) {
    return { data: null, error: `All JSON parse strategies failed: ${finalErr.message}` };
  }
}

export function registerExplainerRoutes(app: Express, deps: ExplainerDeps): void {
  const { allowAiSpend, loadPrompt, isAiProviderName, aiChat } = deps;
async function explainConcept(req: Request, res: Response) {
  if (!allowAiSpend(req, res)) return;
  const { topic, mode, deep, image, ocrText: providedOcrText, history } = req.body;
  const requestedProvider = isAiProviderName(req.body?.aiProvider) ? req.body.aiProvider : undefined;
  const requestedModel = typeof req.body?.aiModel === "string" && req.body.aiModel.trim().length <= 160
    ? req.body.aiModel.trim()
    : undefined;
  const requestedAiOptions = { provider: requestedProvider, model: requestedModel };
  if ((!topic || topic.trim().length < 2) && !image && !providedOcrText) {
    return res.status(400).json({ error: "Please enter a topic or upload an image." });
  }
  
  try {
    const user_name = "Aspirant";
    const prep_level = "Beginner";
    
    const subjectsList = [
      "1: Engineering Mathematics",
      "2: Engineering Mechanics",
      "3: Strength of Materials",
      "4: Theory of Machines",
      "5: Machine Design",
      "6: Fluid Mechanics",
      "7: Heat Transfer",
      "8: Thermodynamics",
      "9: Power Plant Engineering",
      "10: Refrigeration & Air Conditioning",
      "11: Internal Combustion Engines",
      "12: Manufacturing Engineering",
      "13: Industrial Engineering",
      "14: General Aptitude"
    ].join("\n");

    // OCR: use provided ocrText if available, otherwise run Gemma Vision OCR on image
    let ocrText = providedOcrText || "";
    if (!ocrText && image) {
      try {
        console.log("[OCR] Using Gemma 4 Vision (google/gemma-4-31b-it) for image OCR...");
        const ocrResponse = await aiChat(
          "You are an expert OCR and image analysis tool. Extract ALL text, equations, diagrams, labels, and visual information from this image. Be extremely thorough and precise. Return the extracted content as plain text, preserving mathematical notation with LaTeX where appropriate.",
          `Analyze this image thoroughly. Extract every piece of text, equation, symbol, diagram label, and visual content you can see. The user wants to understand: "${topic || "What is in this image?"}"`,
          {
            ...requestedAiOptions,
            imageUrl: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
          }
        );
        ocrText = ocrResponse.trim();
        console.log("[OCR] Gemma 4 Vision extracted text. Length:", ocrText.length);
      } catch (ocrErr: any) {
        console.error("[OCR Gemma Vision Error]", ocrErr.message);
      }
    }

    let mergedTopic = topic || "";
    if (ocrText) {
      mergedTopic = `[User uploaded an image. Gemma Vision OCR extracted the following content from the image:\n${ocrText}\n\nUser's prompt/question: "${topic || "Explain this concept"}" ]`;
    }
    
    const systemPrompt = loadPrompt("explainer.md", {
      user_name,
      topic_input: mergedTopic,
      mode: deep ? `${mode || "detailed"} with deeper derivation and exam reasoning` : mode || "detailed",
      prep_level,
      subjects_list: subjectsList
    });

    let finalSystemPrompt = systemPrompt;
    if (Array.isArray(history) && history.length > 0) {
      const historyText = history.map((h: any) => {
        let contentStr = "";
        if (typeof h.content === "string") {
          try {
            const parsed = JSON.parse(h.content);
            const topicName = parsed.session?.topic || parsed.concept || "";
            const overviewStr = parsed.overview || parsed.summary || "";
            const sectionsList = parsed.sections || parsed.blocks || [];
            contentStr = `Concept: ${topicName}\nOverview: ${overviewStr}\nSections/Blocks: ${JSON.stringify(sectionsList)}`;
          } catch {
            contentStr = h.content;
          }
        } else if (h.content && typeof h.content === "object") {
          const topicName = h.content.session?.topic || h.content.concept || "";
          const overviewStr = h.content.overview || h.content.summary || "";
          const sectionsList = h.content.sections || h.content.blocks || [];
          contentStr = `Concept: ${topicName}\nOverview: ${overviewStr}\nSections/Blocks: ${JSON.stringify(sectionsList)}`;
        } else {
          contentStr = JSON.stringify(h.content);
        }
        return `${h.role === "user" ? "Student" : "Scholar"}: ${contentStr}`;
      }).join("\n\n");

      finalSystemPrompt += "\n\n## Conversation History:\n" + historyText +
        "\n\nStudent's new follow-up doubt: \"" + (topic || "") + "\"\n" +
        "Answer this follow-up doubt in detail based on the conversation history. You MUST return the response in the same JSON schema format (session, layout, off_syllabus, subject_id, overview, sections, follow_up_questions, quiz) specified in the system instructions. Make the session.topic represent the follow-up concept or keep it consistent with the previous topic.";
    }

    const startTime = Date.now();
    let aiResponse = "";
    let success = true;
    let errorMessage: string | null = null;
    let data: any = null;
    let parseSuccessful = false;

    // First attempt
    try {
      aiResponse = await aiChat(
        "You are Jujum AI, a private mentor helping a student prepare for the GATE exam and PSU recruitment. Return JSON only.",
        finalSystemPrompt,
        requestedAiOptions
      );

      const result = robustJsonExtract(aiResponse);
      if (result.data) {
        data = result.data;
        parseSuccessful = true;
      } else {
        errorMessage = result.error;
      }
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
    }

    // Fallback attempt (stricter instructions) â€” only if first attempt completely failed
    if (!parseSuccessful) {
      console.log("[AI Fallback] First attempt failed JSON parsing. Retrying with stricter instructions.");
      success = true;
      errorMessage = null;
      try {
        const fallbackPrompt = finalSystemPrompt + "\n\nCRITICAL WARNING: Your previous response was invalid JSON. You must return ONLY the raw minified JSON object matching the requested schema, starting with { and ending with }. No conversation, no markdown codeblocks, and no wrapping in ```json. Do not use literal newlines inside string values â€” use \\n instead.";
        aiResponse = await aiChat(
          "You are a strict JSON responder. You must return ONLY a valid, minified JSON object matching the requested schema. Do not output anything else.",
          fallbackPrompt,
          requestedAiOptions
        );

        const result = robustJsonExtract(aiResponse);
        if (result.data) {
          data = result.data;
          parseSuccessful = true;
        } else {
          errorMessage = result.error;
        }
      } catch (err: any) {
        success = false;
        errorMessage = err.message;
      }
    }

    const latencyMs = Date.now() - startTime;

    if (parseSuccessful && data) {
      // Normalize array data if jsonrepair wrapped multiple elements
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const root = data[0];
          if (root && typeof root === "object") {
            if (!root.sections && root.blocks) {
              root.sections = root.blocks;
            }
            if (!root.sections) {
              root.sections = [];
            }
            for (let i = 1; i < data.length; i++) {
              const item = data[i];
              if (item && typeof item === "object") {
                const targetList = root.sections || root.blocks || [];
                targetList.push(item);
              }
            }
            data = root;
          }
        }
      }

      const explanationId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      return res.json({
        explanationId,
        data,
        ocrExtracted: ocrText || null
      });
    } else {
      return res.status(500).json({ 
        error: "AI response failed JSON formatting check. Please try again.",
        details: errorMessage || "Failed to parse final AI response as JSON.",
        rawOutput: aiResponse
      });
    }
  } catch (error: any) {
    console.error("Explainer API Error:", error);
    res.status(500).json({ error: error.message });
  }
}

app.post("/api/explainer/query", explainConcept);
app.post("/api/explainer/explain", (req: Request, res: Response) => {
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const userQuery = typeof req.body?.userQuery === "string" ? req.body.userQuery.trim() : "";
  req.body = {
    ...req.body,
    topic: [subject, topic, userQuery].filter(Boolean).join(": ") || topic || userQuery,
    mode: req.body?.mode || "detailed",
  };
  return explainConcept(req, res);
});

}
