import { useState, useEffect, useRef } from 'react'
import { api, fmt } from '../utils/api'

// Simple bar chart using SVG
function BarChart({ data }) {
  if (!data || data.length === 0) return <div className="loading-center text-muted">No data</div>
  const max = Math.max(...data.map(d => d.sales), 1)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <svg viewBox={`0 0 ${data.length * 60} 200`} style={{ width: '100%', height: '100%' }}>
      {data.map((d, i) => {
        const barH = Math.max((d.sales / max) * 150, 2)
        const x = i * 60 + 10
        const label = new Date(d.date).toLocaleDateString('en-KE', { weekday: 'short' })
        return (
          <g key={i}>
            <rect x={x} y={155 - barH} width={40} height={barH}
              rx="4" fill={i === data.length - 1 ? '#2563eb' : '#bfdbfe'} />
            <text x={x + 20} y={172} textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>
            <text x={x + 20} y={150 - barH} textAnchor="middle" fontSize="8" fill="#64748b">
              {d.sales > 0 ? `${(d.sales / 1000).toFixed(0)}k` : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Donut chart using SVG
function DonutChart({ data }) {
  if (!data || data.length === 0) return <div className="loading-center text-muted">No data</div>
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16']
  const total = data.reduce((s, d) => s + parseFloat(d.total || 0), 0)
  let cumulative = 0
  const r = 60, cx = 70, cy = 70

  const segments = data.map((d, i) => {
    const value = parseFloat(d.total || 0)
    const pct = total > 0 ? value / total : 0
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2
    cumulative += pct
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const large = pct > 0.5 ? 1 : 0
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: colors[i % colors.length], name: d.product__category__name || 'Other', pct }
  })

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <svg viewBox="0 0 140 140" style={{ width: 140, flexShrink: 0 }}>
        {segments.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <circle cx={cx} cy={cy} r={38} fill="white" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fill="#64748b">Total</text>
        <text x={cx} y={cx + 8} textAnchor="middle" fontSize="9" fill="#1e293b" fontWeight="700">
          {fmt.currency(total).replace('KES ', '')}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        {segments.slice(0, 6).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--gray-600)', flex: 1 }}>{s.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{(s.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (!stats) return <div className="alert alert-danger">Failed to load dashboard.</div>

  const statCards = [
    { title: "Today's Sales", value: fmt.currency(stats.today_sales), icon: 'bi-currency-dollar', color: 'var(--primary)', sub: `${stats.today_transactions} transactions today` },
    { title: "Today's Profit", value: fmt.currency(stats.today_profit), icon: 'bi-graph-up-arrow', color: 'var(--success)', sub: 'Net profit after COGS' },
    { title: 'Monthly Revenue', value: fmt.currency(stats.monthly_sales), icon: 'bi-calendar-month', color: 'var(--warning)', sub: fmt.currency(stats.monthly_profit) + ' profit this month' },
    { title: 'Products', value: stats.total_products, icon: 'bi-capsule', color: 'var(--info)', sub: `${stats.low_stock_count} low stock · ${stats.expired_count} expired` },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your pharmacy at a glance — {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-5">
        {statCards.map((c, i) => (
          <div key={i} className="card stat-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="card-title">{c.title}</div>
                <div className="card-value" style={{ color: c.color }}>{c.value}</div>
                <div className="card-sub">{c.sub}</div>
              </div>
              <div style={{
                width: 44, height: 44, background: c.color + '18',
                borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: c.color, fontSize: 20
              }}>
                <i className={`bi ${c.icon}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2 mb-5">
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
            <i className="bi bi-bar-chart-line" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Sales — Last 7 Days
          </div>
          <div style={{ height: 200 }}>
            <BarChart data={stats.sales_chart} />
          </div>
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
            <i className="bi bi-pie-chart" style={{ color: 'var(--primary)', marginRight: 8 }} />
            Sales by Category (This Month)
          </div>
          <DonutChart data={stats.category_breakdown} />
        </div>
      </div>

      {/* Top selling + alerts */}
      <div className="grid-2">
        {/* Top selling products */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>
            <i className="bi bi-trophy" style={{ color: 'var(--warning)', marginRight: 8 }} />
            Top Selling Products (30 days)
          </div>
          {stats.top_products.length === 0 ? (
            <div className="text-muted text-sm">No sales data yet.</div>
          ) : (
            stats.top_products.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < stats.top_products.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                <div style={{
                  width: 28, height: 28, background: i < 3 ? 'var(--warning-light)' : 'var(--gray-100)',
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 12, color: i < 3 ? '#92400e' : 'var(--gray-500)'
                }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.product__name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.total_qty} units</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{fmt.currency(p.total_revenue)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <i className="bi bi-exclamation-triangle-fill" style={{ color: 'var(--danger)', fontSize: 18 }} />
              <span style={{ fontWeight: 700 }}>Low Stock Alert</span>
              <span className="badge badge-danger">{stats.low_stock_count}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {stats.low_stock_count} product(s) are at or below their reorder level.
            </p>
            <a href="/inventory" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
              View Inventory <i className="bi bi-arrow-right" />
            </a>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <i className="bi bi-calendar-x-fill" style={{ color: 'var(--warning)', fontSize: 18 }} />
              <span style={{ fontWeight: 700 }}>Expired Products</span>
              <span className="badge badge-warning">{stats.expired_count}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
              {stats.expired_count} product(s) have passed their expiry date and need attention.
            </p>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, var(--blue-600), var(--blue-800))', border: 'none' }}>
            <div style={{ color: 'white' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🇰🇪 M-Pesa Ready</div>
              <div style={{ fontSize: 13, opacity: .85 }}>Accept M-Pesa payments at POS. Safaricom Daraja integration included.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}