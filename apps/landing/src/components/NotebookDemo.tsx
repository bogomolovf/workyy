import { useState } from 'react'

type ScenarioId = 'revenue' | 'signups' | 'retention'

type SqlResultRow = {
  cohort: string
  metric: number
}

const SCENARIOS: Record<ScenarioId, { label: string; sql: string; python: string; rows: SqlResultRow[]; unit: string }> =
  {
    revenue: {
      label: 'Revenue by cohort',
      sql: 'SELECT cohort, SUM(revenue) AS sum_revenue FROM orders GROUP BY cohort;',
      python: "import seaborn as sns\nsns.lineplot(data=cohort_df, x='cohort', y='sum_revenue')",
      unit: '$',
      rows: [
        { cohort: 'Q1 2024', metric: 128000 },
        { cohort: 'Q2 2024', metric: 174500 },
        { cohort: 'Q3 2024', metric: 203200 },
      ],
    },
    signups: {
      label: 'Signups by plan',
      sql: "SELECT plan, COUNT(*) AS signups FROM accounts GROUP BY plan ORDER BY signups DESC;",
      python: "import seaborn as sns\nsns.barplot(data=plan_df, x='plan', y='signups')",
      unit: '',
      rows: [
        { cohort: 'Pro', metric: 420 },
        { cohort: 'Team', metric: 310 },
        { cohort: 'Free', metric: 190 },
      ],
    },
    retention: {
      label: 'Retention curve',
      sql: 'SELECT month, pct_active AS active_pct FROM retention_curve ORDER BY month;',
      python: "import seaborn as sns\nsns.lineplot(data=ret_df, x='month', y='active_pct')",
      unit: '%',
      rows: [
        { cohort: 'Month 1', metric: 100 },
        { cohort: 'Month 2', metric: 86 },
        { cohort: 'Month 3', metric: 79 },
      ],
    },
  }

export const NotebookDemo = () => {
  const [scenario, setScenario] = useState<ScenarioId>('revenue')
  const [sql, setSql] = useState(SCENARIOS.revenue.sql)
  const [python, setPython] = useState(SCENARIOS.revenue.python)
  const [sqlRan, setSqlRan] = useState(false)
  const [pyRan, setPyRan] = useState(false)

  const active = SCENARIOS[scenario]

  const handleRunSql = () => {
    setSqlRan(true)
  }

  const handleRunPython = () => {
    setPyRan(true)
  }

  const handleScenarioChange = (next: ScenarioId) => {
    if (next === scenario) return
    setScenario(next)
    setSql(SCENARIOS[next].sql)
    setPython(SCENARIOS[next].python)
    setSqlRan(false)
    setPyRan(false)
  }

  return (
    <div className="grid gap-3 lg:gap-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">Notebook demo</p>
        <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-bg-root)]/60 p-0.5">
          {(['revenue', 'signups', 'retention'] as ScenarioId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => handleScenarioChange(id)}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-smooth ${
                scenario === id
                  ? 'bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]'
              }`}
            >
              {SCENARIOS[id].label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-panel rounded-2xl p-4 border border-[var(--color-border)] shadow-theme-lg hero-parallax">
        <div className="flex items-center justify-between mb-2">
          <span className="board-tag text-xs">SQL cell</span>
          <button
            type="button"
            onClick={handleRunSql}
            className="text-[11px] px-2 py-1 rounded-md bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold hover:opacity-90 transition-smooth"
          >
            Run
          </button>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          className="w-full text-xs md:text-sm font-mono rounded-md bg-[var(--color-bg-root)]/80 border border-[var(--color-border)] text-[var(--color-text-primary)] p-2 resize-none min-h-[80px]"
        />
        {sqlRan && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 overflow-hidden">
            <div className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              Preview result
            </div>
            <table className="w-full text-xs">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th className="text-left px-3 py-1.5">{scenario === 'signups' ? 'plan' : 'cohort'}</th>
                  <th className="text-right px-3 py-1.5">
                    {scenario === 'revenue'
                      ? 'sum_revenue'
                      : scenario === 'signups'
                      ? 'signups'
                      : 'active_pct'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.rows.map((row) => (
                  <tr key={row.cohort} className="border-t border-[var(--color-border)]/60">
                    <td className="px-3 py-1.5">{row.cohort}</td>
                    <td className="px-3 py-1.5 text-right">
                      {active.unit === '$' && '$'}
                      {row.metric.toLocaleString()}
                      {active.unit === '%' && '%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface-panel rounded-2xl p-4 border border-[var(--color-border)] shadow-theme-lg hero-parallax-slow">
        <div className="flex items-center justify-between mb-2">
          <span className="board-tag text-xs">Python viz</span>
          <button
            type="button"
            onClick={handleRunPython}
            className="text-[11px] px-2 py-1 rounded-md bg-[var(--color-accent-secondary)] text-[var(--color-text-on-accent)] font-semibold hover:opacity-90 transition-smooth"
          >
            Run
          </button>
        </div>
        <textarea
          value={python}
          onChange={(e) => setPython(e.target.value)}
          className="w-full text-xs md:text-sm font-mono rounded-md bg-[var(--color-bg-root)]/80 border border-[var(--color-border)] text-[var(--color-text-primary)] p-2 resize-none min-h-[80px]"
        />
        {pyRan && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]/80 p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Chart preview</p>
            <div className="h-28 rounded-lg bg-gradient-to-r from-[var(--color-accent-primary)]/30 via-[var(--color-accent-secondary)]/25 to-[var(--color-accent-warm)]/30 flex items-center justify-center text-xs text-[var(--color-text-primary)] text-center px-3">
              {scenario === 'revenue' &&
                'Line chart of revenue by cohort – generated from the SQL result above.'}
              {scenario === 'signups' &&
                'Bar chart comparing signups by plan, highlighting which plans are driving growth.'}
              {scenario === 'retention' &&
                'Retention curve showing the percentage of active users over the first three months.'}
            </div>
          </div>
        )}
      </div>

      <div className="board-note text-xs md:text-sm">
        Both cells are mock-backed in the browser: no real warehouse, but the flow matches how Workyy runs SQL and Python
        side by side on one canvas. Switch scenarios to see how one board can tell very different stories.
      </div>
    </div>
  )
}


