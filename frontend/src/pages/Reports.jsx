import { useState, useEffect, useCallback } from 'react'
import { api, fmt } from '../utils/api'
import * as XLSX from 'xlsx'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

// ─── Colour palette (matches main.css vars) ───────────────────────────────────
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const today      = () => new Date().toISOString().slice(0, 10)
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function shortDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })
}

function pct(a, b) {
  if (!b) return '0%'
  return ((a / b) * 100).toFixed(1) + '%'
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, currency = false }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--gray-900)', color: 'white', padding: '8px 12px',
      borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.25)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--gray-300)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--gray-300)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{currency ? fmt.currency(p.value) : p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ icon, title, subtitle }) {
  return (
    <div className="d-flex align-center gap-3 mb-4" style={{ marginTop: 8 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--primary-light)', color: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>{title}</div>
        {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
      </div>
    </div>
  )
}

// ─── Skeleton bar ─────────────────────────────────────────────────────────────
function Skeleton({ h = 14, w = '100%' }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 4,
      background: 'linear-gradient(90deg,var(--gray-100) 25%,var(--gray-200) 50%,var(--gray-100) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function Empty({ icon = 'bi-bar-chart', msg = 'No data for this period' }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>
      <i className={`bi ${icon}`} style={{ fontSize: 36, display: 'block', marginBottom: 8 }} />
      <div className="text-sm">{msg}</div>
    </div>
  )
}

// ─── XLSX export helper ───────────────────────────────────────────────────────
function exportSheet(rows, headers, sheetName, filename) {
  const ws = XLSX.utils.json_to_sheet(rows.map(r => {
    const obj = {}
    headers.forEach(([key, label]) => { obj[label] = r[key] ?? '' })
    return obj
  }))
  ws['!cols'] = headers.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const [tab, setTab] = useState('overview')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo]     = useState(today())

  // Data states
  const [salesData,    setSalesData]    = useState([])
  const [profitData,   setProfitData]   = useState([])
  const [topProducts,  setTopProducts]  = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [exporting,    setExporting]    = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const base = { start: dateFrom, end: dateTo }
      const [sales, profit, products, categories] = await Promise.all([
        api.reports({ ...base, type: 'sales' }),
        api.reports({ ...base, type: 'profit' }),
        api.reports({ ...base, type: 'top_products' }),
        api.reports({ ...base, type: 'category' }),
      ])
      setSalesData(sales)
      setProfitData(profit)
      setTopProducts(products)
      setCategoryData(categories)
    } finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived aggregates ──────────────────────────────────────────────────
  const totalRevenue    = salesData.reduce((s, r)  => s + parseFloat(r.total_sales  || 0), 0)
  const totalProfit     = profitData.reduce((s, r) => s + parseFloat(r.profit       || 0), 0)
  const totalTxn        = salesData.reduce((s, r)  => s + (r.transactions || 0), 0)
  const avgOrderValue   = totalTxn ? totalRevenue / totalTxn : 0
  const profitMarginPct = totalRevenue ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0

  // Merge sales + profit for combo chart
  const comboData = salesData.map(s => {
    const p = profitData.find(x =>
      x['sale__created_at__date'] === s['created_at__date'] ||
      x['sale__created_at__date'] === s.date
    )
    return {
      date:         shortDate(s['created_at__date'] || s.date),
      Revenue:      parseFloat(s.total_sales  || 0),
      Profit:       parseFloat(p?.profit       || 0),
      Transactions: s.transactions || 0,
    }
  })

  // Top 5 for pie chart
  const pieData = categoryData.slice(0, 6).map(c => ({
    name:  c['product__category__name'] || 'Uncategorised',
    value: parseFloat(c.total_revenue || 0),
  }))

  const tabs = [
    { id: 'overview',  label: 'Overview',      icon: 'bi-speedometer2' },
    { id: 'sales',     label: 'Sales Trend',   icon: 'bi-graph-up' },
    { id: 'products',  label: 'Top Products',  icon: 'bi-capsule' },
    { id: 'category',  label: 'Categories',    icon: 'bi-grid-3x3-gap' },
  ]

  // ── Quick-period presets ────────────────────────────────────────────────
  const applyPreset = (days) => {
    const end   = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days + 1)
    setDateFrom(start.toISOString().slice(0, 10))
    setDateTo(end.toISOString().slice(0, 10))
  }

  return (
    <div className="page-body">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>
            <i className="bi bi-bar-chart-line" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Reports &amp; Analytics
          </h1>
          <p>{fmt.date(dateFrom)} — {fmt.date(dateTo)}</p>
        </div>

        {/* Date range + presets */}
        <div className="d-flex align-center gap-2" style={{ flexWrap: 'wrap' }}>
          {[
            { label: '7d',   days: 7 },
            { label: '30d',  days: 30 },
            { label: '90d',  days: 90 },
          ].map(p => (
            <button key={p.days} className="btn btn-ghost btn-sm" onClick={() => applyPreset(p.days)}>
              {p.label}
            </button>
          ))}
          <input type="date" className="form-control" style={{ width: 'auto' }}
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-muted text-sm">–</span>
          <input type="date" className="form-control" style={{ width: 'auto' }}
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button className="btn btn-primary btn-sm" onClick={fetchAll} disabled={loading}>
            {loading
              ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Loading</>
              : <><i className="bi bi-arrow-clockwise" /> Refresh</>}
          </button>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid-4 mb-4">
        {[
          { icon: 'bi-cash-stack',       label: 'Total Revenue',    value: fmt.currency(totalRevenue),   cls: 'text-primary',  sub: `${totalTxn} transactions` },
          { icon: 'bi-graph-up-arrow',   label: 'Total Profit',     value: fmt.currency(totalProfit),    cls: 'text-success',  sub: `${profitMarginPct}% margin` },
          { icon: 'bi-receipt',          label: 'Avg Order Value',  value: fmt.currency(avgOrderValue),  cls: '',              sub: 'per transaction' },
          { icon: 'bi-grid-3x3-gap',     label: 'Categories',       value: categoryData.length,          cls: 'text-primary',  sub: 'with sales' },
        ].map(k => (
          <div key={k.label} className="card stat-card">
            <div className="card-title">
              <i className={`bi ${k.icon}`} style={{ marginRight: 5 }} />{k.label}
            </div>
            {loading
              ? <Skeleton h={28} w={120} />
              : <div className={`card-value ${k.cls}`}>{k.value}</div>
            }
            <div className="card-sub">{k.sub}</div>
            <i className={`bi ${k.icon} stat-icon`} />
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--gray-200)',
          overflowX: 'auto', padding: '0 4px',
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '13px 20px', border: 'none', background: 'none',
              cursor: 'pointer', fontWeight: tab === t.id ? 700 : 500,
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 7,
              color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, whiteSpace: 'nowrap', transition: 'all .15s',
            }}>
              <i className={`bi ${t.icon}`} />{t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ──────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div style={{ padding: 24 }}>
            <div className="grid-2" style={{ gap: 24 }}>

              {/* Revenue & Profit area chart */}
              <div>
                <SectionHead icon="bi-graph-up" title="Revenue vs Profit" subtitle="Daily trend for the period" />
                {loading ? <Skeleton h={220} /> : comboData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={comboData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip currency />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="Revenue" stroke="#2563eb" strokeWidth={2} fill="url(#gRev)" />
                      <Area type="monotone" dataKey="Profit"  stroke="#10b981" strokeWidth={2} fill="url(#gPro)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Category pie */}
              <div>
                <SectionHead icon="bi-pie-chart" title="Revenue by Category" subtitle="Share of total sales" />
                {loading ? <Skeleton h={220} /> : pieData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                        paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt.currency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Transactions bar */}
              <div>
                <SectionHead icon="bi-bar-chart" title="Daily Transactions" subtitle="Number of sales per day" />
                {loading ? <Skeleton h={200} /> : comboData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={comboData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Transactions" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top 5 products bar */}
              <div>
                <SectionHead icon="bi-trophy" title="Top 5 Products" subtitle="By revenue this period" />
                {loading ? <Skeleton h={200} /> : topProducts.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={topProducts.slice(0, 5).map(p => ({
                        name:    (p['product__name'] || '').slice(0, 14),
                        Revenue: parseFloat(p.total_revenue || 0),
                        Units:   p.total_qty || 0,
                      }))}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                      barSize={12}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-600)' }} width={90} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip currency />} />
                      <Bar dataKey="Revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Sales trend ───────────────────────────────────────── */}
        {tab === 'sales' && (
          <div style={{ padding: 24 }}>
            <div className="d-flex justify-between align-center mb-4">
              <SectionHead icon="bi-graph-up" title="Sales Trend" subtitle={`${salesData.length} data points`} />
              <button className="btn btn-outline btn-sm" disabled={exporting || loading}
                onClick={() => {
                  setExporting(true)
                  exportSheet(
                    salesData.map(r => ({ ...r, date: r['created_at__date'] || r.date })),
                    [['date','Date'],['total_sales','Revenue (KES)'],['transactions','Transactions']],
                    'Sales Trend', `sales-trend-${dateFrom}-${dateTo}.xlsx`
                  )
                  setExporting(false)
                }}>
                <i className="bi bi-file-earmark-spreadsheet" /> Export
              </button>
            </div>

            {/* Line chart */}
            {loading ? <Skeleton h={260} /> : comboData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={comboData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="txn" orientation="right" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="rev" type="monotone" dataKey="Revenue"      stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line yAxisId="rev" type="monotone" dataKey="Profit"       stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                  <Line yAxisId="txn" type="monotone" dataKey="Transactions" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Data table */}
            <div className="mt-4" style={{ marginTop: 24 }}>
              <div className="card-title mb-3" style={{ marginBottom: 10 }}>
                <i className="bi bi-table" style={{ marginRight: 6 }} />Daily Breakdown
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th><i className="bi bi-calendar3" style={{ marginRight: 4 }} />Date</th>
                      <th style={{ textAlign: 'right' }}><i className="bi bi-cash-stack" style={{ marginRight: 4 }} />Revenue</th>
                      <th style={{ textAlign: 'right' }}><i className="bi bi-graph-up-arrow" style={{ marginRight: 4 }} />Profit</th>
                      <th style={{ textAlign: 'right' }}><i className="bi bi-receipt" style={{ marginRight: 4 }} />Transactions</th>
                      <th style={{ textAlign: 'right' }}>Avg Order</th>
                      <th style={{ textAlign: 'right' }}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                            <td key={j}><Skeleton w={j === 0 ? 80 : 60} /></td>
                          ))}</tr>
                        ))
                      : comboData.length === 0
                        ? <tr><td colSpan={6}><Empty /></td></tr>
                        : comboData.map((row, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{row.date}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmt.currency(row.Revenue)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt.currency(row.Profit)}</td>
                            <td style={{ textAlign: 'right' }}>{row.Transactions}</td>
                            <td style={{ textAlign: 'right' }}>{fmt.currency(row.Transactions ? row.Revenue / row.Transactions : 0)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className={`badge ${row.Revenue > 0 && (row.Profit / row.Revenue) > 0.2 ? 'badge-success' : 'badge-warning'}`}>
                                {pct(row.Profit, row.Revenue)}
                              </span>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                  {!loading && comboData.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                        <td>Total</td>
                        <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmt.currency(totalRevenue)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>{fmt.currency(totalProfit)}</td>
                        <td style={{ textAlign: 'right' }}>{totalTxn}</td>
                        <td style={{ textAlign: 'right' }}>{fmt.currency(avgOrderValue)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge badge-primary">{profitMarginPct}%</span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Top Products ──────────────────────────────────────── */}
        {tab === 'products' && (
          <div style={{ padding: 24 }}>
            <div className="d-flex justify-between align-center mb-4">
              <SectionHead icon="bi-trophy" title="Top Products" subtitle="Ranked by revenue" />
              <button className="btn btn-outline btn-sm" disabled={exporting || loading}
                onClick={() => {
                  setExporting(true)
                  exportSheet(
                    topProducts,
                    [
                      ['product__name','Product'],
                      ['product__category__name','Category'],
                      ['total_qty','Units Sold'],
                      ['total_revenue','Revenue (KES)'],
                      ['total_profit','Profit (KES)'],
                    ],
                    'Top Products', `top-products-${dateFrom}-${dateTo}.xlsx`
                  )
                  setExporting(false)
                }}>
                <i className="bi bi-file-earmark-spreadsheet" /> Export
              </button>
            </div>

            {/* Horizontal bar chart */}
            {loading ? <Skeleton h={280} /> : topProducts.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={Math.max(280, topProducts.slice(0,10).length * 36)}>
                <BarChart
                  data={topProducts.slice(0, 10).map(p => ({
                    name:    p['product__name'] || '',
                    Revenue: parseFloat(p.total_revenue || 0),
                    Profit:  parseFloat(p.total_profit  || 0),
                    Units:   p.total_qty || 0,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                  barSize={10}
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip currency />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Profit"  fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Data table */}
            <div style={{ marginTop: 28 }}>
              <div className="card-title mb-3" style={{ marginBottom: 10 }}>
                <i className="bi bi-table" style={{ marginRight: 6 }} />Full Product Performance
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Units Sold</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Profit</th>
                      <th style={{ textAlign: 'right' }}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                            <td key={j}><Skeleton w={j === 1 ? 120 : 60} /></td>
                          ))}</tr>
                        ))
                      : topProducts.length === 0
                        ? <tr><td colSpan={7}><Empty icon="bi-capsule" msg="No product sales in this period" /></td></tr>
                        : topProducts.map((p, i) => {
                            const rev = parseFloat(p.total_revenue || 0)
                            const pro = parseFloat(p.total_profit  || 0)
                            return (
                              <tr key={i}>
                                <td style={{ color: 'var(--gray-400)', fontWeight: 700, width: 32 }}>{i + 1}</td>
                                <td style={{ fontWeight: 600 }}>{p['product__name']}</td>
                                <td>
                                  <span className="badge badge-gray">{p['product__category__name'] || '—'}</span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.total_qty}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmt.currency(rev)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{fmt.currency(pro)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <span className={`badge ${(pro/rev) > 0.2 ? 'badge-success' : (pro/rev) > 0 ? 'badge-warning' : 'badge-danger'}`}>
                                    {pct(pro, rev)}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Categories ────────────────────────────────────────── */}
        {tab === 'category' && (
          <div style={{ padding: 24 }}>
            <div className="d-flex justify-between align-center mb-4">
              <SectionHead icon="bi-grid-3x3-gap" title="Category Breakdown" subtitle="Revenue share by product category" />
              <button className="btn btn-outline btn-sm" disabled={exporting || loading}
                onClick={() => {
                  setExporting(true)
                  exportSheet(
                    categoryData,
                    [
                      ['product__category__name','Category'],
                      ['total_revenue','Revenue (KES)'],
                      ['total_qty','Units Sold'],
                    ],
                    'Categories', `categories-${dateFrom}-${dateTo}.xlsx`
                  )
                  setExporting(false)
                }}>
                <i className="bi bi-file-earmark-spreadsheet" /> Export
              </button>
            </div>

            <div className="grid-2" style={{ gap: 24, marginBottom: 28 }}>
              {/* Pie */}
              <div>
                <div className="card-title mb-3" style={{ marginBottom: 10 }}>Revenue Share</div>
                {loading ? <Skeleton h={260} /> : pieData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={100}
                        paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt.currency(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Stacked bar */}
              <div>
                <div className="card-title mb-3" style={{ marginBottom: 10 }}>Units Sold by Category</div>
                {loading ? <Skeleton h={260} /> : categoryData.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={categoryData.map(c => ({
                        name:  (c['product__category__name'] || 'Other').slice(0, 12),
                        Units: c.total_qty || 0,
                        Revenue: parseFloat(c.total_revenue || 0),
                      }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 30 }}
                      barSize={20}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Units" radius={[4, 4, 0, 0]}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Category table */}
            <div className="card-title mb-3" style={{ marginBottom: 10 }}>
              <i className="bi bi-table" style={{ marginRight: 6 }} />Category Details
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Units Sold</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Share</th>
                    <th>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                          <td key={j}><Skeleton w={j === 1 ? 100 : 60} /></td>
                        ))}</tr>
                      ))
                    : categoryData.length === 0
                      ? <tr><td colSpan={6}><Empty /></td></tr>
                      : categoryData.map((c, i) => {
                          const rev   = parseFloat(c.total_revenue || 0)
                          const share = totalRevenue ? (rev / totalRevenue) * 100 : 0
                          return (
                            <tr key={i}>
                              <td style={{ color: 'var(--gray-400)', fontWeight: 700, width: 32 }}>{i + 1}</td>
                              <td>
                                <div className="d-flex align-center gap-2">
                                  <span style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: COLORS[i % COLORS.length], display: 'inline-block', flexShrink: 0,
                                  }} />
                                  <span style={{ fontWeight: 600 }}>{c['product__category__name'] || 'Uncategorised'}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{c.total_qty}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmt.currency(rev)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="badge badge-primary">{share.toFixed(1)}%</span>
                              </td>
                              <td style={{ minWidth: 120 }}>
                                <div style={{
                                  height: 6, borderRadius: 3,
                                  background: 'var(--gray-100)', overflow: 'hidden',
                                }}>
                                  <div style={{
                                    height: '100%', borderRadius: 3,
                                    width: `${share}%`,
                                    background: COLORS[i % COLORS.length],
                                    transition: 'width .4s ease',
                                  }} />
                                </div>
                              </td>
                            </tr>
                          )
                        })
                  }
                </tbody>
                {!loading && categoryData.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                      <td colSpan={2}>Total</td>
                      <td style={{ textAlign: 'right' }}>
                        {categoryData.reduce((s, c) => s + (c.total_qty || 0), 0)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{fmt.currency(totalRevenue)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="badge badge-success">100%</span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .mt-4 { margin-top: 16px }
        tfoot td { padding: 10px 16px; font-size: 13px; border-top: 2px solid var(--gray-200); }
      `}</style>
    </div>
  )
}