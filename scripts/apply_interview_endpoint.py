from pathlib import Path

path = Path("backend/src/server.ts")
source = path.read_text(encoding="utf-8-sig")
route = r'''

// Evaluate one PSU interview/GD answer with the configured AI provider.
app.post("/api/interview/evaluate", async (req: Request, res: Response) => {
  const company = typeof req.body?.company === "string" ? req.body.company.trim() : "";
  const mode = typeof req.body?.mode === "string" ? req.body.mode.trim() : "";
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
  const allowedModes = new Set(["Technical", "HR", "Mixed", "GD", "Rapid Fire"]);

  if (!company || company.length > 80 || !allowedModes.has(mode)) {
    return res.status(400).json({ error: "Choose a valid company and interview mode." });
  }
  if (question.length < 5 || question.length > 1000) {
    return res.status(400).json({ error: "The interview question is invalid." });
  }
  if (answer.length < 20 || answer.length > 8000) {
    return res.status(400).json({ error: "Answer must be between 20 and 8000 characters." });
  }

  const dimensionGuide = mode === "Technical" || mode === "Rapid Fire"
    ? "Technical correctness, Structure, Clarity, Completeness, Confidence"
    : mode === "HR"
      ? "Relevance, Honesty, Confidence, STAR structure, Professional tone"
      : mode === "GD"
        ? "Argument quality, Balance, Evidence, Structure, Communication"
        : "Technical/role relevance, Structure, Clarity, Completeness, Professional confidence";

  const systemPrompt = `You are a strict PSU interview evaluator for ${company}. Evaluate the candidate's ${mode} answer independently from its length or use of buzzwords. Score exactly five dimensions: ${dimensionGuide}. Each dimension value must be a number from 0 to 2 and the total score must be a number from 0 to 10 consistent with their sum. Return ONLY minified JSON with exactly this shape: {"score":0,"dimensions":[{"label":"string","value":0}],"missing":["string"],"improved":"string"}. Include exactly five dimensions and 1-3 specific missing points. The improved answer must preserve the candidate's language, register, and approximate length, while correcting factual and structural weaknesses. Use Markdown/LaTeX only inside string values when useful. No code fence, commentary, or extra keys.`;
  const userPrompt = `Company: ${company}\nMode: ${mode}\nQuestion: ${question}\nCandidate answer: ${answer}`;
  const startedAt = Date.now();
  let rawResponse = "";
  let success = false;
  let errorMessage: string | null = null;

  const validate = (value: any) => {
    if (!value || typeof value !== "object") throw new Error("Evaluation is not an object.");
    const dimensions = Array.isArray(value.dimensions) ? value.dimensions : [];
    const missing = Array.isArray(value.missing) ? value.missing : [];
    if (!Number.isFinite(Number(value.score)) || dimensions.length !== 5 || missing.length < 1 || missing.length > 3 || typeof value.improved !== "string") {
      throw new Error("Evaluation does not match the required schema.");
    }
    const normalizedDimensions = dimensions.map((item: any) => {
      const numericValue = Number(item?.value);
      if (typeof item?.label !== "string" || !Number.isFinite(numericValue) || numericValue < 0 || numericValue > 2) {
        throw new Error("Evaluation dimension is invalid.");
      }
      return { label: item.label.trim().slice(0, 60), value: Math.round(numericValue * 2) / 2 };
    });
    return {
      score: Math.max(0, Math.min(10, Math.round(Number(value.score) * 2) / 2)),
      dimensions: normalizedDimensions,
      missing: missing.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 3),
      improved: value.improved.trim(),
    };
  };

  try {
    // First attempt: use the same robust extractor used by the Explainer flow.
    rawResponse = await aiChat(systemPrompt, userPrompt);
    let evaluation: ReturnType<typeof validate>;
    try {
      evaluation = validate(robustJsonExtract(rawResponse));
    } catch (firstError) {
      // Fallback attempt: ask the model to repair its own malformed response.
      const repairPrompt = `${systemPrompt} Your previous response failed strict JSON/schema validation. Return the corrected minified JSON only. Do not repeat the invalid response or explain the repair.`;
      rawResponse = await aiChat(repairPrompt, userPrompt);
      evaluation = validate(robustJsonExtract(rawResponse));
    }

    success = true;
    await prisma.interviewAttempt.create({
      data: {
        sessionId: crypto.randomUUID(),
        company,
        mode,
        questionIndex: 0,
        questionText: question,
        userAnswer: answer,
        skipped: false,
        score: Math.round(evaluation.score),
        dimensions: evaluation.dimensions,
        missingPoints: evaluation.missing,
        improvedAnswer: evaluation.improved,
      },
    });

    return res.json(evaluation);
  } catch (error: any) {
    errorMessage = error instanceof Error ? error.message : "Interview evaluation failed.";
    console.error("Interview evaluation error:", error);
    return res.status(502).json({ error: "The AI evaluator could not score this answer. Your answer is still here; please retry." });
  } finally {
    await prisma.aiCallLog.create({
      data: {
        surface: "interview",
        latencyMs: Date.now() - startedAt,
        success,
        errorMessage,
        promptPreview: userPrompt.slice(0, 500),
        responsePreview: rawResponse.slice(0, 1000),
      },
    }).catch((logError) => console.error("Interview AI log error:", logError));
  }
});
'''

if 'app.post("/api/interview/evaluate"' in source:
    raise SystemExit("Interview endpoint already exists; refusing a duplicate patch.")
marker = "app.listen(PORT"
index = source.find(marker)
if index < 0:
    raise SystemExit("Could not find app.listen insertion marker.")
source = source[:index] + route + "\n" + source[index:]
path.write_text(source, encoding="utf-8")
