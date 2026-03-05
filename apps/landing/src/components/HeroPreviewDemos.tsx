/**
 * Hero product preview demos. Python is the visual reference; SQL demo is card-sized, 3-stage.
 */

import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function useReduceMotion() {
  const [reduce, setReduce] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const h = () => setReduce(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduce;
}

/** Canonical demo container: matches Python card (border, radius, bg). */
function DemoFrame({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-solid)] text-left ${className}`}
    >
      {children}
    </div>
  );
}

/** Python demo — reference card. Header + code + output. */
export function PythonDemo() {
  const reduceMotion = useReduceMotion();
  const [showOutput, setShowOutput] = useState(false);
  useEffect(() => {
    if (reduceMotion) setShowOutput(true);
    else {
      const t = setTimeout(() => setShowOutput(true), 700);
      return () => clearTimeout(t);
    }
  }, [reduceMotion]);

  return (
    <DemoFrame>
      <div className="px-2 py-1.5 border-b border-[var(--border)] space-y-0.5">
        <div className="wy-code text-[10px] text-[var(--accent-blue)]">import pandas as pd</div>
        <div className="wy-code text-[10px] text-[var(--text-muted)]">df.head()</div>
      </div>
      <div
        className={`px-2 py-1.5 transition-all duration-500 ${
          showOutput ? 'opacity-100 max-h-16' : 'opacity-0 max-h-0 overflow-hidden'
        }`}
      >
        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
          Output
        </div>
        <pre className="wy-code text-[10px] text-[var(--text)]">
          {'   col_a  col_b\n0      1      2'}
        </pre>
      </div>
    </DemoFrame>
  );
}

const UPLOAD_DURATION_MS = 2000;
const PARSING_BRIEF_MS = 0;
const CODE_ANIMATION_MS = 1000;
const CODE_PAUSE_MS = 1000;
const RESULT_ANIMATION_MS = 3200;

/** SQL demo — card-sized, 3 stages: upload → code → result; ends on final state (no loop). */
export function SqlDemo() {
  const { content } = useLanguage();
  const reduceMotion = useReduceMotion();
  const sqlContent = content.home.heroPreview.sql;
  const uploadingLabel =
    (sqlContent as { uploadingLabel?: string }).uploadingLabel ?? 'Uploading file.ssv';
  const parsingLabel = (sqlContent as { parsingLabel?: string }).parsingLabel ?? 'Parsing…';

  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [progress, setProgress] = useState(0);
  const [codeVisible, setCodeVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setStage(3);
      setProgress(100);
      setCodeVisible(true);
      const t = setTimeout(() => setResultVisible(true), 100);
      return () => clearTimeout(t);
    }

    if (stage === 1) {
      setCodeVisible(false);
      setResultVisible(false);
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(100, (elapsed / UPLOAD_DURATION_MS) * 100);
        setProgress(p);
        if (p < 100) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const done = setTimeout(() => setStage(2), UPLOAD_DURATION_MS + PARSING_BRIEF_MS);
      return () => clearTimeout(done);
    }

    if (stage === 2) {
      setCodeVisible(true);
      const toResult = setTimeout(() => setStage(3), CODE_ANIMATION_MS + CODE_PAUSE_MS);
      return () => clearTimeout(toResult);
    }

    if (stage === 3) {
      const showResult = setTimeout(() => setResultVisible(true), 80);
      return () => clearTimeout(showResult);
    }
  }, [reduceMotion, stage]);

  return (
    <DemoFrame>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .sql-demo-reveal { animation: none !important; opacity: 1; }
          .sql-upload-line { transition: none !important; }
        }
        @keyframes sqlCodeReveal {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sqlResultReveal {
          0% { opacity: 0; transform: translateY(4px); }
          40% { opacity: 0.4; transform: translateY(2px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Stage 1: upload + progress + line + parsing */}
      {stage === 1 && (
        <div className="px-2 py-1.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-muted)]">📄</span>
            <span className="wy-code text-[10px] text-[var(--text)]">{uploadingLabel}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-cyan)] transition-[width] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="relative h-px bg-[var(--border)] overflow-hidden rounded-full">
            <div
              className="sql-upload-line absolute inset-y-0 left-0 bg-[var(--accent-cyan)] rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progress >= 100 && <p className="text-[9px] text-[var(--text-muted)]">{parsingLabel}</p>}
        </div>
      )}

      {/* Stage 2 & 3: SQL code */}
      {(stage === 2 || stage === 3) && (
        <>
          <div
            className={`px-2 py-1.5 border-b border-[var(--border)] ${reduceMotion ? '' : 'sql-demo-reveal'}`}
            style={
              reduceMotion
                ? {}
                : {
                    animation: codeVisible
                      ? `sqlCodeReveal ${CODE_ANIMATION_MS / 1000}s cubic-bezier(0.33, 1, 0.68, 1) forwards`
                      : 'none',
                    opacity: codeVisible ? 1 : 0,
                  }
            }
          >
            <pre className="wy-code text-[10px] text-[var(--text)] whitespace-pre-wrap">
              <span className="text-[var(--accent-cyan)]">SELECT</span> *{'\n'}
              <span className="text-[var(--accent-cyan)]">FROM</span> uploaded_data;
            </pre>
          </div>

          {stage === 3 && (
            <div
              className={`px-2 py-1.5 ${reduceMotion ? '' : 'sql-demo-reveal'}`}
              style={
                reduceMotion
                  ? {}
                  : {
                      animation: resultVisible
                        ? `sqlResultReveal ${RESULT_ANIMATION_MS / 1000}s cubic-bezier(0.22, 1, 0.36, 1) forwards`
                        : 'none',
                      opacity: resultVisible ? 1 : 0,
                    }
              }
            >
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">
                Result
              </div>
              <div className="wy-code text-[9px] text-[var(--text)] overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-0.5 pr-2 font-medium">id</th>
                      <th className="text-left py-0.5 pr-2 font-medium">customer</th>
                      <th className="text-left py-0.5 pr-2 font-medium">amount</th>
                      <th className="text-left py-0.5 font-medium">created_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]/50">
                      <td className="py-0.5 pr-2">1</td>
                      <td className="py-0.5 pr-2">Acme</td>
                      <td className="py-0.5 pr-2">120</td>
                      <td className="py-0.5">2024-01-15</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-2">2</td>
                      <td className="py-0.5 pr-2">Beta</td>
                      <td className="py-0.5 pr-2">85</td>
                      <td className="py-0.5">2024-01-16</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </DemoFrame>
  );
}
