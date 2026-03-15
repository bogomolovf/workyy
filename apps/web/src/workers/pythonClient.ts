import { wrap, Remote } from 'comlink';
import type { PythonWorkerApi } from './python.worker';

type WorkerEntry = {
  client: Remote<PythonWorkerApi>;
  worker: Worker;
  busy: boolean;
};

type PendingJob = {
  payload: Parameters<PythonWorkerApi['runPython']>[0];
  resolve: (value: Awaited<ReturnType<PythonWorkerApi['runPython']>>) => void;
  reject: (reason?: unknown) => void;
  timeoutMs: number;
};

const MAX_WORKERS =
  typeof navigator !== 'undefined'
    ? Math.max(1, Math.min(4, Math.floor(navigator.hardwareConcurrency / 2) || 2))
    : 2;

const workerEntries: WorkerEntry[] = [];
const jobQueue: PendingJob[] = [];

function createWorkerEntry(): WorkerEntry {
  const worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
  const client = wrap<PythonWorkerApi>(worker);
  return { worker, client, busy: false };
}

function getAvailableWorker(): WorkerEntry | null {
  let entry = workerEntries.find((worker) => !worker.busy) ?? null;
  if (!entry && workerEntries.length < MAX_WORKERS) {
    entry = createWorkerEntry();
    workerEntries.push(entry);
  }
  return entry;
}

function drainQueue() {
  if (!jobQueue.length) return;
  const entry = getAvailableWorker();
  if (!entry) return;

  const job = jobQueue.shift();
  if (!job) return;
  entry.busy = true;

  const timeoutId =
    typeof window !== 'undefined'
      ? window.setTimeout(() => {
          entry.busy = false;
          job.reject(new Error('Python execution timed out'));
          drainQueue();
        }, job.timeoutMs)
      : null;

  entry.client
    .runPython(job.payload)
    .then((result) => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      job.resolve(result);
    })
    .catch((error) => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      job.reject(error);
    })
    .finally(() => {
      entry.busy = false;
      drainQueue();
    });
}

export function runPythonInPool(
  payload: Parameters<PythonWorkerApi['runPython']>[0],
  options?: { timeoutMs?: number },
) {
  return new Promise<Awaited<ReturnType<PythonWorkerApi['runPython']>>>((resolve, reject) => {
    jobQueue.push({
      payload,
      resolve,
      reject,
      timeoutMs: options?.timeoutMs ?? 20000,
    });
    drainQueue();
  });
}

/**
 * Acquires a dedicated worker for sequential execution (e.g. notebook cells).
 * The worker stays locked until `release()` is called, ensuring all calls
 * share the same Python runtime state (variables, imports).
 */
export function acquireDedicatedWorker(): {
  runPython: (
    payload: Parameters<PythonWorkerApi['runPython']>[0],
    options?: { timeoutMs?: number },
  ) => Promise<Awaited<ReturnType<PythonWorkerApi['runPython']>>>;
  release: () => void;
} {
  let entry: WorkerEntry;
  const free = workerEntries.find((w) => !w.busy);
  if (free) {
    entry = free;
  } else if (workerEntries.length < MAX_WORKERS) {
    entry = createWorkerEntry();
    workerEntries.push(entry);
  } else {
    entry = createWorkerEntry();
    workerEntries.push(entry);
  }
  entry.busy = true;

  let released = false;
  return {
    runPython(payload, options) {
      if (released) return Promise.reject(new Error('Worker already released'));
      const timeoutMs = options?.timeoutMs ?? 120_000;
      return new Promise((resolve, reject) => {
        const timeoutId =
          typeof window !== 'undefined'
            ? window.setTimeout(() => reject(new Error('Python execution timed out')), timeoutMs)
            : null;

        entry.client
          .runPython(payload)
          .then((result) => {
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            reject(error);
          });
      });
    },
    release() {
      if (released) return;
      released = true;
      entry.busy = false;
      drainQueue();
    },
  };
}

export function disposePythonPool() {
  while (workerEntries.length > 0) {
    const entry = workerEntries.pop();
    entry?.worker.terminate();
  }
  jobQueue.splice(0, jobQueue.length);
}
