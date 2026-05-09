import { useState, useEffect } from 'react'
import { api, fmt } from '../utils/api'

function AdjustModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({ reason: 'purchase', quantity_change: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.quantity_change) { setError('Enter quantity change'); return }
    setLoading(true)
    try {
      await api.stock.adjust({ product: product.id, ...form, quantity_change: parseInt(form.quantity_change) })
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Adjust Stock — {product.name}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Current Stock</label>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>{product.stock_quantity} units</div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <select className="form-control" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}>
              <option value="purchase">Purchase / Restock</option>
              <option value="return">Customer Return</option>
              <option value="damage">Damaged / Expired</option>
              <option value="theft">Theft</option>
              <option value="correction">Stock Correction</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity Change</label>
            <input className="form-control" type="number" placeholder="+50 to add, -10 to remove"
              value={form.quantity_change} onChange={e => setForm({ ...form, quantity_change: e.target.value })} />
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
              New quantity will be: <strong>{Math.max(0, (product.stock_quantity || 0) + parseInt(form.quantity_change || 0))}</strong>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-control" rows={3} placeholder="Optional notes…"
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [adjusting, setAdjusting] = useState(null)
  const [tab, setTab] = useState('stock')
  const [adjustments, setAdjustments] = useState([])

  const loadProducts = () => {
    api.products.list({ is_active: true }).then(r => setProducts(r.results || r)).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProducts()
    api.stock.list().then(r => setAdjustments(r.results || r))
  }, [])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const match = p.name.toLowerCase().includes(q) || (p.generic_name || '').toLowerCase().includes(q)
    if (!match) return false
    if (filter === 'low') return p.is_low_stock
    if (filter === 'out') return p.stock_quantity === 0
    if (filter === 'ok') return !p.is_low_stock && p.stock_quantity > 0
    return true
  })

  const lowCount = products.filter(p => p.is_low_stock).length
  const outCount = products.filter(p => p.stock_quantity === 0).length

  const tabs = [
    { id: 'stock', label: 'Stock Levels', icon: 'bi-boxes' },
    { id: 'history', label: 'Adjustment History', icon: 'bi-clock-history' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Monitor stock levels and adjust quantities</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-3 mb-5">
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="card-title">Total Products</div>
          <div className="card-value">{products.length}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="card-title">Low Stock</div>
          <div className="card-value" style={{ color: 'var(--warning)' }}>{lowCount}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="card-title">Out of Stock</div>
          <div className="card-value" style={{ color: 'var(--danger)' }}>{outCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--gray-200)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14,
              color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1 }}>
            <i className={`bi ${t.icon}`} style={{ marginRight: 6 }} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <div className="d-flex gap-3 mb-4">
            <div className="search-bar" style={{ flex: 1 }}>
              <i className="bi bi-search" />
              <input className="form-control" placeholder="Search products…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="form-control" style={{ width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Products</option>
              <option value="ok">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Reorder Level</th>
                  <th>Selling Price</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : filtered.map(p => {
                  const status = p.stock_quantity === 0 ? 'out' : p.is_low_stock ? 'low' : 'ok'
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.generic_name && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.generic_name}</div>}
                      </td>
                      <td>{p.category_name || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 16,
                          color: status === 'out' ? 'var(--danger)' : status === 'low' ? 'var(--warning)' : 'var(--gray-800)' }}>
                          {p.stock_quantity}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 4 }}>units</span>
                      </td>
                      <td>{p.reorder_level}</td>
                      <td>{fmt.currency(p.selling_price)}</td>
                      <td>
                        {status === 'out' && <span className="badge badge-danger"><i className="bi bi-x-circle" /> Out of Stock</span>}
                        {status === 'low' && <span className="badge badge-warning"><i className="bi bi-exclamation-triangle" /> Low Stock</span>}
                        {status === 'ok' && <span className="badge badge-success"><i className="bi bi-check-circle" /> In Stock</span>}
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => setAdjusting(p)}>
                          <i className="bi bi-plus-slash-minus" /> Adjust
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>Change</th><th>Reason</th><th>Previous</th><th>New</th><th>By</th><th>Date</th></tr>
            </thead>
            <tbody>
              {adjustments.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.product_name}</strong></td>
                  <td>
                    <span style={{ fontWeight: 700, color: a.quantity_change > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                    </span>
                  </td>
                  <td><span className="badge badge-gray">{a.reason}</span></td>
                  <td>{a.previous_quantity}</td>
                  <td><strong>{a.new_quantity}</strong></td>
                  <td>{a.adjusted_by_name}</td>
                  <td style={{ fontSize: 12 }}>{fmt.datetime(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && (
        <AdjustModal product={adjusting} onClose={() => setAdjusting(null)}
          onSave={() => { setAdjusting(null); loadProducts(); api.stock.list().then(r => setAdjustments(r.results || r)) }} />
      )}
    </div>
  )
}