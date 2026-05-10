import { useState, useEffect, useRef, useCallback } from 'react'
import { api, fmt } from '../utils/api'

// ─── Constants ────────────────────────────────────────────────────────────────
const UNITS = ['tablet','capsule','bottle','vial','sachet','tube','piece','ml','mg','box','strip']
const EMPTY_FORM = {
  name: '', generic_name: '', barcode: '', category: '', supplier: '',
  description: '', unit: 'tablet', buying_price: '', selling_price: '',
  stock_quantity: 0, reorder_level: 10, expiry_date: '',
  requires_prescription: false, is_active: true,
}

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')
  .replace(/\/api\/?$/, '')

function getImageUrl(img) {
  if (!img) return null
  if (img.startsWith('http')) return img
  return `${BASE_URL}${img}`
}

function calcMargin(buy, sell) {
  const b = parseFloat(buy), s = parseFloat(sell)
  if (!b || !s || b <= 0) return null
  return (((s - b) / b) * 100).toFixed(1)
}

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

// ─── Image Upload Zone ────────────────────────────────────────────────────────
function ImageUpload({ preview, onChange }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    onChange(file, URL.createObjectURL(file))
  }

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
      style={{
        border: `2px dashed ${drag ? 'var(--primary)' : 'var(--gray-300)'}`,
        borderRadius: 'var(--radius)',
        padding: preview ? '12px' : '28px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        background: drag ? 'var(--primary-xlight)' : 'var(--gray-50)',
        transition: 'all var(--transition)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
      {preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img src={preview} alt="Product" style={{ maxHeight: 130, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            <i className="bi bi-arrow-repeat" /> Click or drag to replace
          </span>
        </div>
      ) : (
        <>
          <i className="bi bi-cloud-arrow-up" style={{ fontSize: 28, color: 'var(--gray-400)', display: 'block', marginBottom: 8 }} />
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-600)' }}>Click or drag image here</div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>PNG, JPG, WEBP up to 5 MB</div>
        </>
      )}
    </div>
  )
}

// ─── Product Form Modal ────────────────────────────────────────────────────────
const FORM_TABS = [
  { id: 'basic',   icon: 'bi-box-seam',       label: 'Basic Info' },
  { id: 'pricing', icon: 'bi-cash-coin',       label: 'Pricing & Stock' },
  { id: 'media',   icon: 'bi-image',           label: 'Image & Notes' },
]

function ProductModal({ product, categories, suppliers, onClose, onSave }) {
  const [tab, setTab]           = useState('basic')
  const [form, setForm]         = useState(() =>
    product
      ? { ...EMPTY_FORM, ...product, category: product.category ?? '', supplier: product.supplier ?? '' }
      : { ...EMPTY_FORM }
  )
  const [imgFile, setImgFile]   = useState(null)
  const [imgPreview, setImgPreview] = useState(product ? getImageUrl(product.image) : null)
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.buying_price  || parseFloat(form.buying_price)  < 0) e.buying_price  = 'Required'
    if (!form.selling_price || parseFloat(form.selling_price) < 0) e.selling_price = 'Required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSave = async () => {
    if (!validate()) { setTab('basic'); return }
    setLoading(true)
    try {
      if (imgFile) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== '') fd.append(k, v)
        })
        fd.append('image', imgFile)
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
        const token   = localStorage.getItem('access_token')
        const url     = product ? `${apiBase}/products/${product.slug}/` : `${apiBase}/products/`
        const res     = await fetch(url, { method: product ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
        if (!res.ok) { const err = await res.json(); throw new Error(Object.values(err).flat().join(', ')) }
      } else {
        const payload = { ...form }
        if (!payload.category)    delete payload.category
        if (!payload.supplier)    delete payload.supplier
        if (!payload.barcode)     delete payload.barcode
        if (!payload.expiry_date) delete payload.expiry_date
        product ? await api.products.update(product.slug, payload) : await api.products.create(payload)
      }
      onSave()
    } catch (e) {
      setErrors({ _global: e.message })
    } finally {
      setLoading(false)
    }
  }

  const margin = calcMargin(form.buying_price, form.selling_price)
  const profit = (parseFloat(form.selling_price) || 0) - (parseFloat(form.buying_price) || 0)
  const tabIdx = FORM_TABS.findIndex(t => t.id === tab)

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div className="modal-header">
          <h3>
            <i className={`bi ${product ? 'bi-pencil-square' : 'bi-plus-circle-fill'} me-2 text-primary`} />
            {product ? 'Edit Product' : 'Add New Product'}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <div className="modal-body">
          {errors._global && (
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle-fill" /> {errors._global}
            </div>
          )}

          {/* Tab strip */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--gray-100)', borderRadius: 'var(--radius)', padding: 4, marginBottom: 24 }}>
            {FORM_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13,
                  fontWeight: tab === t.id ? 700 : 500,
                  background: tab === t.id ? 'var(--white)' : 'transparent',
                  color: tab === t.id ? 'var(--primary)' : 'var(--gray-500)',
                  boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition)',
                }}
              >
                <i className={`bi ${t.icon}`} /> {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Basic Info ── */}
          {tab === 'basic' && (
            <div>
              <div className="grid-2" style={{ rowGap: 0 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Product Name *</label>
                  <input
                    className="form-control" placeholder="e.g. Paracetamol 500mg"
                    value={form.name} onChange={e => set('name', e.target.value)}
                    style={errors.name ? { borderColor: 'var(--danger)' } : {}}
                  />
                  {errors.name && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.name}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Generic / Chemical Name</label>
                  <input className="form-control" placeholder="e.g. Acetaminophen" value={form.generic_name} onChange={e => set('generic_name', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Barcode</label>
                  <div className="input-group">
                    <i className="input-prefix bi bi-upc-scan" />
                    <input className="form-control" placeholder="Scan or enter barcode" value={form.barcode} onChange={e => set('barcode', e.target.value)} />
                  </div>
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
                  <label className="form-label">Unit of Measure</label>
                  <select className="form-control" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input className="form-control" type="date" value={form.expiry_date || ''} onChange={e => set('expiry_date', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 28, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                  <input type="checkbox" checked={form.requires_prescription} onChange={e => set('requires_prescription', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
                  <i className="bi bi-file-earmark-medical" style={{ color: 'var(--warning)' }} />
                  Requires Prescription (Rx)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
                  <i className="bi bi-toggle-on" style={{ color: 'var(--success)' }} />
                  Active / Listed
                </label>
              </div>
            </div>
          )}

          {/* ── Tab: Pricing & Stock ── */}
          {tab === 'pricing' && (
            <div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Buying Price (KES) *</label>
                  <div className="input-group">
                    <i className="input-prefix bi bi-tag" />
                    <input
                      className="form-control" type="number" step="0.01" min="0" placeholder="0.00"
                      value={form.buying_price} onChange={e => set('buying_price', e.target.value)}
                      style={errors.buying_price ? { borderColor: 'var(--danger)' } : {}}
                    />
                  </div>
                  {errors.buying_price && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.buying_price}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Selling Price (KES) *
                    {margin !== null && (
                      <span className={`badge ${parseFloat(margin) >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: 8, fontSize: 10 }}>
                        {parseFloat(margin) >= 0 ? '↑' : '↓'} {margin}%
                      </span>
                    )}
                  </label>
                  <div className="input-group">
                    <i className="input-prefix bi bi-cash-stack" />
                    <input
                      className="form-control" type="number" step="0.01" min="0" placeholder="0.00"
                      value={form.selling_price} onChange={e => set('selling_price', e.target.value)}
                      style={errors.selling_price ? { borderColor: 'var(--danger)' } : {}}
                    />
                  </div>
                  {errors.selling_price && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.selling_price}</div>}
                </div>
              </div>

              {/* Live profit preview */}
              {margin !== null && (
                <div style={{ display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--gray-200)', marginBottom: 20 }}>
                  {[
                    { label: 'Cost Price',  value: fmt.currency(form.buying_price),  icon: 'bi-tag',            bg: 'var(--gray-50)',     textColor: 'var(--gray-800)' },
                    { label: 'Profit / Unit', value: fmt.currency(profit),           icon: 'bi-graph-up-arrow', bg: parseFloat(margin) >= 0 ? 'var(--success-light)' : 'var(--danger-light)', textColor: parseFloat(margin) >= 0 ? '#065f46' : '#991b1b' },
                    { label: 'Margin',      value: `${margin}%`,                     icon: 'bi-percent',        bg: 'var(--gray-50)',     textColor: 'var(--gray-800)' },
                  ].map((s, i, arr) => (
                    <div key={i} style={{ flex: 1, padding: '12px 14px', textAlign: 'center', background: s.bg, borderRight: i < arr.length - 1 ? '1px solid var(--gray-200)' : 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        <i className={`bi ${s.icon}`} style={{ marginRight: 4 }} />{s.label}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.textColor }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label"><i className="bi bi-boxes me-1" />Stock Quantity</label>
                  <input className="form-control" type="number" min="0" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} />
                  <small style={{ color: 'var(--gray-400)', fontSize: 12 }}>Current units in inventory</small>
                </div>
                <div className="form-group">
                  <label className="form-label"><i className="bi bi-bell me-1" />Reorder Level</label>
                  <input className="form-control" type="number" min="0" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} />
                  <small style={{ color: 'var(--gray-400)', fontSize: 12 }}>Alert when stock falls below this</small>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Image & Notes ── */}
          {tab === 'media' && (
            <div>
              <div className="form-group">
                <label className="form-label">Product Image</label>
                <ImageUpload preview={imgPreview} onChange={(file, url) => { setImgFile(file); setImgPreview(url) }} />
                {imgPreview && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8, color: 'var(--danger)' }}
                    onClick={() => { setImgFile(null); setImgPreview(null) }}
                  >
                    <i className="bi bi-trash3" /> Remove image
                  </button>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Description / Notes</label>
                <textarea
                  className="form-control" rows={5}
                  placeholder="Usage instructions, dosage info, storage requirements…"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            {tabIdx > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setTab(FORM_TABS[tabIdx - 1].id)}>
                <i className="bi bi-arrow-left" /> Back
              </button>
            )}
            {tabIdx < FORM_TABS.length - 1 && (
              <button className="btn btn-outline btn-sm" onClick={() => setTab(FORM_TABS[tabIdx + 1].id)}>
                Next <i className="bi bi-arrow-right" />
              </button>
            )}
          </div>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading
              ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Saving…</>
              : <><i className={`bi ${product ? 'bi-check-lg' : 'bi-plus-lg'}`} /> {product ? 'Save Changes' : 'Add Product'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────
function ProductDetail({ product, onClose, onEdit }) {
  const imgUrl = getImageUrl(product.image)
  const margin = calcMargin(product.buying_price, product.selling_price)
  const days   = daysUntilExpiry(product.expiry_date)
  const stockPct = product.reorder_level > 0
    ? Math.min(100, Math.round((product.stock_quantity / (product.reorder_level * 3)) * 100))
    : 100

  const KVRow = ({ label, value }) => (
    <div style={{ padding: '9px 0', borderBottom: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>{value || <span className="text-muted">—</span>}</span>
    </div>
  )

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 800 }}>
        <div className="modal-header">
          <h3><i className="bi bi-capsule me-2 text-primary" />{product.name}</h3>
          <div className="d-flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={onEdit}><i className="bi bi-pencil" /> Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
          </div>
        </div>

        <div className="modal-body">
          {/* Hero row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
            <div style={{
              width: 150, height: 150, flexShrink: 0, borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--gray-200)', background: 'var(--gray-50)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {imgUrl
                ? <img src={imgUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <i className="bi bi-capsule-pill" style={{ fontSize: 52, color: 'var(--gray-300)' }} />}
            </div>
            <div style={{ flex: 1 }}>
              {product.generic_name && (
                <div style={{ fontSize: 13, color: 'var(--gray-400)', fontStyle: 'italic', marginBottom: 10 }}>{product.generic_name}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {product.is_active
                  ? <span className="badge badge-success"><i className="bi bi-check-circle-fill" /> Active</span>
                  : <span className="badge badge-gray"><i className="bi bi-x-circle-fill" /> Inactive</span>}
                {product.requires_prescription && <span className="badge badge-warning"><i className="bi bi-file-earmark-medical-fill" /> Rx Required</span>}
                {product.is_low_stock  && <span className="badge badge-danger"><i className="bi bi-exclamation-triangle-fill" /> Low Stock</span>}
                {product.is_expired    && <span className="badge badge-danger"><i className="bi bi-calendar-x-fill" /> Expired</span>}
                {product.category_name && <span className="badge badge-primary"><i className="bi bi-tag" /> {product.category_name}</span>}
              </div>

              {/* Stock bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: 'var(--gray-700)' }}>
                    <i className="bi bi-boxes" style={{ marginRight: 4 }} />{product.stock_quantity} {product.unit}s in stock
                  </span>
                  <span style={{ color: 'var(--gray-400)' }}>Reorder at {product.reorder_level}</span>
                </div>
                <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, width: `${stockPct}%`,
                    background: product.is_low_stock ? 'var(--danger)' : 'var(--success)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {product.barcode && (
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  <i className="bi bi-upc-scan" style={{ marginRight: 5 }} />
                  Barcode: <code style={{ background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>{product.barcode}</code>
                </div>
              )}
            </div>
          </div>

          {/* 4 stat cards */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            {[
              { label: 'Selling Price', val: fmt.currency(product.selling_price), sub: `per ${product.unit}`, icon: 'bi-cash-stack',      color: 'var(--primary)' },
              { label: 'Buying Price',  val: fmt.currency(product.buying_price),  sub: 'cost price',          icon: 'bi-tag-fill',         color: 'var(--gray-500)' },
              { label: 'Profit / Unit', val: fmt.currency(parseFloat(product.selling_price) - parseFloat(product.buying_price)),
                sub: 'gross profit',  icon: 'bi-graph-up-arrow',
                color: margin !== null && parseFloat(margin) >= 0 ? 'var(--success)' : 'var(--danger)' },
              { label: 'Margin',        val: margin !== null ? `${margin}%` : '—', sub: 'on cost',             icon: 'bi-percent',
                color: margin !== null && parseFloat(margin) >= 0 ? 'var(--success)' : 'var(--danger)' },
            ].map((s, i) => (
              <div key={i} className="card stat-card" style={{ padding: '14px 16px' }}>
                <div className="card-title">{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div className="card-sub">{s.sub}</div>
                <i className={`bi ${s.icon} stat-icon`} style={{ color: s.color }} />
              </div>
            ))}
          </div>

          {/* Detail fields */}
          <div className="grid-2">
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                <i className="bi bi-info-circle me-1" />Product Info
              </div>
              <KVRow label="Supplier" value={product.supplier_name} />
              <KVRow label="Unit"     value={product.unit ? product.unit.charAt(0).toUpperCase() + product.unit.slice(1) : ''} />
              <KVRow label="Prescription" value={product.requires_prescription ? 'Required (Rx)' : 'Not required (OTC)'} />
              <KVRow label="Slug" value={<code style={{ fontSize: 12, background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>{product.slug}</code>} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                <i className="bi bi-calendar3 me-1" />Dates & Expiry
              </div>
              <KVRow
                label="Expiry Date"
                value={product.expiry_date
                  ? <span style={{ color: product.is_expired ? 'var(--danger)' : days !== null && days <= 30 ? 'var(--warning)' : 'inherit' }}>
                      {product.expiry_date}
                      {days !== null && (
                        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, color: 'var(--gray-400)' }}>
                          ({days < 0 ? `Expired ${-days}d ago` : `${days}d left`})
                        </span>
                      )}
                    </span>
                  : null}
              />
              <KVRow label="Date Added"   value={fmt.date(product.created_at)} />
              <KVRow label="Last Updated" value={fmt.date(product.updated_at)} />
            </div>
          </div>

          {product.description && (
            <div style={{ marginTop: 16, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                <i className="bi bi-file-text me-1" />Description
              </div>
              <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: 13.5, lineHeight: 1.65 }}>{product.description}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={onEdit}><i className="bi bi-pencil" /> Edit Product</button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ product, loading, onClose, onConfirm }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 style={{ color: 'var(--danger)' }}><i className="bi bi-trash3 me-2" />Delete Product</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--danger-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: 28, color: 'var(--danger)' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Are you sure?</div>
          <p style={{ color: 'var(--gray-500)', fontSize: 13.5, margin: 0 }}>
            You are about to permanently delete <strong>{product.name}</strong>.
            This cannot be undone. Existing sale history will be preserved.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading
              ? <><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Deleting…</>
              : <><i className="bi bi-trash3" /> Delete Product</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function Products() {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers]   = useState([])
  const [loading, setLoading]       = useState(true)

  const [search, setSearch]             = useState('')
  const [catFilter, setCatFilter]       = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [rxFilter, setRxFilter]         = useState('')
  const [view, setView]                 = useState('table') // 'table' | 'grid'

  const [adding, setAdding]               = useState(false)
  const [editing, setEditing]             = useState(null)
  const [viewing, setViewing]             = useState(null)
  const [deleting, setDeleting]           = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadAll = useCallback(() => {
    setLoading(true)
    const params = {}
    if (search)       params.search  = search
    if (catFilter)    params.category = catFilter
    if (activeFilter) params.is_active = activeFilter
    if (rxFilter)     params.requires_prescription = rxFilter
    Promise.all([
      api.products.list(params),
      api.categories.list(),
      api.suppliers.list(),
    ]).then(([p, c, s]) => {
      setProducts(p.results ?? p)
      setCategories(c.results ?? c)
      setSuppliers(s.results ?? s)
    }).catch(console.error).finally(() => setLoading(false))
  }, [search, catFilter, activeFilter, rxFilter])

  useEffect(() => { loadAll() }, [loadAll])

  const handleDelete = async () => {
    setDeleteLoading(true)
    try { await api.products.delete(deleting.slug); setDeleting(null); loadAll() }
    catch (e) { alert(e.message) }
    finally { setDeleteLoading(false) }
  }

  const handleSaved = () => { setAdding(false); setEditing(null); loadAll() }
  const openEdit    = (p) => { setEditing(p); setViewing(null) }

  const lowStockCount = products.filter(p => p.is_low_stock).length
  const expiredCount  = products.filter(p => p.is_expired).length

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1><i className="bi bi-capsule-pill me-2 text-primary" />Products</h1>
          <p>{products.length} items in catalogue</p>
        </div>
        <div className="d-flex align-center gap-3">
          {lowStockCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: 12, padding: '5px 12px' }}>
              <i className="bi bi-exclamation-triangle-fill" /> {lowStockCount} Low Stock
            </span>
          )}
          {expiredCount > 0 && (
            <span className="badge badge-danger" style={{ fontSize: 12, padding: '5px 12px' }}>
              <i className="bi bi-calendar-x-fill" /> {expiredCount} Expired
            </span>
          )}
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <i className="bi bi-plus-lg" /> Add Product
          </button>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="d-flex gap-3 mb-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" />
          <input
            className="form-control"
            placeholder="Search name, generic name, barcode…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="form-control" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="form-control" style={{ width: 145 }} value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <select className="form-control" style={{ width: 130 }} value={rxFilter} onChange={e => setRxFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="true">Rx Only</option>
          <option value="false">OTC</option>
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius)', padding: 3, gap: 2, border: '1px solid var(--gray-200)' }}>
          {[{ id: 'table', icon: 'bi-list-ul', title: 'Table view' }, { id: 'grid', icon: 'bi-grid-3x3-gap', title: 'Grid view' }].map(v => (
            <button
              key={v.id}
              title={v.title}
              onClick={() => setView(v.id)}
              style={{
                padding: '6px 11px', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: view === v.id ? 'var(--white)' : 'transparent',
                color: view === v.id ? 'var(--primary)' : 'var(--gray-500)',
                boxShadow: view === v.id ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--transition)',
              }}
            >
              <i className={`bi ${v.icon}`} style={{ fontSize: 15 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="loading-center">
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--gray-400)' }}>
          <i className="bi bi-capsule-pill" style={{ fontSize: 54, display: 'block', marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-600)', marginBottom: 6 }}>No products found</div>
          <div style={{ fontSize: 13 }}>Adjust your filters or add a new product to get started.</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setAdding(true)}>
            <i className="bi bi-plus-lg" /> Add First Product
          </button>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {!loading && products.length > 0 && view === 'table' && (
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
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const margin = calcMargin(p.buying_price, p.selling_price)
                const days   = daysUntilExpiry(p.expiry_date)
                const imgUrl = getImageUrl(p.image)
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setViewing(p)}>

                    {/* Product */}
                    <td>
                      <div className="d-flex align-center gap-2">
                        <div style={{
                          width: 40, height: 40, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                          background: 'var(--gray-100)', border: '1px solid var(--gray-200)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {imgUrl
                            ? <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <i className="bi bi-capsule" style={{ fontSize: 18, color: 'var(--gray-400)' }} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>{p.name}</div>
                          {p.generic_name && <div className="text-muted text-sm">{p.generic_name}</div>}
                          {p.requires_prescription && <span className="badge badge-warning" style={{ fontSize: 10, marginTop: 2 }}>Rx</span>}
                        </div>
                      </div>
                    </td>

                    <td>
                      {p.category_name
                        ? <span className="badge badge-primary">{p.category_name}</span>
                        : <span className="text-muted">—</span>}
                    </td>

                    <td className="text-sm" style={{ color: 'var(--gray-600)' }}>
                      {p.supplier_name || <span className="text-muted">—</span>}
                    </td>

                    <td style={{ fontWeight: 500 }}>{fmt.currency(p.buying_price)}</td>

                    <td style={{ fontWeight: 700 }}>{fmt.currency(p.selling_price)}</td>

                    <td>
                      {margin !== null
                        ? <span style={{ fontWeight: 700, color: parseFloat(margin) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {parseFloat(margin) >= 0 ? '↑' : '↓'} {margin}%
                          </span>
                        : <span className="text-muted">—</span>}
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, fontSize: 15, color: p.is_low_stock ? 'var(--danger)' : 'var(--gray-800)' }}>
                        {p.stock_quantity}
                      </div>
                      <div className="text-muted text-sm">{p.unit}</div>
                      {p.is_low_stock && (
                        <span className="badge badge-danger" style={{ fontSize: 10, marginTop: 2 }}>
                          <i className="bi bi-exclamation-triangle-fill" /> Low
                        </span>
                      )}
                    </td>

                    <td className="text-sm">
                      {p.expiry_date
                        ? <>
                            <span style={{ color: p.is_expired ? 'var(--danger)' : days !== null && days <= 30 ? 'var(--warning)' : 'var(--gray-700)', fontWeight: p.is_expired ? 700 : 400 }}>
                              {p.is_expired && <i className="bi bi-exclamation-circle-fill me-1" />}
                              {p.expiry_date}
                            </span>
                            {days !== null && !p.is_expired && days <= 90 && (
                              <div className="text-muted text-sm">{days}d left</div>
                            )}
                          </>
                        : <span className="text-muted">—</span>}
                    </td>

                    <td>
                      {p.is_active
                        ? <span className="badge badge-success"><i className="bi bi-check-circle-fill" /> Active</span>
                        : <span className="badge badge-gray"><i className="bi bi-x-circle-fill" /> Inactive</span>}
                    </td>

                    <td onClick={e => e.stopPropagation()}>
                      <div className="d-flex gap-2" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-outline" title="View" style={{ padding: '4px 9px' }} onClick={() => setViewing(p)}>
                          <i className="bi bi-eye" />
                        </button>
                        <button className="btn btn-sm btn-outline" title="Edit" style={{ padding: '4px 9px' }} onClick={() => setEditing(p)}>
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className="btn btn-sm" title="Delete" style={{ padding: '4px 9px', background: 'var(--danger-light)', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                          onClick={() => setDeleting(p)}
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && products.length > 0 && view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {products.map(p => {
            const margin = calcMargin(p.buying_price, p.selling_price)
            const imgUrl = getImageUrl(p.image)
            return (
              <div
                key={p.id}
                onClick={() => setViewing(p)}
                style={{
                  background: 'var(--white)', border: '1.5px solid var(--gray-200)',
                  borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)', transition: 'all var(--transition)',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--gray-200)' }}
              >
                {/* Image */}
                <div style={{ height: 148, background: 'var(--gray-100)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className="bi bi-capsule-pill" style={{ fontSize: 52, color: 'var(--gray-300)' }} />}

                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    {p.is_low_stock && <span className="badge badge-danger" style={{ fontSize: 10 }}><i className="bi bi-exclamation-triangle-fill" /> Low</span>}
                    {p.is_expired   && <span className="badge badge-danger" style={{ fontSize: 10 }}><i className="bi bi-calendar-x-fill" /> Expired</span>}
                    {p.requires_prescription && <span className="badge badge-warning" style={{ fontSize: 10 }}>Rx</span>}
                  </div>

                  {!p.is_active && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="badge badge-gray"><i className="bi bi-x-circle-fill" /> Inactive</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div style={{ padding: '14px 14px 10px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, lineHeight: 1.3, color: 'var(--gray-900)' }}>{p.name}</div>
                  {p.generic_name && <div className="text-muted text-sm mb-2">{p.generic_name}</div>}
                  {p.category_name && <span className="badge badge-primary" style={{ fontSize: 10, marginBottom: 10, display: 'inline-flex' }}>{p.category_name}</span>}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: p.category_name ? 0 : 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Selling</div>
                      <div className="product-card-price">{fmt.currency(p.selling_price)}</div>
                    </div>
                    {margin !== null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(margin) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {parseFloat(margin) >= 0 ? '↑' : '↓'} {margin}%
                      </span>
                    )}
                  </div>
                  <div className="product-card-stock mt-1">
                    <i className="bi bi-boxes me-1" />
                    <strong style={{ color: p.is_low_stock ? 'var(--danger)' : 'var(--gray-800)' }}>{p.stock_quantity}</strong> {p.unit}s
                  </div>
                </div>

                {/* Actions */}
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', gap: 6, padding: '8px 12px 12px', borderTop: '1px solid var(--gray-100)' }}
                >
                  <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => setViewing(p)}>
                    <i className="bi bi-eye" /> View
                  </button>
                  <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => setEditing(p)}>
                    <i className="bi bi-pencil" /> Edit
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ padding: '5px 10px', background: 'var(--danger-light)', color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                    onClick={() => setDeleting(p)}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {adding && (
        <ProductModal categories={categories} suppliers={suppliers} onClose={() => setAdding(false)} onSave={handleSaved} />
      )}
      {editing && (
        <ProductModal product={editing} categories={categories} suppliers={suppliers} onClose={() => setEditing(null)} onSave={handleSaved} />
      )}
      {viewing && !editing && (
        <ProductDetail product={viewing} onClose={() => setViewing(null)} onEdit={() => openEdit(viewing)} />
      )}
      {deleting && (
        <DeleteConfirm product={deleting} loading={deleteLoading} onClose={() => setDeleting(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}