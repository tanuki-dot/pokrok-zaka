import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LEVELS, weeklyLevels, type Point } from '../lib/analysis'
import { fmtShort } from '../lib/dates'

/**
 * Graf jedné dovednosti po týdnech. Škála je obrácená (1 = nejvyšší zvládnutí),
 * proto je osa Y převrácená: zlepšení jde nahoru.
 */
export function ProgressChart({ points, height = 220, color = 'var(--color-sea-500)' }: { points: Point[]; height?: number; color?: string }) {
  const data = weeklyLevels(points).map((p, i) => ({ x: `${i + 1}. týden`, week: p.week, level: p.level }))
  if (data.length === 0) return <p className="py-10 text-center text-sm text-ink-faint">Pro tuto dovednost zatím nejsou záznamy.</p>
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -18 }}>
          <ReferenceArea y1={1} y2={2} fill="var(--color-lv1)" fillOpacity={0.06} />
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="week" tickFormatter={(w: string) => fmtShort(w)} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
          <YAxis reversed domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--color-ink-faint)' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`${v} – ${LEVELS[Number(v) - 1]?.text ?? ''}`, 'Úroveň']}
            labelFormatter={(w) => `Týden od ${fmtShort(String(w))}`}
            contentStyle={{ borderRadius: 12, border: '1px solid var(--color-line)', fontSize: 13 }}
          />
          <Line
            type="monotone"
            dataKey="level"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#fff', stroke: color, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Miniaturní průběh pro tabulky. */
export function Spark({ points }: { points: Point[] }) {
  const w = weeklyLevels(points).slice(-8)
  if (w.length < 2) return null
  const W = 64
  const H = 22
  const xs = (i: number) => (i / (w.length - 1)) * (W - 4) + 2
  const ys = (l: number) => ((l - 1) / 4) * (H - 4) + 2 // 1 nahoře
  const d = w.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.level).toFixed(1)}`).join(' ')
  const last = w[w.length - 1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke="var(--color-sea-500)" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={xs(w.length - 1)} cy={ys(last.level)} r={2.6} fill={`var(--color-lv${last.level})`} />
    </svg>
  )
}
