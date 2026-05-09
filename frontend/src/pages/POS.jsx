import { useState, useEffect, useRef, useCallback } from 'react'
import { api, fmt } from '../utils/api'

function Receipt({ sale, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3><i className="bi bi-receipt" style={{ marginRight: 8 }} />Receipt</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div className="receipt">
            <div className="receipt-header">
              <div style={{ fontSize: 16, fontWeight: 700 }}>🏥 PharmaTrack</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Nairobi, Kenya · Tel: 0700 000 000</div>
              <div style={{ marginTop: 8 }}>Receipt #{sale.receipt_number}</div>
              <div style={{ fontSize: 10, color: '#666' }}>{fmt.datetime(sale.created_at)}</div>
            </div>
            <div className="receipt-row" style={{ marginBottom: 8 }}>
              <span>Served by:</span><span>{sale.served_by_name}</span>
            </div>
            {sale.customer_name && (
              <div className="receipt-row" style={{ marginBottom: 8 }}>
                <span>Customer:</span><span>{sale.customer_name}</span>
              </div>
            )}
            <hr className="receipt-divider" />
            {sale.items?.map((item, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                <div className="receipt-row">
                  <span>{item.quantity} × {fmt.currency(item.unit_price)}</span>
                  <span>{fmt.currency(item.total_price)}</span>
                </div>
              </div>
            ))}
            <hr className="receipt-divider" />
            <div className="receipt-row"><span>Subtotal:</span><span>{fmt.currency(sale.subtotal)}</span></div>
            {sale.discount > 0 && <div className="receipt-row"><span>Discount:</span><span>-{fmt.currency(sale.discount)}</span></div>}
            {sale.tax > 0 && <div className="receipt-row"><span>Tax:</span><span>{fmt.currency(sale.tax)}</span></div>}
            <hr className="receipt-divider" />
            <div className="receipt-row receipt-total"><span>TOTAL:</span><span>{fmt.currency(sale.total_amount)}</span></div>
            <div className="receipt-row"><span>Paid ({sale.payment_method?.toUpperCase()}):</span><span>{fmt.currency(sale.amount_paid)}</span></div>
            {sale.change_given > 0 && <div className="receipt-row"><span>Change:</span><span>{fmt.currency(sale.change_given)}</span></div>}
            {sale.mpesa_reference && <div className="receipt-row" style={{ fontSize: 10 }}><span>M-Pesa Ref:</span><span>{sale.mpesa_reference}</span></div>}
            <hr className="receipt-divider" style={{ marginTop: 16 }} />
            <div style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
              Thank you for shopping with us!<br />
              Asante kwa kununua nasi! 🇰🇪
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            <i className="bi bi-printer" /> Print
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            New Sale
          </button>
        </div>
      </div>
    </div>
  )
}

export default function POS() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [mpesaLoading, setMpesaLoading] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [error, setError] = useState('')
  const searchRef = useRef()

  // Load products on search
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.length >= 1) {
        api.products.searchPOS(search).then(setProducts)
      } else {
        api.products.list({ is_active: true }).then(r => setProducts(r.results || r))
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    api.products.list({ is_active: true }).then(r => setProducts(r.results || r))
    searchRef.current?.focus()
  }, [])

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) return
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock_quantity) return prev
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1, unit_price: parseFloat(product.selling_price) }]
    })
  }

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.product.id !== productId))
  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i
      const newQty = i.quantity + delta
      if (newQty <= 0) return null
      if (newQty > i.product.stock_quantity) return i
      return { ...i, quantity: newQty }
    }).filter(Boolean))
  }

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const total = Math.max(0, subtotal - parseFloat(discount || 0))
  const change = parseFloat(amountPaid || 0) - total

  const searchCustomers = async (q) => {
    if (q.length < 3) { setCustomerResults([]); return }
    const r = await api.customers.search(q)
    setCustomerResults(r.results || r)
  }

  const initiatePayment = async () => {
    if (paymentMethod === 'mpesa') {
      if (!mpesaPhone) { setError('Enter M-Pesa phone number'); return }
      setMpesaLoading(true)
      try {
        const res = await api.mpesa.stkPush(mpesaPhone, total.toFixed(2))
        if (res.dev_mode) {
          alert(`[DEV MODE] ${res.message}\nIn production, customer will receive STK push.`)
        }
      } catch (e) { setError(e.message) }
      finally { setMpesaLoading(false) }
    }
  }

  const completeSale = async () => {
    if (cart.length === 0) { setError('Add items to cart first'); return }
    if (paymentMethod === 'cash' && parseFloat(amountPaid || 0) < total) {
      setError('Amount paid is less than total'); return
    }
    setLoading(true); setError('')
    try {
      const payload = {
        customer: customer?.id || null,
        payment_method: paymentMethod,
        mpesa_reference: paymentMethod === 'mpesa' ? mpesaPhone : '',
        subtotal: subtotal.toFixed(2),
        discount: parseFloat(discount || 0).toFixed(2),
        tax: '0.00',
        total_amount: total.toFixed(2),
        amount_paid: paymentMethod === 'cash' ? parseFloat(amountPaid).toFixed(2) : total.toFixed(2),
        change_given: paymentMethod === 'cash' ? Math.max(0, change).toFixed(2) : '0.00',
        items: cart.map(i => ({
          product: i.product.id,
          quantity: i.quantity,
          unit_price: i.unit_price.toFixed(2),
          buying_price: i.product.buying_price || '0.00',
          discount: '0.00',
        }))
      }
      const sale = await api.sales.create(payload)
      const fullSale = await api.sales.receipt(sale.slug)
      setCompletedSale(fullSale)
      setCart([]); setCustomer(null); setAmountPaid(''); setDiscount(0); setMpesaPhone('')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (completedSale) {
    return <Receipt sale={completedSale} onClose={() => setCompletedSale(null)} />
  }

  return (
    <div className="pos-layout">
      {/* Products panel */}
      <div className="pos-products">
        <div className="search-bar mb-4">
          <i className="bi bi-search" />
          <input ref={searchRef} className="form-control w-full" placeholder="Search medicine by name or barcode…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="product-grid">
          {products.map(p => (
            <div key={p.id}
              className={`product-card ${p.stock_quantity <= 0 ? 'out-of-stock' : ''}`}
              onClick={() => addToCart(p)}>
              <div className="product-card-name">{p.name}</div>
              {p.generic_name && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>{p.generic_name}</div>}
              <div className="product-card-price">{fmt.currency(p.selling_price)}</div>
              <div className="product-card-stock">
                {p.stock_quantity > 0
                  ? <><i className="bi bi-check-circle-fill" style={{ color: 'var(--success)', marginRight: 3 }} />{p.stock_quantity} in stock</>
                  : <><i className="bi bi-x-circle-fill" style={{ color: 'var(--danger)', marginRight: 3 }} />Out of stock</>
                }
              </div>
              {p.requires_prescription && (
                <div style={{ marginTop: 4 }}>
                  <span className="badge badge-warning" style={{ fontSize: 10 }}><i className="bi bi-file-earmark-medical" /> Rx</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="card pos-cart" style={{ borderRadius: 'var(--radius-lg)', padding: 0 }}>
        {/* Cart header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--gray-100)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            <i className="bi bi-cart3" style={{ marginRight: 8, color: 'var(--primary)' }} />
            Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})
          </div>
          {/* Customer lookup */}
          <div style={{ position: 'relative' }}>
            <div className="search-bar">
              <i className="bi bi-person-circle" />
              <input className="form-control w-full" style={{ fontSize: 13 }}
                placeholder="Search customer (optional)…"
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); searchCustomers(e.target.value) }} />
            </div>
            {customerResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
                border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 10 }}>
                {customerResults.map(c => (
                  <div key={c.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                    onClick={() => { setCustomer(c); setCustomerSearch(c.name); setCustomerResults([]) }}>
                    <strong>{c.name}</strong> · {c.phone}
                  </div>
                ))}
              </div>
            )}
          </div>
          {customer && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-primary"><i className="bi bi-person-check" /> {customer.name}</span>
              <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px' }}
                onClick={() => { setCustomer(null); setCustomerSearch('') }}>
                <i className="bi bi-x" />
              </button>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-300)' }}>
              <i className="bi bi-cart" style={{ fontSize: 48 }} />
              <div style={{ marginTop: 8, fontSize: 13 }}>Click a product to add it</div>
            </div>
          ) : cart.map(item => (
            <div key={item.product.id} className="cart-item">
              <div style={{ flex: 1 }}>
                <div className="cart-item-name">{item.product.name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{fmt.currency(item.unit_price)} each</div>
              </div>
              <div className="qty-control">
                <button className="qty-btn" onClick={() => updateQty(item.product.id, -1)}>−</button>
                <span className="qty-display">{item.quantity}</span>
                <button className="qty-btn" onClick={() => updateQty(item.product.id, 1)}>+</button>
              </div>
              <div className="cart-item-price">{fmt.currency(item.unit_price * item.quantity)}</div>
              <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', color: 'var(--danger)' }}
                onClick={() => removeFromCart(item.product.id)}>
                <i className="bi bi-trash3" />
              </button>
            </div>
          ))}
        </div>

        {/* Totals & payment */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-100)' }}>
          {error && <div className="alert alert-danger" style={{ marginBottom: 10, padding: '8px 12px' }}>{error}</div>}

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--gray-500)' }}>Subtotal</span>
              <span>{fmt.currency(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--gray-500)', flex: 1 }}>Discount (KES)</span>
              <input className="form-control" type="number" min="0" style={{ width: 90, fontSize: 13, padding: '4px 8px' }}
                value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, marginTop: 8, padding: '8px 0', borderTop: '2px solid var(--gray-200)' }}>
              <span>Total</span>
              <span style={{ color: 'var(--primary)' }}>{fmt.currency(total)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {['cash', 'mpesa', 'card', 'insurance'].map(m => (
              <button key={m} className={`btn btn-sm ${paymentMethod === m ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPaymentMethod(m)}>
                <i className={`bi ${m === 'cash' ? 'bi-cash' : m === 'mpesa' ? 'bi-phone' : m === 'card' ? 'bi-credit-card' : 'bi-shield-check'}`} />
                {m === 'mpesa' ? 'M-Pesa' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="form-group">
              <input className="form-control" type="number" placeholder="Amount paid (KES)"
                value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
              {parseFloat(amountPaid) >= total && total > 0 && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  Change: {fmt.currency(Math.max(0, change))}
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'mpesa' && (
            <div>
              <div className="form-group">
                <input className="form-control" placeholder="Phone: 254712345678"
                  value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
              </div>
              <button className="btn btn-outline btn-sm w-full mb-3" onClick={initiatePayment} disabled={mpesaLoading}>
                {mpesaLoading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Sending…</> : <><i className="bi bi-phone" /> Send STK Push</>}
              </button>
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" onClick={completeSale} disabled={loading || cart.length === 0}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Processing…</> : <><i className="bi bi-check-circle" /> Complete Sale · {fmt.currency(total)}</>}
          </button>
        </div>
      </div>
    </div>
  )
}