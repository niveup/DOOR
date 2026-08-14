/**
 * Default empty / mock responses for Demo Mode.
 * Keys mirror the backend API routes that pages fetch from.
 */

export const DEMO_DEFAULTS: Record<string, unknown> = {
  /* ── Dashboard ── */
  "api/routine/today": null,
  "api/tracker/status": {
    subjects: [
      {
        subjectId: 1,
        subjectName: "Thermodynamics",
        importanceLevel: 5,
        topics: ["Laws of Thermodynamics", "Properties of Pure Substances", "Power Cycles"],
        hoursStudied: 35,
        questionsSolved: 120,
        cumulativeHours: 35,
        cumulativeQuestions: 120,
      },
      {
        subjectId: 2,
        subjectName: "Fluid Mechanics",
        importanceLevel: 5,
        topics: ["Fluid Kinematics", "Bernoulli's Equation", "Boundary Layer"],
        hoursStudied: 28,
        questionsSolved: 95,
        cumulativeHours: 28,
        cumulativeQuestions: 95,
      },
      {
        subjectId: 3,
        subjectName: "Heat Transfer",
        importanceLevel: 4,
        topics: ["Conduction", "Convection", "Heat Exchangers"],
        hoursStudied: 20,
        questionsSolved: 70,
        cumulativeHours: 20,
        cumulativeQuestions: 70,
      },
      {
        subjectId: 4,
        subjectName: "Strength of Materials",
        importanceLevel: 4,
        topics: ["Stress & Strain", "Mohr's Circle", "Torsion"],
        hoursStudied: 22,
        questionsSolved: 80,
        cumulativeHours: 22,
        cumulativeQuestions: 80,
      },
      {
        subjectId: 5,
        subjectName: "Theory of Machines",
        importanceLevel: 3,
        topics: ["Mechanisms", "Gears", "Vibrations"],
        hoursStudied: 15,
        questionsSolved: 40,
        cumulativeHours: 15,
        cumulativeQuestions: 40,
      },
    ],
    ratings: [],
  },
  "api/tasks": { tasks: [] },

  /* ── Tracker ── */
  "api/tracker/subjects": [
    { subjectId: 1, subjectName: "Thermodynamics", importanceLevel: 5 },
    { subjectId: 2, subjectName: "Fluid Mechanics", importanceLevel: 5 },
    { subjectId: 3, subjectName: "Heat Transfer", importanceLevel: 4 },
    { subjectId: 4, subjectName: "Strength of Materials", importanceLevel: 4 },
    { subjectId: 5, subjectName: "Theory of Machines", importanceLevel: 3 },
  ],
  "api/tracker/ratings": [],

  /* ── Settings ── */
  "api/settings": {
    name: "Guest",
    ai: { provider: "openai", model: "gpt-4o-mini" },
  },
  "api/settings/ai": {
    provider: "openai",
    model: "gpt-4o-mini",
    providers: [
      { id: "openai", name: "OpenAI", models: ["gpt-4o-mini"] },
    ],
  },

  /* ── Chat / AI Coach ── */
  "api/routine/general-chat": null, // streaming handled specially

  /* ── Interview ── */
  "api/interview/history": [],
  "api/interview/questions": [],

  /* ── Explainer ── */
  "api/explainer/history": [],

  /* ── Journal ── */
  "api/journal": {
    entries: [
      {
        journalId: "demo-entry-1",
        date: new Date().toISOString().split("T")[0],
        entryText: "Demo Journal Entry: Focused on problem solving and revising core concepts today. Distractions were minimal and consistency was high.",
        mood: "4",
        tags: ["Study", "Exercise"],
        aiFeedback: "Great focus! Regular revision combined with problem solving ensures steady progress.",
        tomorrowTask: "Solve 20 practice questions on Thermodynamics and review formula notes.",
        patternDetected: "Consistent productivity when starting study sessions early.",
        studyDone: true,
        exerciseDone: true,
        readingDone: false,
      },
    ],
  },
  "api/journal-auth": { success: true },
};

/** Canned AI chat response for demo mode (non-streaming) */
export const DEMO_AI_RESPONSE = `Hello! 👋 You're exploring **DOOR** in demo mode.

In demo mode, AI features are limited — but you can still explore the full interface, navigate all pages, and see how everything is organized.

To unlock the full experience with real AI coaching, study plans, and progress tracking, enter the correct passcode at the login screen.`;

/** Generate a simple canned streaming response for demo mode */
export function createDemoStream(message: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = DEMO_AI_RESPONSE.split(" ");
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index < words.length) {
        const word = (index === 0 ? "" : " ") + words[index];
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: word })}\n\n`));
        index++;
        await new Promise((r) => setTimeout(r, 30));
      } else {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
