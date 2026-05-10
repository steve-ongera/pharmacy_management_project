import { useState, useEffect, useCallback } from 'react'
import { api, fmt } from '../utils/api'
import * as XLSX from 'xlsx'

// ─── PDF generation (pure JS, no external lib needed) ────────────────────────
function generatePDF(sales, filters) {
  const { jsPDF } = window.jspdf || {}
  if (!jsPDF) {
    // fallback: print-friendly HTML in new tab
    const rows = sales.map(s => `
      <tr>
        <td>${s.receipt_number}</td>
        <td>${fmt.datetime(s.created_at)}</td>
        <td>${s.customer_name || '—'}</td>
        <td>${s.served_by_name || '—'}</td>
        <td style="text-transform:capitalize">${s.payment_method}</td>
        <td style="text-align:right">${fmt.currency(s.total_amount)}</td>
        <td><span style="padding:2px 8px;border-radius:12px;font-size:11px;background:${
          s.status === 'completed' ? '#dcfce7' : s.status === 'refunded' ? '#fef9c3' : '#fee2e2'
        };color:${
          s.status === 'completed' ? '#166534' : s.status === 'refunded' ? '#854d0e' : '#991b1b'
        }">${s.status}</span></td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Sales Report</title>
    <style>
      body{font-family:sans-serif;padding:24px;color:#111}
      h2{margin-bottom:4px}p{color:#666;margin-bottom:16px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#f1f5f9;padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0}
      td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
      @media print{button{display:none}}
    </style></head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer">🖨 Print / Save PDF</button>
    <h2>Sales Report</h2>
    <p>Generated ${new Date().toLocaleString('en-KE')} · ${sales.length} records</p>
    <table><thead><tr>
      <th>Receipt</th><th>Date</th><th>Customer</th><th>Served By</th><th>Payment</th><th>Total</th><th>Status</th>
    </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    return
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' },
  pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  refunded:  { bg: '#fef9c3', color: '#854d0e', label: 'Refunded' },
  cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: s.bg, color: s.color,
      letterSpacing: '0.3px', textTransform: 'capitalize',
    }}>{s.label}</span>
  )
}

function PaymentBadge({ method }) {
  const icons = { cash: '💵', mpesa: '📱', card: '💳', insurance: '🛡️' }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
      <span>{icons[method] || '💰'}</span>
      <span style={{ textTransform: 'capitalize' }}>{method === 'mpesa' ? 'M-Pesa' : method}</span>
    </span>
  )
}

// ─── Sale detail modal ────────────────────────────────────────────────────────
function SaleDetailModal({ slug, onClose }) {
  const [sale, setSale] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.sales.receipt(slug).then(d => { setSale(d); setLoading(false) })
  }, [slug])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Loading…
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>
                  {sale.receipt_number}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {fmt.datetime(sale.created_at)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusBadge status={sale.status} />
                <button onClick={onClose} style={{
                  background: '#f1f5f9', border: 'none', borderRadius: 8,
                  width: 32, height: 32, cursor: 'pointer', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
            </div>

            {/* Meta */}
            <div style={{
              padding: '16px 24px', display: 'grid',
              gridTemplateColumns: '1fr 1fr', gap: 12,
              borderBottom: '1px solid #f1f5f9',
            }}>
              {[
                ['Customer', sale.customer_name || 'Walk-in'],
                ['Served By', sale.served_by_name || '—'],
                ['Payment', sale.payment_method === 'mpesa' ? 'M-Pesa' : sale.payment_method],
                ['M-Pesa Ref', sale.mpesa_reference || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Items */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Items</div>
              {sale.items?.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: i < sale.items.length - 1 ? '1px solid #f8fafc' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.product_name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {item.quantity} × {fmt.currency(item.unit_price)}
                      {item.product_unit && ` · ${item.product_unit}`}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                    {fmt.currency(item.total_price)}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ padding: '16px 24px' }}>
              {[
                ['Subtotal', fmt.currency(sale.subtotal)],
                sale.discount > 0 && ['Discount', `-${fmt.currency(sale.discount)}`],
                sale.tax > 0 && ['Tax', fmt.currency(sale.tax)],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: '#64748b' }}>
                  <span>{label}</span><span>{val}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontWeight: 800, fontSize: 16, color: '#0f172a',
                padding: '10px 0', borderTop: '2px solid #e2e8f0', marginTop: 6,
              }}>
                <span>Total</span><span>{fmt.currency(sale.total_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginTop: 4 }}>
                <span>Amount Paid</span><span>{fmt.currency(sale.amount_paid)}</span>
              </div>
              {sale.change_given > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  <span>Change Given</span><span>{fmt.currency(sale.change_given)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Sales page ──────────────────────────────────────────────────────────
const PAGE_SIZE = 15

export default function Sales() {
  const [sales, setSales] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [payment, setPayment] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const totalPages = Math.ceil(count / PAGE_SIZE)

  const fetchSales = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const params = { page: pg, page_size: PAGE_SIZE }
      if (search)  params.search  = search
      if (status)  params.status  = status
      if (payment) params.payment_method = payment
      // date range passed as search or custom filter if backend supports it
      const data = await api.sales.list(params)
      setSales(data.results || data)
      setCount(data.count || (data.results || data).length)
    } finally { setLoading(false) }
  }, [search, status, payment, dateFrom, dateTo])

  useEffect(() => { setPage(1); fetchSales(1) }, [search, status, payment, dateFrom, dateTo])
  useEffect(() => { fetchSales(page) }, [page])

  // ── Export all matching records (up to 1000) ──────────────────────────────
  const fetchAllForExport = async () => {
    const params = { page: 1, page_size: 1000 }
    if (search)  params.search  = search
    if (status)  params.status  = status
    if (payment) params.payment_method = payment
    const data = await api.sales.list(params)
    return data.results || data
  }

  const exportXLSX = async () => {
    setExporting(true)
    try {
      const all = await fetchAllForExport()
      const rows = all.map(s => ({
        'Receipt No':    s.receipt_number,
        'Date':          fmt.datetime(s.created_at),
        'Customer':      s.customer_name || 'Walk-in',
        'Served By':     s.served_by_name || '',
        'Payment':       s.payment_method,
        'M-Pesa Ref':    s.mpesa_reference || '',
        'Subtotal':      parseFloat(s.subtotal),
        'Discount':      parseFloat(s.discount),
        'Tax':           parseFloat(s.tax),
        'Total (KES)':   parseFloat(s.total_amount),
        'Amount Paid':   parseFloat(s.amount_paid),
        'Change Given':  parseFloat(s.change_given),
        'Status':        s.status,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      // Column widths
      ws['!cols'] = [18,20,20,18,12,16,12,10,8,14,14,14,12].map(w => ({ wch: w }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sales')
      XLSX.writeFile(wb, `sales-report-${new Date().toISOString().slice(0,10)}.xlsx`)
    } finally { setExporting(false) }
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const all = await fetchAllForExport()
      generatePDF(all)
    } finally { setExporting(false) }
  }

  // ── Summary stats from current page ──────────────────────────────────────
  const pageTotal   = sales.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
  const completedN  = sales.filter(s => s.status === 'completed').length

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Sales</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {count.toLocaleString()} total records
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportXLSX}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#16a34a', transition: 'all .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <span>📊</span> {exporting ? 'Exporting…' : 'Export XLSX'}
          </button>
          <button
            onClick={exportPDF}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#dc2626', transition: 'all .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}
          >
            <span>📄</span> {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* ── Quick stats ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'This Page Revenue', value: fmt.currency(pageTotal), icon: '💰', color: '#2563eb' },
          { label: 'Completed (page)',   value: completedN,              icon: '✅', color: '#16a34a' },
          { label: 'Total Records',      value: count.toLocaleString(),  icon: '🧾', color: '#7c3aed' },
          { label: 'Total Pages',        value: totalPages,              icon: '📑', color: '#0891b2' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', borderRadius: 12, padding: '14px 16px',
            border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: 12, padding: '14px 16px',
        border: '1px solid #f1f5f9', marginBottom: 16,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94a3b8' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Receipt, customer, M-Pesa ref…"
            style={{
              width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
              border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer', minWidth: 130 }}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Payment */}
        <select
          value={payment}
          onChange={e => setPayment(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer', minWidth: 130 }}
        >
          <option value="">All Payments</option>
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
          <option value="card">Card</option>
          <option value="insurance">Insurance</option>
        </select>

        {/* Date range */}
        <input
          type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer' }}
        />
        <span style={{ color: '#94a3b8', fontSize: 12 }}>to</span>
        <input
          type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer' }}
        />

        {/* Clear */}
        {(search || status || payment || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearch(''); setStatus(''); setPayment(''); setDateFrom(''); setDateTo('') }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 13, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: 12,
        border: '1px solid #f1f5f9', overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Receipt #', 'Date & Time', 'Customer', 'Served By', 'Payment', 'Total', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left', fontWeight: 700,
                    fontSize: 11, color: '#64748b', textTransform: 'uppercase',
                    letterSpacing: '0.5px', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} style={{ padding: '12px 14px' }}>
                        <div style={{
                          height: 14, borderRadius: 4,
                          background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.4s infinite',
                          width: j === 0 ? 120 : j === 5 ? 80 : '80%',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🧾</div>
                    No sales found
                  </td>
                </tr>
              ) : sales.map((sale, i) => (
                <tr
                  key={sale.id}
                  style={{
                    borderBottom: '1px solid #f8fafc',
                    background: i % 2 === 0 ? 'white' : '#fafafa',
                    transition: 'background .1s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                >
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                    {sale.receipt_number}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                    {fmt.datetime(sale.created_at)}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#334155' }}>
                    {sale.customer_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Walk-in</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#475569' }}>
                    {sale.served_by_name || '—'}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <PaymentBadge method={sale.payment_method} />
                  </td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    {fmt.currency(sale.total_amount)}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <StatusBadge status={sale.status} />
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      onClick={() => setSelectedSlug(sale.slug)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                        background: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        color: '#475569', transition: 'all .1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid #f1f5f9',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, count)} of {count}
            </div>

            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {/* Prev */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0',
                  background: page === 1 ? '#f8fafc' : 'white', fontSize: 13,
                  cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? '#cbd5e1' : '#334155',
                  fontWeight: 600,
                }}
              >‹ Prev</button>

              {/* Page numbers */}
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pg
                if (totalPages <= 7) pg = i + 1
                else if (page <= 4) pg = i + 1
                else if (page >= totalPages - 3) pg = totalPages - 6 + i
                else pg = page - 3 + i
                return pg
              }).map(pg => (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  style={{
                    padding: '6px 11px', borderRadius: 7, border: '1px solid',
                    borderColor: pg === page ? '#2563eb' : '#e2e8f0',
                    background: pg === page ? '#2563eb' : 'white',
                    color: pg === page ? 'white' : '#334155',
                    fontSize: 13, fontWeight: pg === page ? 700 : 500,
                    cursor: 'pointer', minWidth: 36,
                  }}
                >{pg}</button>
              ))}

              {/* Next */}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: '1px solid #e2e8f0',
                  background: page === totalPages ? '#f8fafc' : 'white', fontSize: 13,
                  cursor: page === totalPages ? 'default' : 'pointer',
                  color: page === totalPages ? '#cbd5e1' : '#334155', fontWeight: 600,
                }}
              >Next ›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────────── */}
      {selectedSlug && (
        <SaleDetailModal slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </div>
  )
}