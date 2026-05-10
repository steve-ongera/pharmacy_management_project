import { useState, useEffect, useCallback } from 'react'
import { api, fmt } from '../utils/api'
import * as XLSX from 'xlsx'

// ─── PDF export (print-ready HTML tab) ───────────────────────────────────────
function generatePDF(sales) {
  const rows = sales.map(s => `
    <tr>
      <td>${s.receipt_number}</td>
      <td>${fmt.datetime(s.created_at)}</td>
      <td>${s.customer_name || 'Walk-in'}</td>
      <td>${s.served_by_name || '—'}</td>
      <td style="text-transform:capitalize">${s.payment_method === 'mpesa' ? 'M-Pesa' : s.payment_method}</td>
      <td style="text-align:right">${fmt.currency(s.total_amount)}</td>
      <td>
        <span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;
          background:${s.status==='completed'?'#d1fae5':s.status==='refunded'?'#fef3c7':'#fee2e2'};
          color:${s.status==='completed'?'#065f46':s.status==='refunded'?'#92400e':'#991b1b'}">
          ${s.status.charAt(0).toUpperCase()+s.status.slice(1)}
        </span>
      </td>
    </tr>`).join('')

  const totalRevenue = sales.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sales Report</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;padding:32px;color:#1e293b;font-size:13px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0}
    .logo{font-size:20px;font-weight:800;color:#2563eb}
    .meta{text-align:right;color:#64748b;font-size:12px}
    .stats{display:flex;gap:24px;margin-bottom:20px}
    .stat{background:#f8fafc;border-radius:8px;padding:12px 20px;border:1px solid #e2e8f0}
    .stat-val{font-size:20px;font-weight:800;color:#0f172a}
    .stat-lbl{font-size:11px;color:#94a3b8;margin-top:2px}
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;padding:9px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
    td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    tr:hover td{background:#f8fafc}
    .print-btn{margin-bottom:20px;padding:9px 20px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
    @media print{.print-btn{display:none}body{padding:16px}}
  </style></head><body>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  <div class="header">
    <div>
      <div class="logo">💊 PharmaTrack</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px">Sales Report</div>
    </div>
    <div class="meta">
      Generated: ${new Date().toLocaleString('en-KE')}<br>
      Records: ${sales.length}
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${sales.length}</div><div class="stat-lbl">Total Transactions</div></div>
    <div class="stat"><div class="stat-val">${fmt.currency(totalRevenue)}</div><div class="stat-lbl">Total Revenue</div></div>
    <div class="stat"><div class="stat-val">${sales.filter(s=>s.status==='completed').length}</div><div class="stat-lbl">Completed</div></div>
    <div class="stat"><div class="stat-val">${sales.filter(s=>s.status==='refunded').length}</div><div class="stat-lbl">Refunded</div></div>
  </div>
  <table><thead><tr>
    <th>Receipt #</th><th>Date &amp; Time</th><th>Customer</th><th>Served By</th><th>Payment</th><th style="text-align:right">Total</th><th>Status</th>
  </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

// ─── Status badge using project badge classes ─────────────────────────────────
const STATUS_MAP = {
  completed: 'badge-success',
  pending:   'badge-warning',
  refunded:  'badge-warning',
  cancelled: 'badge-danger',
}
const PAYMENT_ICONS = {
  cash:      'bi-cash-coin',
  mpesa:     'bi-phone',
  card:      'bi-credit-card',
  insurance: 'bi-shield-check',
}

function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_MAP[status] || 'badge-gray'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function PaymentBadge({ method }) {
  return (
    <span className="badge badge-gray">
      <i className={`bi ${PAYMENT_ICONS[method] || 'bi-cash'}`} />
      {method === 'mpesa' ? 'M-Pesa' : method.charAt(0).toUpperCase() + method.slice(1)}
    </span>
  )
}

// ─── Sale detail modal ────────────────────────────────────────────────────────
function SaleDetailModal({ slug, onClose }) {
  const [sale, setSale] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.sales.receipt(slug)
      .then(d => { setSale(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>

        {/* Header */}
        <div className="modal-header">
          {loading ? (
            <h3><i className="bi bi-receipt" style={{ marginRight: 8 }} />Loading…</h3>
          ) : (
            <div>
              <h3 style={{ marginBottom: 2 }}>
                <i className="bi bi-receipt" style={{ marginRight: 8, color: 'var(--primary)' }} />
                {sale?.receipt_number}
              </h3>
              <div className="text-sm text-muted">{fmt.datetime(sale?.created_at)}</div>
            </div>
          )}
          <div className="d-flex align-center gap-2">
            {sale && <StatusBadge status={sale.status} />}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="spinner" />
          </div>
        ) : sale ? (
          <>
            {/* Meta grid */}
            <div className="modal-body" style={{ paddingBottom: 0 }}>
              <div className="grid-2" style={{ marginBottom: 0 }}>
                {[
                  ['bi-person',        'Customer',   sale.customer_name || 'Walk-in'],
                  ['bi-person-badge',  'Served By',  sale.served_by_name || '—'],
                  ['bi-credit-card',   'Payment',    sale.payment_method === 'mpesa' ? 'M-Pesa' : sale.payment_method.charAt(0).toUpperCase() + sale.payment_method.slice(1)],
                  ['bi-phone',         'M-Pesa Ref', sale.mpesa_reference || '—'],
                ].map(([icon, label, val]) => (
                  <div key={label} style={{
                    background: 'var(--gray-50)', borderRadius: 'var(--radius)',
                    padding: '10px 12px', border: '1px solid var(--gray-100)',
                  }}>
                    <div className="text-sm text-muted" style={{ marginBottom: 3 }}>
                      <i className={`bi ${icon}`} style={{ marginRight: 4 }} />{label}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="modal-body" style={{ paddingTop: 16, paddingBottom: 0 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>
                <i className="bi bi-box-seam" style={{ marginRight: 6 }} />Items
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items?.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{item.product_name}</div>
                          {item.product_unit && <div className="text-sm text-muted">{item.product_unit}</div>}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{fmt.currency(item.unit_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt.currency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="modal-body" style={{ paddingTop: 16 }}>
              <div style={{
                background: 'var(--gray-50)', borderRadius: 'var(--radius)',
                padding: '12px 16px', border: '1px solid var(--gray-100)',
              }}>
                {[
                  ['Subtotal', fmt.currency(sale.subtotal), false],
                  sale.discount > 0 && ['Discount', `−${fmt.currency(sale.discount)}`, false],
                  sale.tax > 0      && ['Tax',      fmt.currency(sale.tax),            false],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="d-flex justify-between" style={{ marginBottom: 6, fontSize: 13, color: 'var(--gray-600)' }}>
                    <span>{label}</span><span>{val}</span>
                  </div>
                ))}
                <div className="d-flex justify-between" style={{
                  borderTop: '2px solid var(--gray-200)', paddingTop: 10, marginTop: 6,
                  fontWeight: 800, fontSize: 16, color: 'var(--gray-900)',
                }}>
                  <span>Total</span>
                  <span className="text-primary">{fmt.currency(sale.total_amount)}</span>
                </div>
                <div className="d-flex justify-between" style={{ marginTop: 6, fontSize: 13, color: 'var(--gray-500)' }}>
                  <span>Amount Paid ({sale.payment_method === 'mpesa' ? 'M-Pesa' : sale.payment_method})</span>
                  <span>{fmt.currency(sale.amount_paid)}</span>
                </div>
                {parseFloat(sale.change_given) > 0 && (
                  <div className="d-flex justify-between" style={{ marginTop: 4, fontSize: 13, color: 'var(--gray-500)' }}>
                    <span>Change Given</span>
                    <span>{fmt.currency(sale.change_given)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="modal-body">
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-circle" /> Failed to load sale details.
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="bi bi-x" /> Close
          </button>
          {sale && (
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              <i className="bi bi-printer" /> Print Receipt
            </button>
          )}
        </div>
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
  const hasFilters = search || status || payment || dateFrom || dateTo

  const fetchSales = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const params = { page: pg, page_size: PAGE_SIZE }
      if (search)   params.search          = search
      if (status)   params.status          = status
      if (payment)  params.payment_method  = payment
      if (dateFrom) params.date_from       = dateFrom
      if (dateTo)   params.date_to         = dateTo
      const data = await api.sales.list(params)
      setSales(data.results || data)
      setCount(data.count || (data.results || data).length)
    } finally { setLoading(false) }
  }, [search, status, payment, dateFrom, dateTo])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); fetchSales(1) }, [search, status, payment, dateFrom, dateTo])
  // Fetch when page changes (but not on filter change — above handles that)
  useEffect(() => { fetchSales(page) }, [page]) // eslint-disable-line

  const fetchAllForExport = async () => {
    const params = { page: 1, page_size: 1000 }
    if (search)   params.search         = search
    if (status)   params.status         = status
    if (payment)  params.payment_method = payment
    if (dateFrom) params.date_from      = dateFrom
    if (dateTo)   params.date_to        = dateTo
    const data = await api.sales.list(params)
    return data.results || data
  }

  const exportXLSX = async () => {
    setExporting(true)
    try {
      const all = await fetchAllForExport()
      const rows = all.map(s => ({
        'Receipt No':   s.receipt_number,
        'Date':         fmt.datetime(s.created_at),
        'Customer':     s.customer_name || 'Walk-in',
        'Served By':    s.served_by_name || '',
        'Payment':      s.payment_method === 'mpesa' ? 'M-Pesa' : s.payment_method,
        'M-Pesa Ref':   s.mpesa_reference || '',
        'Subtotal':     parseFloat(s.subtotal),
        'Discount':     parseFloat(s.discount),
        'Tax':          parseFloat(s.tax),
        'Total (KES)':  parseFloat(s.total_amount),
        'Amount Paid':  parseFloat(s.amount_paid),
        'Change Given': parseFloat(s.change_given),
        'Status':       s.status,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [18,20,20,18,12,16,12,10,8,14,14,14,12].map(w => ({ wch: w }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sales')
      XLSX.writeFile(wb, `sales-${new Date().toISOString().slice(0,10)}.xlsx`)
    } finally { setExporting(false) }
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const all = await fetchAllForExport()
      generatePDF(all)
    } finally { setExporting(false) }
  }

  const clearFilters = () => {
    setSearch(''); setStatus(''); setPayment(''); setDateFrom(''); setDateTo('')
  }

  // Page-level summary stats
  const pageRevenue  = sales.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
  const completedCnt = sales.filter(s => s.status === 'completed').length
  const refundedCnt  = sales.filter(s => s.status === 'refunded').length

  return (
    <div className="page-body">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>
            <i className="bi bi-receipt" style={{ marginRight: 10, color: 'var(--primary)' }} />
            Sales
          </h1>
          <p>{count.toLocaleString()} total records</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={exportXLSX}
            disabled={exporting || loading}
          >
            {exporting
              ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Exporting…</>
              : <><i className="bi bi-file-earmark-spreadsheet" /> Export XLSX</>
            }
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={exportPDF}
            disabled={exporting || loading}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            {exporting
              ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Exporting…</>
              : <><i className="bi bi-file-earmark-pdf" /> Export PDF</>
            }
          </button>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <div className="grid-4 mb-4">
        {[
          { icon: 'bi-currency-exchange', label: 'Page Revenue',   value: fmt.currency(pageRevenue),  cls: 'text-primary' },
          { icon: 'bi-check-circle',      label: 'Completed',      value: completedCnt,               cls: 'text-success' },
          { icon: 'bi-arrow-counterclockwise', label: 'Refunded',  value: refundedCnt,                cls: 'text-warning' },
          { icon: 'bi-collection',        label: 'Total Records',  value: count.toLocaleString(),     cls: '' },
        ].map(s => (
          <div key={s.label} className="card stat-card">
            <div className="card-title">
              <i className={`bi ${s.icon}`} style={{ marginRight: 5 }} />{s.label}
            </div>
            <div className={`card-value ${s.cls}`}>{s.value}</div>
            <i className={`bi ${s.icon} stat-icon`} />
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="d-flex" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>

          {/* Search */}
          <div className="search-bar" style={{ flex: '1 1 220px', minWidth: 180 }}>
            <i className="bi bi-search" />
            <input
              className="form-control"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Receipt, customer, M-Pesa ref…"
            />
          </div>

          {/* Status */}
          <select
            className="form-control"
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Payment */}
          <select
            className="form-control"
            value={payment}
            onChange={e => setPayment(e.target.value)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="card">Card</option>
            <option value="insurance">Insurance</option>
          </select>

          {/* Date range */}
          <div className="d-flex align-center gap-2">
            <input
              type="date" className="form-control" style={{ width: 'auto' }}
              value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            />
            <span className="text-muted text-sm">to</span>
            <input
              type="date" className="form-control" style={{ width: 'auto' }}
              value={dateTo} onChange={e => setDateTo(e.target.value)}
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button className="btn btn-danger btn-sm" onClick={clearFilters}>
              <i className="bi bi-x-circle" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap" style={{ borderRadius: 'var(--radius-lg)', border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th><i className="bi bi-hash" style={{ marginRight: 4 }} />Receipt</th>
                <th><i className="bi bi-calendar3" style={{ marginRight: 4 }} />Date &amp; Time</th>
                <th><i className="bi bi-person" style={{ marginRight: 4 }} />Customer</th>
                <th><i className="bi bi-person-badge" style={{ marginRight: 4 }} />Served By</th>
                <th><i className="bi bi-credit-card" style={{ marginRight: 4 }} />Payment</th>
                <th style={{ textAlign: 'right' }}><i className="bi bi-cash-stack" style={{ marginRight: 4 }} />Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton rows
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[120, 150, 110, 100, 80, 80, 70, 50].map((w, j) => (
                      <td key={j}>
                        <div style={{
                          height: 13, borderRadius: 4, width: w,
                          background: 'linear-gradient(90deg,var(--gray-100) 25%,var(--gray-200) 50%,var(--gray-100) 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.4s infinite',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--gray-400)' }}>
                    <i className="bi bi-receipt" style={{ fontSize: 40, display: 'block', marginBottom: 10 }} />
                    {hasFilters ? 'No sales match your filters.' : 'No sales recorded yet.'}
                  </td>
                </tr>
              ) : sales.map(sale => (
                <tr key={sale.id}>
                  <td>
                    <span className="text-bold text-primary">{sale.receipt_number}</span>
                  </td>
                  <td className="text-sm" style={{ color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                    {fmt.datetime(sale.created_at)}
                  </td>
                  <td>
                    {sale.customer_name
                      ? <span style={{ fontWeight: 500 }}>{sale.customer_name}</span>
                      : <span className="text-muted" style={{ fontStyle: 'italic' }}>Walk-in</span>
                    }
                  </td>
                  <td className="text-sm" style={{ color: 'var(--gray-600)' }}>
                    {sale.served_by_name || '—'}
                  </td>
                  <td><PaymentBadge method={sale.payment_method} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="text-bold">{fmt.currency(sale.total_amount)}</span>
                  </td>
                  <td><StatusBadge status={sale.status} /></td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedSlug(sale.slug)}
                      title="View details"
                    >
                      <i className="bi bi-eye" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="d-flex justify-between align-center" style={{
            padding: '12px 20px', borderTop: '1px solid var(--gray-100)',
            flexWrap: 'wrap', gap: 8,
          }}>
            <span className="text-sm text-muted">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, count)} of {count.toLocaleString()}
            </span>

            <div className="d-flex gap-2 align-center">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <i className="bi bi-chevron-left" /> Prev
              </button>

              {(() => {
                let start = Math.max(1, page - 2)
                let end   = Math.min(totalPages, start + 4)
                if (end - start < 4) start = Math.max(1, end - 4)
                return Array.from({ length: end - start + 1 }, (_, i) => start + i)
              })().map(pg => (
                <button
                  key={pg}
                  className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPage(pg)}
                  style={{ minWidth: 36 }}
                >{pg}</button>
              ))}

              <button
                className="btn btn-outline btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────────── */}
      {selectedSlug && (
        <SaleDetailModal slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
    </div>
  )
}