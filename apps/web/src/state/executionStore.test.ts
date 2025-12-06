import { describe, it, expect, beforeEach } from 'vitest';
import { useExecutionStore } from './executionStore';

const pythonOutput = {
  kind: 'python' as const,
  code: "print('ok')",
  result: {
    stdout: 'plot ready',
    stderr: '',
    table: null,
    plotJson: '{"data":[]}',
  },
};

describe('executionStore', () => {
  beforeEach(() => {
    useExecutionStore.setState({ entries: {} });
  });

  it('removes execution entry when node is deleted and allows clean re-registration', () => {
    const store = useExecutionStore.getState();
    store.registerNode({ id: 'node-1', type: 'python', payload: { python: '' } });
    store.setSuccess('node-1', pythonOutput);

    expect(useExecutionStore.getState().entries['node-1']?.output).toBeDefined();

    store.removeNode('node-1');
    expect(useExecutionStore.getState().entries['node-1']).toBeUndefined();

    store.registerNode({ id: 'node-1', type: 'python', payload: { python: '' } });
    expect(useExecutionStore.getState().entries['node-1']?.output).toBeUndefined();
    expect(useExecutionStore.getState().entries['node-1']?.status).toBe('idle');
  });

  it('resets output without touching code before a rerun', () => {
    const store = useExecutionStore.getState();
    store.registerNode({ id: 'node-2', type: 'python', payload: { python: '' } });
    store.setCode('node-2', "print('fresh')");
    store.setSuccess('node-2', pythonOutput);

    store.resetOutput('node-2');
    const entry = useExecutionStore.getState().entries['node-2'];
    expect(entry?.code).toBe("print('fresh')");
    expect(entry?.output?.kind).toBe('python');
    expect(entry?.output?.result.stdout).toBe('');
    expect(entry?.output?.result.table).toBeNull();
    expect(entry?.status).toBe('idle');
    expect(entry?.hiddenOutputs).toEqual({ error: false, warnings: false });

    store.setStatus('node-2', 'running');
    expect(useExecutionStore.getState().entries['node-2']?.output).toBeUndefined();
  });

  it('allows dismissing errors and warnings while showing new ones', () => {
    const store = useExecutionStore.getState();
    store.registerNode({ id: 'node-3', type: 'python', payload: { python: '' } });
    store.setError('node-3', 'boom');
    store.dismissError('node-3');
    expect(useExecutionStore.getState().entries['node-3']?.hiddenOutputs?.error).toBe(true);
    store.setError('node-3', 'boom again');
    expect(useExecutionStore.getState().entries['node-3']?.hiddenOutputs?.error).toBe(false);

    store.setSuccess('node-3', {
      ...pythonOutput,
      result: {
        ...pythonOutput.result,
        stderr: 'warning',
      },
    });
    store.dismissWarnings('node-3');
    expect(useExecutionStore.getState().entries['node-3']?.hiddenOutputs?.warnings).toBe(true);
    store.setSuccess('node-3', pythonOutput);
    expect(useExecutionStore.getState().entries['node-3']?.hiddenOutputs?.warnings).toBe(false);
  });
});
