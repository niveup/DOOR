from pathlib import Path

path=Path('frontend/components/AiMarkdown.tsx')
text=path.read_text(encoding='utf-8-sig')
replacements=[
('''function QuizComponent({ code }: { code: string }) {
  interface Question {''','''function QuizComponent({ code }: { code: string }) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  interface Question {'''),
('''
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});

  return (
    <div className="my-6 flex flex-col gap-5">''','''
  return (
    <div className="my-6 flex flex-col gap-5">'''),
('''function FlashcardsComponent({ code }: { code: string }) {
  interface Card {''','''function FlashcardsComponent({ code }: { code: string }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  interface Card {'''),
('''
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  return (
    <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4">''','''
  return (
    <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4">'''),
('''function InterviewQuestionsComponent({ code }: { code: string }) {
  interface QAPair {''','''function InterviewQuestionsComponent({ code }: { code: string }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  interface QAPair {'''),
('''
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="my-5 flex flex-col gap-3">''','''
  return (
    <div className="my-5 flex flex-col gap-3">'''),
('let minVal = Math.min(...allValues, 0);','const minVal = Math.min(...allValues, 0);'),
]
for old,new in replacements:
    if text.count(old)!=1: raise SystemExit(f'Expected one renderer match, found {text.count(old)} for {old[:45]!r}')
    text=text.replace(old,new,1)
path.write_text(text,encoding='utf-8')
