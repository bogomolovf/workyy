/**
 * Animated feature-card demos for the FeatureGrid section.
 * Each demo is self-contained, loops seamlessly, and respects prefers-reduced-motion.
 * Style: whiteboard UI (light bg, soft corners, thin borders, 180px fixed height).
 */

import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

/* ───────── shared utilities ───────── */

function useReduceMotion() {
  const [rm, setRm] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setRm(mq.matches);
    const h = () => setRm(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return rm;
}

function DemoContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        height: 180,
        background: '#fafbfc',
        borderBottom: '1px solid var(--border-light)',
        borderRadius: 'var(--r-md) var(--r-md) 0 0',
        padding: 12,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════
   1. DRAWING  — "Workyy" write + erase
   Total cycle ≈ 7 s
   ═══════════════════════════════════════ */

function DrawingDemo() {
  const rm = useReduceMotion();
  return (
    <DemoContainer>
      {!rm && (
        <style>{`
          @keyframes fdText{
            0%,5%{clip-path:inset(0 100% 0 0);opacity:1}
            38%{clip-path:inset(0 0 0 0);opacity:1}
            48%{clip-path:inset(0 0 0 0);opacity:1}
            78%{clip-path:inset(0 0 0 100%);opacity:1}
            79%{opacity:0}89%,100%{clip-path:inset(0 100% 0 0);opacity:0}
          }
          @keyframes fdPen{
            0%,4%{left:12%;opacity:0}5%{left:12%;opacity:1}
            38%{left:84%;opacity:1}39%,100%{opacity:0}
          }
          @keyframes fdEraser{
            0%,47%{left:12%;opacity:0}48%{left:12%;opacity:1}
            78%{left:84%;opacity:1}79%,100%{opacity:0}
          }
        `}</style>
      )}
      <div className="relative w-full h-full flex items-center justify-center">
        <div style={rm ? {} : { animation: 'fdText 7s ease-in-out infinite' }}>
          <span
            className="text-[var(--text)]"
            style={{
              fontFamily: "'Georgia', serif",
              fontStyle: 'italic',
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '0.02em',
              transform: 'rotate(-1.5deg)',
              display: 'inline-block',
            }}
          >
            Workyy
          </span>
        </div>
        {!rm && (
          <>
            {/* Pen dot */}
            <div
              className="absolute"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                animation: 'fdPen 7s ease-in-out infinite',
                width: 7,
                height: 7,
                background: 'var(--accent-cyan)',
                borderRadius: '50%',
                boxShadow: '0 0 6px var(--accent-cyan)',
              }}
            />
            {/* Eraser block */}
            <div
              className="absolute"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                animation: 'fdEraser 7s ease-in-out infinite',
                width: 16,
                height: 22,
                background: '#f0f0f0',
                border: '1.5px solid #ccc',
                borderRadius: 3,
              }}
            />
          </>
        )}
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   2. AUDIO  — REC + waveform + timer
   Cycle ≈ 6 s (5 s record + 1 s reset)
   ═══════════════════════════════════════ */

const BAR_MAX = [30, 50, 70, 40, 80, 55, 25, 65, 45, 35, 75, 85, 50, 30, 60, 45, 80, 35, 55, 25];

function AudioDemo() {
  const rm = useReduceMotion();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (rm) return;
    const iv = setInterval(() => setElapsed((e) => (e >= 5000 ? 0 : e + 100)), 100);
    return () => clearInterval(iv);
  }, [rm]);

  const secs = Math.floor(elapsed / 1000);
  const tenths = Math.floor((elapsed % 1000) / 100);
  const timer = `00:0${secs}.${tenths}`;

  return (
    <DemoContainer>
      {!rm && (
        <style>{`
          @keyframes recPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.88)}}
          @keyframes wvBar{0%,100%{transform:scaleY(.15)}50%{transform:scaleY(1)}}
        `}</style>
      )}
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full bg-red-500"
            style={rm ? {} : { animation: 'recPulse 1.2s ease-in-out infinite' }}
          />
          <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wide">
            REC
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)] ml-1">
            {rm ? '00:03.0' : timer}
          </span>
        </div>
        {/* Waveform */}
        <div className="flex items-end gap-[2px] h-10">
          {BAR_MAX.map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-sm bg-[var(--accent-cyan)]"
              style={{
                height: rm ? h * 0.35 : h * 0.5,
                transformOrigin: 'bottom',
                animation: rm ? 'none' : `wvBar ${0.4 + (i % 5) * 0.1}s ease-in-out infinite`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
        {/* Stop button */}
        <div className="w-7 h-7 rounded-full border-2 border-[var(--text-muted)] flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-sm bg-[var(--text-muted)]" />
        </div>
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   3. AI  — type question → AI answers
   Cycle ≈ 7 s
   ═══════════════════════════════════════ */

function AiDemo() {
  const { content } = useLanguage();
  const rm = useReduceMotion();
  const d = content.home.featureCardDemos;
  const question = d.aiQuestion;
  const answer = d.aiAnswer;

  // Phases: 0=idle 1=typing-q 2=sent 3=thinking 4=typing-a 5=pause
  const [ph, setPh] = useState(0);
  const [qC, setQC] = useState(0);
  const [aC, setAC] = useState(0);

  useEffect(() => {
    if (rm) {
      setPh(5);
      setQC(question.length);
      setAC(answer.length);
      return;
    }
    if (ph === 0) {
      const t = setTimeout(() => {
        setPh(1);
        setQC(0);
      }, 500);
      return () => clearTimeout(t);
    }
    if (ph === 1) {
      if (qC < question.length) {
        const t = setTimeout(() => setQC((c) => c + 1), 50 + (qC % 3) * 12);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPh(2), 350);
      return () => clearTimeout(t);
    }
    if (ph === 2) {
      const t = setTimeout(() => setPh(3), 400);
      return () => clearTimeout(t);
    }
    if (ph === 3) {
      const t = setTimeout(() => {
        setPh(4);
        setAC(0);
      }, 1100);
      return () => clearTimeout(t);
    }
    if (ph === 4) {
      if (aC < answer.length) {
        const t = setTimeout(() => setAC((c) => c + 1), 65);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPh(5), 500);
      return () => clearTimeout(t);
    }
    if (ph === 5) {
      const t = setTimeout(() => {
        setPh(0);
        setQC(0);
        setAC(0);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [ph, qC, aC, question, answer, rm]);

  return (
    <DemoContainer>
      <style>{`@keyframes blinkCur{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <div className="w-full h-full flex flex-col justify-end gap-1.5" style={{ fontSize: 11 }}>
        <div className="flex-1 flex flex-col justify-end gap-1.5 overflow-hidden min-h-0">
          {/* User bubble */}
          {ph >= 1 && qC > 0 && (
            <div className="self-end max-w-[82%] px-2.5 py-1.5 rounded-lg bg-[var(--accent-blue)]/15 text-[var(--text)] break-words">
              {question.slice(0, qC)}
              {ph === 1 && qC < question.length && (
                <span style={{ animation: 'blinkCur 0.7s step-end infinite' }}>|</span>
              )}
            </div>
          )}
          {/* AI thinking */}
          {ph === 3 && (
            <div className="self-start max-w-[70%] px-2.5 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text-muted)] tracking-widest">
              …
            </div>
          )}
          {/* AI answer */}
          {ph >= 4 && aC > 0 && (
            <div className="self-start max-w-[70%] px-2.5 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] font-medium">
              {answer.slice(0, aC)}
            </div>
          )}
        </div>
        {/* Input bar */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-light)] bg-white">
          <span className="flex-1 text-[var(--text-muted)] text-[10px] truncate">
            {ph === 0 && (
              <span style={{ animation: rm ? 'none' : 'blinkCur 1s step-end infinite' }}>|</span>
            )}
          </span>
          <div className="w-4 h-4 rounded-full bg-[var(--accent-blue)]/25 flex items-center justify-center">
            <span className="text-[7px] text-[var(--accent-blue)]">▶</span>
          </div>
        </div>
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   4. COLLAB  — two cursors, paths + bump
   Cycle ≈ 8 s
   ═══════════════════════════════════════ */

function CollabDemo() {
  const { content } = useLanguage();
  const rm = useReduceMotion();
  const d = content.home.featureCardDemos;

  return (
    <DemoContainer>
      {!rm && (
        <style>{`
          @keyframes c1{
            0%{transform:translate(16px,28px)}
            12%{transform:translate(100px,20px)}
            25%{transform:translate(160px,60px)}
            37%{transform:translate(90px,95px)}
            48%{transform:translate(88px,62px) scale(1.08)}
            52%{transform:translate(70px,42px)}
            65%{transform:translate(35px,85px)}
            78%{transform:translate(130px,36px)}
            90%{transform:translate(50px,50px)}
            100%{transform:translate(16px,28px)}
          }
          @keyframes c2{
            0%{transform:translate(170px,95px)}
            12%{transform:translate(90px,105px)}
            25%{transform:translate(28px,45px)}
            37%{transform:translate(105px,25px)}
            48%{transform:translate(100px,62px) scale(1.08)}
            52%{transform:translate(130px,95px)}
            65%{transform:translate(160px,32px)}
            78%{transform:translate(55px,85px)}
            90%{transform:translate(145px,70px)}
            100%{transform:translate(170px,95px)}
          }
        `}</style>
      )}
      {/* Faint board grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(var(--border-light) 1px, transparent 1px), linear-gradient(90deg, var(--border-light) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.5,
        }}
      />
      <div className="relative w-full h-full">
        {/* Cursor 1 — red */}
        <div
          className="absolute flex items-start gap-0.5"
          style={
            rm
              ? { left: 55, top: 45 }
              : { left: 0, top: 0, animation: 'c1 8s cubic-bezier(.4,0,.6,1) infinite' }
          }
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none" aria-hidden>
            <path d="M0 0L12 10L5 10L2 16L0 0Z" fill="#ef4444" />
          </svg>
          <span className="text-[8px] font-semibold text-white bg-red-500 px-1 py-[1px] rounded leading-none mt-2">
            {d.collabUser1}
          </span>
        </div>
        {/* Cursor 2 — blue */}
        <div
          className="absolute flex items-start gap-0.5"
          style={
            rm
              ? { left: 135, top: 80 }
              : { left: 0, top: 0, animation: 'c2 8s cubic-bezier(.4,0,.6,1) infinite' }
          }
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none" aria-hidden>
            <path d="M0 0L12 10L5 10L2 16L0 0Z" fill="#3b82f6" />
          </svg>
          <span className="text-[8px] font-semibold text-white bg-blue-500 px-1 py-[1px] rounded leading-none mt-2">
            {d.collabUser2}
          </span>
        </div>
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   5. FILES  — upload → slides preview
   Cycle ≈ 7 s
   ═══════════════════════════════════════ */

function FilesDemo() {
  const { content } = useLanguage();
  const rm = useReduceMotion();
  const fileName = content.home.featureCardDemos.filesName;

  // Stages: 0=appear 1=uploading 2=preview 3=close
  const [st, setSt] = useState(0);
  const [prog, setProg] = useState(0);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (rm) {
      setSt(2);
      setProg(100);
      return;
    }

    if (st === 0) {
      setProg(0);
      setSlide(0);
      const t = setTimeout(() => setSt(1), 400);
      return () => clearTimeout(t);
    }
    if (st === 1) {
      if (prog < 100) {
        const t = setTimeout(() => setProg((p) => Math.min(100, p + 4)), 50);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setSt(2), 300);
      return () => clearTimeout(t);
    }
    if (st === 2) {
      if (slide < 3) {
        const t = setTimeout(() => setSlide((i) => i + 1), 800);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setSt(3), 600);
      return () => clearTimeout(t);
    }
    if (st === 3) {
      const t = setTimeout(() => setSt(0), 600);
      return () => clearTimeout(t);
    }
  }, [st, prog, slide, rm]);

  const slides = [
    <div key={0} className="w-full h-full bg-white flex flex-col items-center justify-center gap-1">
      <div className="w-10 h-7 rounded bg-[var(--accent-blue)]/15" />
      <div className="text-[8px] text-[var(--text-muted)] font-medium">Penguins</div>
    </div>,
    <div key={1} className="w-full h-full bg-[#e8f4fd] flex items-end justify-center gap-1 pb-2">
      <div
        className="w-3 h-4"
        style={{ clipPath: 'polygon(50% 0%,0% 100%,100% 100%)', background: '#b8d8eb' }}
      />
      <div
        className="w-5 h-7"
        style={{ clipPath: 'polygon(50% 0%,0% 100%,100% 100%)', background: '#95c0d8' }}
      />
      <div
        className="w-3 h-3"
        style={{ clipPath: 'polygon(50% 0%,0% 100%,100% 100%)', background: '#c8e0f0' }}
      />
    </div>,
    <div key={2} className="w-full h-full bg-white flex items-center justify-center gap-2">
      <div className="w-4 h-6 bg-[#1a1a2e] rounded-t-full" />
      <div className="w-4 h-6 bg-[#1a1a2e] rounded-t-full" />
      <div className="w-3 h-5 bg-[#2a2a4e] rounded-t-full" />
    </div>,
    <div key={3} className="w-full h-full bg-white flex items-end justify-center gap-1 p-2">
      <div className="w-3 h-3 bg-[var(--accent-cyan)] rounded-t-sm" />
      <div className="w-3 h-6 bg-[var(--accent-blue)] rounded-t-sm" />
      <div className="w-3 h-4 bg-[var(--accent-violet)] rounded-t-sm" />
      <div className="w-3 h-7 bg-[var(--accent-cyan)] rounded-t-sm" />
    </div>,
  ];

  return (
    <DemoContainer>
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        {/* File chip */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border-light)] bg-white w-[85%] max-w-[210px]">
          <div className="w-5 h-6 rounded-sm bg-[var(--accent-violet)]/20 flex items-center justify-center text-[7px] font-bold text-[var(--accent-violet)]">
            P
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--text)] truncate">{fileName}</div>
            {st === 1 && (
              <div className="h-1 bg-[var(--border)] rounded-full mt-0.5 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-cyan)] rounded-full transition-[width] duration-200"
                  style={{ width: `${prog}%` }}
                />
              </div>
            )}
          </div>
        </div>
        {/* Slide preview */}
        {st >= 2 && st < 3 && (
          <div
            className="w-[72%] max-w-[170px] aspect-[4/3] rounded-md border border-[var(--border-light)] overflow-hidden bg-white"
            style={{ transition: rm ? 'none' : 'transform 0.35s ease-out, opacity 0.35s ease-out' }}
          >
            <div
              className="w-full h-full flex"
              style={{
                transform: `translateX(-${slide * 100}%)`,
                transition: rm ? 'none' : 'transform 0.5s cubic-bezier(.4,0,.2,1)',
              }}
            >
              {slides.map((s, i) => (
                <div key={i} className="min-w-full h-full flex-shrink-0">
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   6. SQL  — upload .sp → code → table, loop
   Cycle ≈ 6 s
   ═══════════════════════════════════════ */

const SQL_LINES = [
  { kw: 'SELECT', rest: ' customer, SUM(amount)' },
  { kw: 'FROM', rest: ' orders' },
  { kw: 'WHERE', rest: " date > '2024-01';" },
];
const SQL_TABLE = [
  ['Acme', '42', '12.4k'],
  ['Beta', '31', '8.7k'],
  ['Gamma', '28', '7.1k'],
];

function SqlDemoLoop() {
  const { content } = useLanguage();
  const rm = useReduceMotion();
  const sqlFileName = content.home.featureCardDemos.sqlFileName;

  // Stages: 0=upload 1=code 2=table 3=pause
  const [st, setSt] = useState(0);
  const [prog, setProg] = useState(0);
  const [cLines, setCLines] = useState(0);
  const [tRows, setTRows] = useState(0);

  useEffect(() => {
    if (rm) {
      setSt(2);
      setProg(100);
      setCLines(3);
      setTRows(3);
      return;
    }

    if (st === 0) {
      if (prog < 100) {
        const t = setTimeout(() => setProg((p) => Math.min(100, p + 4)), 40);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        setSt(1);
        setCLines(0);
      }, 200);
      return () => clearTimeout(t);
    }
    if (st === 1) {
      if (cLines < 3) {
        const t = setTimeout(() => setCLines((n) => n + 1), 400);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        setSt(2);
        setTRows(0);
      }, 300);
      return () => clearTimeout(t);
    }
    if (st === 2) {
      if (tRows < 3) {
        const t = setTimeout(() => setTRows((n) => n + 1), 300);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setSt(3), 600);
      return () => clearTimeout(t);
    }
    if (st === 3) {
      const t = setTimeout(() => {
        setSt(0);
        setProg(0);
        setCLines(0);
        setTRows(0);
      }, 900);
      return () => clearTimeout(t);
    }
  }, [st, prog, cLines, tRows, rm]);

  return (
    <DemoContainer>
      <div className="w-full h-full flex flex-col gap-1.5 overflow-hidden">
        {/* Upload bar */}
        {st === 0 && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--border-light)] bg-white">
            <div className="w-5 h-6 rounded-sm bg-[var(--accent-cyan)]/20 flex items-center justify-center text-[7px] font-bold text-[var(--accent-cyan)]">
              SP
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-[var(--text)] truncate">{sqlFileName}</div>
              <div className="h-1 bg-[var(--border)] rounded-full mt-0.5 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-cyan)] rounded-full transition-[width] duration-150"
                  style={{ width: `${prog}%` }}
                />
              </div>
            </div>
          </div>
        )}
        {/* Code */}
        {st >= 1 && (
          <div className="px-2.5 py-1.5 rounded-md border border-[var(--border-light)] bg-white font-mono text-[10px] space-y-0.5">
            {SQL_LINES.map((ln, i) => (
              <div
                key={i}
                className="transition-all duration-300"
                style={{
                  opacity: i < cLines || rm ? 1 : 0,
                  transform: i < cLines || rm ? 'none' : 'translateY(4px)',
                }}
              >
                <span className="text-[var(--accent-cyan)]">{ln.kw}</span>
                <span className="text-[var(--text)]">{ln.rest}</span>
              </div>
            ))}
          </div>
        )}
        {/* Table */}
        {st >= 2 && (
          <div className="px-2.5 py-1 rounded-md border border-[var(--border-light)] bg-white font-mono text-[9px]">
            <div className="flex gap-3 border-b border-[var(--border)] pb-0.5 mb-0.5 font-semibold text-[var(--text-muted)]">
              <span className="w-14">customer</span>
              <span className="w-10">orders</span>
              <span className="w-10">revenue</span>
            </div>
            {SQL_TABLE.map((row, i) => (
              <div
                key={i}
                className="flex gap-3 text-[var(--text)] transition-all duration-300"
                style={{
                  opacity: i < tRows || rm ? 1 : 0,
                  transform: i < tRows || rm ? 'none' : 'translateY(4px)',
                }}
              >
                <span className="w-14">{row[0]}</span>
                <span className="w-10">{row[1]}</span>
                <span className="w-10">{row[2]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   7. PYTHON  — code cell + output table
   Cycle ≈ 8 s
   ═══════════════════════════════════════ */

const PY_LINES = [
  { cls: 'text-[var(--accent-blue)]', text: 'import' },
  { cls: 'text-[var(--text)]', text: ' pandas ' },
  { cls: 'text-[var(--accent-blue)]', text: 'as' },
  { cls: 'text-[var(--text)]', text: ' pd' },
];
const PY_LINE2 = 'df = pd.DataFrame({';
const PY_LINE3 = '  "col_a":[1,2,3], "col_b":[2,4,6]';
const PY_LINE4 = '})';
const PY_LINE5 = 'df.head()';
const PY_TABLE_HEAD = ['col_a', 'col_b'];
const PY_TABLE_ROWS = [
  ['1', '2'],
  ['2', '4'],
  ['3', '6'],
];

function PythonDemo() {
  const rm = useReduceMotion();
  // Stages: 0=appear 1=typing 2=run 3=output 4=pause 5=reset
  const [st, setSt] = useState(0);
  const [visLines, setVisLines] = useState(0);
  const [visRows, setVisRows] = useState(0);

  useEffect(() => {
    if (rm) {
      setSt(3);
      setVisLines(5);
      setVisRows(3);
      return;
    }

    if (st === 0) {
      setVisLines(0);
      setVisRows(0);
      const t = setTimeout(() => setSt(1), 400);
      return () => clearTimeout(t);
    }
    if (st === 1) {
      if (visLines < 5) {
        const t = setTimeout(() => setVisLines((n) => n + 1), 420);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setSt(2), 300);
      return () => clearTimeout(t);
    }
    if (st === 2) {
      const t = setTimeout(() => setSt(3), 400);
      return () => clearTimeout(t);
    }
    if (st === 3) {
      if (visRows < 3) {
        const t = setTimeout(() => setVisRows((n) => n + 1), 350);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setSt(4), 600);
      return () => clearTimeout(t);
    }
    if (st === 4) {
      const t = setTimeout(() => setSt(5), 600);
      return () => clearTimeout(t);
    }
    if (st === 5) {
      const t = setTimeout(() => setSt(0), 700);
      return () => clearTimeout(t);
    }
  }, [st, visLines, visRows, rm]);

  const codeLines = [
    <span key="l1">
      {PY_LINES.map((p, i) => (
        <span key={i} className={p.cls}>
          {p.text}
        </span>
      ))}
    </span>,
    <span key="l2" className="text-[var(--text)]">
      {PY_LINE2}
    </span>,
    <span key="l3" className="text-[var(--text)]">
      &nbsp;&nbsp;{PY_LINE3}
    </span>,
    <span key="l4" className="text-[var(--text)]">
      {PY_LINE4}
    </span>,
    <span key="l5" className="text-[var(--accent-blue)]">
      {PY_LINE5}
    </span>,
  ];

  return (
    <DemoContainer>
      <div
        className="w-full h-full flex flex-col gap-1 transition-opacity duration-500"
        style={{ opacity: st === 5 ? 0 : 1 }}
      >
        {/* Header badge */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
            Python
          </span>
          {st === 2 && (
            <span
              className="w-2.5 h-2.5 rounded-full border-2 border-[var(--accent-blue)] border-t-transparent"
              style={{ animation: 'spin .5s linear infinite' }}
            />
          )}
        </div>
        {/* Code block */}
        <div className="px-2 py-1.5 rounded-md border border-[var(--border-light)] bg-white font-mono text-[9px] leading-[14px] space-y-[1px] flex-shrink-0">
          {codeLines.map((line, i) => (
            <div
              key={i}
              className="transition-all duration-300"
              style={{
                opacity: i < visLines || rm ? 1 : 0,
                transform: i < visLines || rm ? 'none' : 'translateY(3px)',
              }}
            >
              <span className="text-[var(--text-muted)] select-none mr-1.5">{i + 1}</span>
              {line}
            </div>
          ))}
        </div>
        {/* Output */}
        {st >= 3 && (
          <div className="px-2 py-1 rounded-md border border-[var(--border-light)] bg-white font-mono text-[8px]">
            <div className="text-[7px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-0.5">
              Output
            </div>
            <div className="flex gap-4 border-b border-[var(--border)] pb-0.5 mb-0.5 font-semibold text-[var(--text-muted)]">
              {PY_TABLE_HEAD.map((h) => (
                <span key={h} className="w-8">
                  {h}
                </span>
              ))}
            </div>
            {PY_TABLE_ROWS.map((row, i) => (
              <div
                key={i}
                className="flex gap-4 text-[var(--text)] transition-all duration-300"
                style={{
                  opacity: i < visRows || rm ? 1 : 0,
                  transform: i < visRows || rm ? 'none' : 'translateY(3px)',
                }}
              >
                <span className="w-8">{row[0]}</span>
                <span className="w-8">{row[1]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   8. DB CONNECTIONS  — modal + tab switch
   Cycle ≈ 10 s
   ═══════════════════════════════════════ */

const DB_TYPES = [
  { label: 'PostgreSQL', port: '5432', host: 'localhost', db: 'analytics', user: 'admin' },
  { label: 'MySQL', port: '3306', host: 'db.workyy', db: 'main', user: 'root' },
  { label: 'Oracle', port: '1521', host: '127.0.0.1', db: 'orcl', user: 'sys' },
  { label: 'SQL Server', port: '1433', host: 'db.workyy', db: 'default', user: 'sa' },
  { label: 'ClickHouse', port: '8123', host: 'localhost', db: 'analytics', user: 'default' },
];

function DbConnectionsDemo() {
  const rm = useReduceMotion();
  // Stages: 0=appear, 1..5=db types, 6=test, 7=connected, 8=pause, 9=close
  const [st, setSt] = useState(0);

  useEffect(() => {
    if (rm) {
      setSt(1);
      return;
    }

    if (st === 0) {
      const t = setTimeout(() => setSt(1), 400);
      return () => clearTimeout(t);
    }
    if (st >= 1 && st <= 5) {
      const delay = st === 3 ? 1800 : 1400; // Linger a bit on Oracle (mid-point)
      const t = setTimeout(() => setSt(st + 1), delay);
      return () => clearTimeout(t);
    }
    if (st === 6) {
      const t = setTimeout(() => setSt(7), 700);
      return () => clearTimeout(t);
    }
    if (st === 7) {
      const t = setTimeout(() => setSt(8), 900);
      return () => clearTimeout(t);
    }
    if (st === 8) {
      const t = setTimeout(() => setSt(9), 500);
      return () => clearTimeout(t);
    }
    if (st === 9) {
      const t = setTimeout(() => setSt(0), 500);
      return () => clearTimeout(t);
    }
  }, [st, rm]);

  const activeIdx = st >= 1 && st <= 5 ? st - 1 : st >= 6 ? 4 : 0;
  const db = DB_TYPES[activeIdx];
  const showModal = st >= 1 && st <= 8;

  return (
    <DemoContainer>
      {showModal && (
        <div
          className="w-full h-full flex flex-col transition-all duration-300"
          style={{
            opacity: st === 0 || st === 9 ? 0 : 1,
            transform: st === 0 || st === 9 ? 'scale(0.97)' : 'scale(1)',
          }}
        >
          {/* Title */}
          <div className="text-[10px] font-semibold text-[var(--text)] mb-1.5">
            Database Connection
          </div>
          {/* DB type tabs */}
          <div className="flex gap-[3px] mb-2 flex-wrap">
            {DB_TYPES.map((d, i) => (
              <button
                key={d.label}
                type="button"
                className={`text-[7px] px-1.5 py-[2px] rounded-sm border transition-all duration-250 ${
                  i === activeIdx
                    ? 'bg-[var(--accent-cyan)]/20 border-[var(--accent-cyan)] text-[var(--accent-cyan)] font-semibold'
                    : 'bg-white border-[var(--border-light)] text-[var(--text-muted)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {/* Fields */}
          <div className="space-y-[3px] text-[8px] flex-1 min-h-0">
            {[
              ['Host', db.host],
              ['Port', db.port],
              ['Database', db.db],
              ['Username', db.user],
              ['Password', '••••••'],
            ].map(([lbl, val]) => (
              <div key={lbl} className="flex items-center gap-1.5">
                <span className="w-14 text-[var(--text-muted)] text-right flex-shrink-0">
                  {lbl}
                </span>
                <div className="flex-1 px-1.5 py-[2px] rounded border border-[var(--border-light)] bg-white text-[var(--text)] font-mono truncate transition-all duration-300">
                  {val}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-14" />
              <div className="flex items-center gap-1 text-[7px] text-[var(--text-muted)]">
                <div className="w-2.5 h-2.5 rounded-sm border border-[var(--border-light)] bg-white" />
                Enable SSL
              </div>
            </div>
          </div>
          {/* Bottom buttons */}
          <div className="flex justify-end gap-1.5 mt-1.5 pt-1 border-t border-[var(--border-light)]">
            <span className="text-[7px] px-2 py-[2px] rounded border border-[var(--border-light)] text-[var(--text-muted)]">
              Cancel
            </span>
            <span
              className={`text-[7px] px-2 py-[2px] rounded border transition-all duration-300 ${
                st === 6
                  ? 'border-[var(--accent-cyan)] text-[var(--accent-cyan)]'
                  : 'border-[var(--border-light)] text-[var(--text-muted)]'
              }`}
            >
              {st === 6 && (
                <span
                  className="inline-block w-2 h-2 rounded-full border border-[var(--accent-cyan)] border-t-transparent mr-0.5 align-middle"
                  style={{ animation: 'spin .5s linear infinite' }}
                />
              )}
              Test Connection
            </span>
            <span className="text-[7px] px-2 py-[2px] rounded bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-transparent">
              Save
            </span>
          </div>
          {/* Connected badge */}
          {st === 7 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-md bg-emerald-500/90 text-white text-[10px] font-semibold shadow-md">
              ✓ Connected
            </div>
          )}
        </div>
      )}
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   9. CHARTS  — dataset → bar/line/column/histogram
   Cycle ≈ 11 s
   ═══════════════════════════════════════ */

const CHART_TYPES = ['Bar', 'Line', 'Column', 'Histogram'] as const;
const CHART_VALS = [0.4, 0.7, 0.55, 0.85, 0.65, 0.45]; // normalized 0–1

function ChartsDemo() {
  const rm = useReduceMotion();
  // Stages: 0=dataset chip, 1=bar, 2=line, 3=column, 4=histogram, 5=pause
  const [st, setSt] = useState(0);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (rm) {
      setSt(1);
      setDrawn(true);
      return;
    }

    if (st === 0) {
      setDrawn(false);
      const t = setTimeout(() => setSt(1), 600);
      return () => clearTimeout(t);
    }
    if (st >= 1 && st <= 4) {
      setDrawn(false);
      const t1 = setTimeout(() => setDrawn(true), 100);
      const t2 = setTimeout(() => setSt(st < 4 ? st + 1 : 5), 2000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (st === 5) {
      const t = setTimeout(() => setSt(0), 600);
      return () => clearTimeout(t);
    }
  }, [st, rm]);

  const activeChart = st >= 1 && st <= 4 ? st - 1 : 0;
  const chartW = 180;
  const chartH = 80;
  const barW = 10;
  const gap = 5;

  return (
    <DemoContainer>
      <div className="w-full h-full flex flex-col gap-1.5">
        {/* Dataset chip + chart tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] px-1.5 py-[1px] rounded bg-emerald-500/15 text-emerald-600 font-medium">
              penguins.csv ✓
            </span>
            <span className="text-[7px] text-[var(--text-muted)]">124 rows · 6 cols</span>
          </div>
        </div>
        <div className="flex gap-[3px]">
          {CHART_TYPES.map((ct, i) => (
            <button
              key={ct}
              type="button"
              className={`text-[7px] px-1.5 py-[1px] rounded-sm border transition-all duration-250 ${
                i === activeChart
                  ? 'bg-[var(--accent-violet)]/20 border-[var(--accent-violet)] text-[var(--accent-violet)] font-semibold'
                  : 'bg-white border-[var(--border-light)] text-[var(--text-muted)]'
              }`}
            >
              {ct}
            </button>
          ))}
        </div>
        {/* Chart area */}
        <div className="flex-1 min-h-0 rounded-md border border-[var(--border-light)] bg-white p-2 flex items-end justify-center overflow-hidden">
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} className="block">
            {/* Faint grid lines */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={0}
                y1={chartH * (1 - f)}
                x2={chartW}
                y2={chartH * (1 - f)}
                stroke="var(--border-light)"
                strokeWidth={0.5}
              />
            ))}

            {/* Bar chart — horizontal bars */}
            {activeChart === 0 &&
              CHART_VALS.map((v, i) => (
                <rect
                  key={i}
                  x={0}
                  y={i * (barW + gap)}
                  width={drawn ? v * chartW * 0.9 : 0}
                  height={barW}
                  rx={2}
                  fill="var(--accent-cyan)"
                  opacity={0.8}
                  style={{
                    transition: rm ? 'none' : `width 0.8s cubic-bezier(.33,1,.68,1) ${i * 0.08}s`,
                  }}
                />
              ))}

            {/* Line chart */}
            {activeChart === 1 &&
              (() => {
                const pts = CHART_VALS.map(
                  (v, i) => `${(i / (CHART_VALS.length - 1)) * chartW},${chartH * (1 - v)}`,
                ).join(' ');
                const len = 300;
                return (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke="var(--accent-blue)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={len}
                    strokeDashoffset={drawn ? 0 : len}
                    style={{
                      transition: rm ? 'none' : `stroke-dashoffset 1.2s cubic-bezier(.33,1,.68,1)`,
                    }}
                  />
                );
              })()}

            {/* Column chart — vertical bars */}
            {activeChart === 2 &&
              CHART_VALS.map((v, i) => {
                const colW = 16;
                const colGap = (chartW - CHART_VALS.length * colW) / (CHART_VALS.length + 1);
                const x = colGap + i * (colW + colGap);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={drawn ? chartH * (1 - v) : chartH}
                    width={colW}
                    height={drawn ? chartH * v : 0}
                    rx={2}
                    fill="var(--accent-violet)"
                    opacity={0.8}
                    style={{
                      transition: rm
                        ? 'none'
                        : `y 0.7s cubic-bezier(.33,1,.68,1) ${i * 0.06}s, height 0.7s cubic-bezier(.33,1,.68,1) ${i * 0.06}s`,
                    }}
                  />
                );
              })}

            {/* Histogram — many narrow bins */}
            {activeChart === 3 &&
              (() => {
                const bins = [0.2, 0.35, 0.55, 0.8, 0.95, 0.7, 0.5, 0.6, 0.4, 0.25];
                const binW = chartW / bins.length - 1;
                return bins.map((v, i) => (
                  <rect
                    key={i}
                    x={i * (binW + 1)}
                    y={drawn ? chartH * (1 - v) : chartH}
                    width={binW}
                    height={drawn ? chartH * v : 0}
                    fill="var(--accent-deep)"
                    opacity={0.65}
                    style={{
                      transition: rm
                        ? 'none'
                        : `y 0.6s cubic-bezier(.33,1,.68,1) ${i * 0.04}s, height 0.6s cubic-bezier(.33,1,.68,1) ${i * 0.04}s`,
                    }}
                  />
                ));
              })()}
          </svg>
        </div>
      </div>
    </DemoContainer>
  );
}

/* ═══════════════════════════════════════
   Public CardDemo router
   ═══════════════════════════════════════ */

export type CardDemoType =
  | 'drawing'
  | 'audio'
  | 'ai'
  | 'collab'
  | 'files'
  | 'sql'
  | 'python'
  | 'db'
  | 'charts';

export function CardDemo({ type }: { type: CardDemoType }) {
  switch (type) {
    case 'drawing':
      return <DrawingDemo />;
    case 'audio':
      return <AudioDemo />;
    case 'ai':
      return <AiDemo />;
    case 'collab':
      return <CollabDemo />;
    case 'files':
      return <FilesDemo />;
    case 'sql':
      return <SqlDemoLoop />;
    case 'python':
      return <PythonDemo />;
    case 'db':
      return <DbConnectionsDemo />;
    case 'charts':
      return <ChartsDemo />;
  }
}
