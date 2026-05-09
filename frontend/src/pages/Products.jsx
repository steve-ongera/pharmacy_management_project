import { useState, useEffect } from 'react'
import { api, fmt } from '../utils/api'

const emptyForm = {
  name: '', generic_name: '', barcode: '', category: '', supplier: '',
  description: '', unit: 'tablet', buying_price: '', selling_price: '',
  stock_quantity: 0, reorder_level: 10, expiry_date: '',
  requires_prescription: false, is_active: true
}

function ProductModal({ product, categories, suppliers, onClose, onSave }) {
  const [form, setForm] = useState(product ? { ...product, category: product.category || '', supplier: product.supplier || '' } : emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const margin = form.buying_price && form.selling_price
    ? (((form.selling_price - form.buying_price) / form.buying_price) * 100).toFixed(1)
    : null

  const handleSave = async () => {
    if (!form.name || !form.selling_price || !form.buying_price) {
      setError('Name, buying price, and selling price are required'); return
    }
    setLoading(true)
    try {
      if (product) {
        await api.products.update(product.slug, form)
      } else {
        await api.products.create(form)
      }
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>{product ? 'Edit Product' : 'Add New Product'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input className="form-control" placeholder="e.g. Paracetamol 500mg" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Generic Name</label>
              <input className="form-control" placeholder="e.g. Acetaminophen" value={form.generic_name} onChange={e => set('generic_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Barcode</label>
              <input className="form-control" placeholder="Scan or enter barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-control" value={form.unit} onChange={e => set('unit', e.target.value)}>
                {['tablet','capsule','bottle','vial','sachet','tube','piece','ml','mg','box','strip'].map(u => (
                  <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="form-control" value={form.supplier} onChange={e => set('supplier', e.target.value)}>
                <option value="">— Select Supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Buying Price (KES) *</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.buying_price} onChange={e => set('buying_price', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">
                Selling Price (KES) *
                {margin && <span style={{ marginLeft: 8, color: parseFloat(margin) > 0 ? 'var(--success)' : 'var(--danger)', fontSize: 11, fontWeight: 700 }}>↑ {margin}% margin</span>}
              </label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Quantity</label>
              <input className="form-control" type="number" min="0" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reorder Level</label>
              <input className="form-control" type="number" min="0" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input className="form-control" type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.requires_prescription} onChange={e => set('requires_prescription', e.target.checked)} />
                <span className="form-label" style={{ margin: 0 }}>Requires Prescription (Rx)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 10 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                <span className="form-label" style={{ margin: 0 }}>Active</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : product ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      api.products.list({ search, category: catFilter }),
      api.categories.list(),
      api.suppliers.list(),
    ]).then(([p, c, s]) => {
      setProducts(p.results || p)
      setCategories(c.results || c)
      setSuppliers(s.results || s)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [search, catFilter])

  const handleDelete = async () => {
    try {
      await api.products.delete(deleteConfirm.slug)
      setDeleteConfirm(null)
      loadAll()
    } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p>{products.length} products in catalogue</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-lg" /> Add Product
        </button>
      </div>

      <div className="d-flex gap-3 mb-4">
        <div className="search-bar" style={{ flex: 1 }}>
          <i className="bi bi-search" />
          <input className="form-control" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 200 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Buying</th>
              <th>Selling</th>
              <th>Margin</th>
              <th>Stock</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : products.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.generic_name && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.generic_name}</div>}
                  {p.requires_prescription && <span className="badge badge-warning" style={{ fontSize: 10, marginTop: 2 }}>Rx</span>}
                </td>
                <td>{p.category_name || '—'}</td>
                <td>{p.supplier_name || '—'}</td>
                <td>{fmt.currency(p.buying_price)}</td>
                <td style={{ fontWeight: 600 }}>{fmt.currency(p.selling_price)}</td>
                <td>
                  <span style={{ color: parseFloat(p.profit_margin) > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {fmt.percent(p.profit_margin)}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: p.is_low_stock ? 'var(--danger)' : 'var(--gray-700)' }}>
                    {p.stock_quantity}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>
                  {p.expiry_date ? (
                    <span style={{ color: p.is_expired ? 'var(--danger)' : 'var(--gray-500)' }}>
                      {p.is_expired && '⚠ '}{p.expiry_date}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  {p.is_active
                    ? <span className="badge badge-success">Active</span>
                    : <span className="badge badge-gray">Inactive</span>}
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(p)}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm" style={{ borderColor: 'var(--danger-light)', color: 'var(--danger)', background: 'var(--danger-light)' }}
                      onClick={() => setDeleteConfirm(p)}>
                      <i className="bi bi-trash3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAdd || editing) && (
        <ProductModal
          product={editing}
          categories={categories}
          suppliers={suppliers}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSave={() => { setShowAdd(false); setEditing(null); loadAll() }}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h3>Delete Product</h3></div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}