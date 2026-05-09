import { useState, useEffect } from 'react'
import { api, fmt } from '../utils/api'

const emptyForm = {
  name: '', contact_person: '', email: '', phone: '',
  address: '', county: '', is_active: true
}

const KENYA_COUNTIES = [
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Malindi','Kitale',
  'Garissa','Kakamega','Nyeri','Machakos','Meru','Embu','Kisii','Kilifi',
  'Bungoma','Homabay','Migori','Siaya','Vihiga','Busia','Trans Nzoia',
  'Uasin Gishu','Elgeyo Marakwet','Nandi','Baringo','Laikipia','Samburu',
  'West Pokot','Turkana','Marsabit','Isiolo','Tharaka Nithi','Kirinyaga',
  'Murang\'a','Kiambu','Kajiado','Makueni','Kitui','Tana River','Lamu',
  'Taita Taveta','Kwale','Mandera','Wajir','Moyale','Bomet','Kericho','Narok'
].sort()

function SupplierModal({ supplier, onClose, onSave }) {
  const [form, setForm] = useState(supplier ? { ...supplier } : emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.phone) { setError('Name and phone are required'); return }
    setLoading(true)
    try {
      if (supplier) await api.suppliers.update(supplier.slug, form)
      else await api.suppliers.create(form)
      onSave()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3>{supplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Supplier / Company Name *</label>
              <input className="form-control" placeholder="e.g. Medipharm Kenya Ltd" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input className="form-control" placeholder="e.g. John Kamau" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="form-control" placeholder="0712 345 678" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" placeholder="supplier@company.co.ke" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">County</label>
              <select className="form-control" value={form.county} onChange={e => set('county', e.target.value)}>
                <option value="">— Select County —</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} placeholder="Street address, building, floor…" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                <span className="form-label" style={{ margin: 0 }}>Active Supplier</span>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : supplier ? 'Save Changes' : 'Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [countyFilter, setCountyFilter] = useState('')

  const loadAll = () => {
    setLoading(true)
    const params = {}
    if (search) params.search = search
    if (countyFilter) params.county = countyFilter
    api.suppliers.list(params)
      .then(data => setSuppliers(data.results || data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [search, countyFilter])

  const handleDelete = async () => {
    try {
      await api.suppliers.delete(deleteConfirm.slug)
      setDeleteConfirm(null)
      loadAll()
    } catch (e) { alert(e.message) }
  }

  const activeCount = suppliers.filter(s => s.is_active).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p>{suppliers.length} suppliers · {activeCount} active</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <i className="bi bi-plus-lg" /> Add Supplier
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Suppliers', value: suppliers.length, icon: 'bi-building', color: 'var(--primary)' },
          { label: 'Active', value: activeCount, icon: 'bi-check-circle', color: 'var(--success)' },
          { label: 'Inactive', value: suppliers.length - activeCount, icon: 'bi-x-circle', color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + '15', color: s.color }}>
              <i className={`bi ${s.icon}`} />
            </div>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="d-flex gap-3 mb-4">
        <div className="search-bar" style={{ flex: 1 }}>
          <i className="bi bi-search" />
          <input className="form-control" placeholder="Search by name, contact, or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-control" style={{ width: 180 }} value={countyFilter} onChange={e => setCountyFilter(e.target.value)}>
          <option value="">All Counties</option>
          {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th>County</th>
              <th>Products</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--gray-300)' }}>
                <i className="bi bi-building" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />No suppliers found
              </td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.address && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.address.slice(0, 40)}{s.address.length > 40 ? '…' : ''}</div>}
                </td>
                <td>{s.contact_person || '—'}</td>
                <td>
                  {s.phone && (
                    <a href={`tel:${s.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                      <i className="bi bi-telephone" style={{ marginRight: 4 }} />{s.phone}
                    </a>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>
                  {s.email ? <a href={`mailto:${s.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.email}</a> : '—'}
                </td>
                <td>{s.county || '—'}</td>
                <td>
                  <span className="badge badge-gray">{s.product_count || 0} products</span>
                </td>
                <td>
                  {s.is_active
                    ? <span className="badge badge-success">Active</span>
                    : <span className="badge badge-gray">Inactive</span>}
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(s)} title="Edit">
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm" title="Delete"
                      style={{ borderColor: 'var(--danger-light)', color: 'var(--danger)', background: 'var(--danger-light)' }}
                      onClick={() => setDeleteConfirm(s)}>
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
        <SupplierModal
          supplier={editing}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSave={() => { setShowAdd(false); setEditing(null); loadAll() }}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header"><h3>Delete Supplier</h3></div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
              {deleteConfirm.product_count > 0 && (
                <div className="alert alert-warning">
                  <i className="bi bi-exclamation-triangle" style={{ marginRight: 8 }} />
                  This supplier has {deleteConfirm.product_count} linked product(s). Those products will lose their supplier reference.
                </div>
              )}
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