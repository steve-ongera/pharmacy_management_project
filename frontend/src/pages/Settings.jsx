import { useState, useEffect } from 'react'
import { getUser } from '../utils/api'

const DEFAULT_SETTINGS = {
  pharmacy_name: 'My Pharmacy',
  pharmacy_address: '',
  pharmacy_phone: '',
  pharmacy_email: '',
  tax_rate: 0,
  currency: 'KES',
  receipt_footer: 'Thank you for choosing us. Stay healthy!',
  low_stock_alert: true,
  expiry_alert: true,
  expiry_alert_days: 30,
  mpesa_shortcode: '',
  mpesa_dev_mode: true,
}

export default function Settings() {
  const user = getUser()
  const isOwner = user?.role === 'owner'

  const [settings, setSettings] = useState(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('pharma_settings') || '{}') }
    } catch { return DEFAULT_SETTINGS }
  })
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  const handleSave = () => {
    localStorage.setItem('pharma_settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!isOwner) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <i className="bi bi-lock" style={{ fontSize: 48, color: 'var(--gray-300)' }} />
        <h3 style={{ marginTop: 16, color: 'var(--gray-400)' }}>Access Restricted</h3>
        <p style={{ color: 'var(--gray-300)' }}>Only the pharmacy owner can access settings.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Configure your pharmacy system preferences</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><i className="bi bi-check-lg" style={{ marginRight: 6 }} />Saved!</> : <><i className="bi bi-floppy" style={{ marginRight: 6 }} />Save Settings</>}
        </button>
      </div>

      {saved && <div className="alert alert-success mb-4"><i className="bi bi-check-circle" style={{ marginRight: 8 }} />Settings saved successfully.</div>}

      {/* Pharmacy Info */}
      <div className="card mb-4">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-hospital" style={{ marginRight: 8, color: 'var(--primary)' }} />Pharmacy Information</h4>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Pharmacy Name</label>
              <input className="form-control" value={settings.pharmacy_name} onChange={e => set('pharmacy_name', e.target.value)} placeholder="e.g. Nairobi Pharmacy" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-control" value={settings.pharmacy_phone} onChange={e => set('pharmacy_phone', e.target.value)} placeholder="0712 345 678" />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" value={settings.pharmacy_email} onChange={e => set('pharmacy_email', e.target.value)} placeholder="info@pharmacy.co.ke" />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} value={settings.pharmacy_address} onChange={e => set('pharmacy_address', e.target.value)} placeholder="Street, Town, County" />
            </div>
          </div>
        </div>
      </div>

      {/* POS & Billing */}
      <div className="card mb-4">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-receipt" style={{ marginRight: 8, color: 'var(--primary)' }} />POS & Billing</h4>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select className="form-control" value={settings.currency} onChange={e => set('currency', e.target.value)}>
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="USD">USD — US Dollar</option>
                <option value="UGX">UGX — Ugandan Shilling</option>
                <option value="TZS">TZS — Tanzanian Shilling</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tax Rate (%)</label>
              <input className="form-control" type="number" min="0" max="100" step="0.1"
                value={settings.tax_rate} onChange={e => set('tax_rate', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Receipt Footer Message</label>
              <textarea className="form-control" rows={2} value={settings.receipt_footer}
                onChange={e => set('receipt_footer', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="card mb-4">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-bell" style={{ marginRight: 8, color: 'var(--primary)' }} />Alerts & Notifications</h4>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.low_stock_alert} onChange={e => set('low_stock_alert', e.target.checked)} />
              <div>
                <div style={{ fontWeight: 600 }}>Low Stock Alerts</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Show warning when products fall at or below reorder level</div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={settings.expiry_alert} onChange={e => set('expiry_alert', e.target.checked)} />
              <div>
                <div style={{ fontWeight: 600 }}>Expiry Alerts</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Warn when medicines are nearing their expiry date</div>
              </div>
            </label>
            {settings.expiry_alert && (
              <div className="form-group" style={{ maxWidth: 240, marginLeft: 28 }}>
                <label className="form-label">Alert Days Before Expiry</label>
                <input className="form-control" type="number" min="1" max="365"
                  value={settings.expiry_alert_days} onChange={e => set('expiry_alert_days', parseInt(e.target.value) || 30)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* M-Pesa */}
      <div className="card mb-4">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-phone" style={{ marginRight: 8, color: '#00a651' }} />M-Pesa Configuration</h4>
        </div>
        <div className="card-body">
          <div style={{ padding: '12px 16px', borderRadius: 8, background: settings.mpesa_dev_mode ? 'var(--warning-light)' : 'var(--success-light)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <i className={`bi bi-${settings.mpesa_dev_mode ? 'exclamation-triangle' : 'check-circle'}`} />
            {settings.mpesa_dev_mode ? 'Dev Mode ON — STK push is simulated. No real transactions.' : 'Production Mode — Real M-Pesa transactions active.'}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={settings.mpesa_dev_mode} onChange={e => set('mpesa_dev_mode', e.target.checked)} />
            <div>
              <div style={{ fontWeight: 600 }}>Developer Mode (Bypass STK Push)</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Disable for production use with real Daraja credentials</div>
            </div>
          </label>
          {!settings.mpesa_dev_mode && (
            <div className="form-group">
              <label className="form-label">M-Pesa Shortcode / Till Number</label>
              <input className="form-control" value={settings.mpesa_shortcode} onChange={e => set('mpesa_shortcode', e.target.value)} placeholder="e.g. 174379" />
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
            <i className="bi bi-info-circle" style={{ marginRight: 4 }} />
            Full Daraja credentials (consumer key, secret, passkey) are configured in the Django <code>settings.py</code> environment variables.
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="card">
        <div className="card-header">
          <h4 style={{ margin: 0 }}><i className="bi bi-cpu" style={{ marginRight: 8, color: 'var(--gray-400)' }} />System Information</h4>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            {[
              ['System', 'PharmaTrack v1.0'],
              ['Built for', 'Kenyan Pharmacies'],
              ['Backend', 'Django REST Framework'],
              ['Frontend', 'React 18 + Vite'],
              ['Payments', 'Safaricom Daraja M-Pesa'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--gray-400)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}