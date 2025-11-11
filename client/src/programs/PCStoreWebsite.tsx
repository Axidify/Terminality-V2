import React, { useState } from 'react'

import { getCachedDesktop, saveDesktopState } from '../services/saveService'
import './PCStoreWebsite.css'

interface Product {
  id: string
  name: string
  category: 'cpu' | 'ram' | 'gpu' | 'storage'
  level: number
  price: number
  specs: string
  description: string
}

const products: Product[] = [
  // CPUs
  { id: 'cpu1', name: 'Intel Core i3-10100', category: 'cpu', level: 2, price: 150, specs: '2.0 GHz', description: 'Entry-level quad-core processor' },
  { id: 'cpu2', name: 'Intel Core i5-11400', category: 'cpu', level: 3, price: 225, specs: '2.5 GHz', description: 'Mid-range 6-core processor' },
  { id: 'cpu3', name: 'AMD Ryzen 5 5600X', category: 'cpu', level: 4, price: 338, specs: '3.0 GHz', description: 'High-performance 6-core' },
  { id: 'cpu4', name: 'Intel Core i7-12700K', category: 'cpu', level: 5, price: 506, specs: '3.5 GHz', description: 'Premium 12-core processor' },
  { id: 'cpu5', name: 'AMD Ryzen 7 5800X3D', category: 'cpu', level: 6, price: 759, specs: '4.0 GHz', description: 'Gaming-focused 8-core' },
  { id: 'cpu6', name: 'Intel Core i9-13900K', category: 'cpu', level: 7, price: 1139, specs: '4.5 GHz', description: 'Flagship 24-core beast' },
  { id: 'cpu7', name: 'AMD Ryzen 9 7950X', category: 'cpu', level: 8, price: 1709, specs: '5.0 GHz', description: 'Extreme 16-core processor' },
  { id: 'cpu8', name: 'Intel Xeon W-3375', category: 'cpu', level: 9, price: 2563, specs: '5.5 GHz', description: 'Workstation 38-core' },
  { id: 'cpu9', name: 'AMD Threadripper PRO 5995WX', category: 'cpu', level: 10, price: 3845, specs: '6.0 GHz', description: 'Ultimate 64-core titan' },
  
  // RAM
  { id: 'ram1', name: 'Corsair Vengeance 4GB DDR4', category: 'ram', level: 2, price: 100, specs: '4 GB', description: 'Basic memory upgrade' },
  { id: 'ram2', name: 'G.Skill Ripjaws 8GB DDR4', category: 'ram', level: 3, price: 150, specs: '8 GB', description: 'Standard gaming RAM' },
  { id: 'ram3', name: 'Corsair Vengeance 16GB DDR4', category: 'ram', level: 4, price: 225, specs: '16 GB', description: 'Recommended for gaming' },
  { id: 'ram4', name: 'G.Skill Trident Z 32GB DDR4', category: 'ram', level: 5, price: 338, specs: '32 GB', description: 'Content creation ready' },
  { id: 'ram5', name: 'Corsair Dominator 64GB DDR5', category: 'ram', level: 6, price: 506, specs: '64 GB', description: 'Professional workstation' },
  { id: 'ram6', name: 'G.Skill Trident Z5 128GB DDR5', category: 'ram', level: 7, price: 759, specs: '128 GB', description: 'Heavy multitasking' },
  { id: 'ram7', name: 'Kingston Fury 256GB DDR5', category: 'ram', level: 8, price: 1139, specs: '256 GB', description: 'Server-grade memory' },
  { id: 'ram8', name: 'Crucial Pro 512GB DDR5', category: 'ram', level: 9, price: 1709, specs: '512 GB', description: 'Extreme workloads' },
  { id: 'ram9', name: 'Samsung 1TB DDR5 ECC', category: 'ram', level: 10, price: 2563, specs: '1 TB', description: 'Enterprise datacenter RAM' },
  
  // GPUs
  { id: 'gpu1', name: 'NVIDIA GTX 750 Ti', category: 'gpu', level: 2, price: 200, specs: 'GTX 750', description: 'Entry gaming card' },
  { id: 'gpu2', name: 'NVIDIA GTX 1050 Ti', category: 'gpu', level: 3, price: 300, specs: 'GTX 1050', description: '1080p gaming' },
  { id: 'gpu3', name: 'NVIDIA GTX 1660 Super', category: 'gpu', level: 4, price: 450, specs: 'GTX 1660', description: 'Solid 1080p performance' },
  { id: 'gpu4', name: 'NVIDIA RTX 2060', category: 'gpu', level: 5, price: 675, specs: 'RTX 2060', description: 'Ray tracing capable' },
  { id: 'gpu5', name: 'NVIDIA RTX 3060 Ti', category: 'gpu', level: 6, price: 1013, specs: 'RTX 3060', description: '1440p gaming beast' },
  { id: 'gpu6', name: 'NVIDIA RTX 3080', category: 'gpu', level: 7, price: 1519, specs: 'RTX 3080', description: '4K gaming ready' },
  { id: 'gpu7', name: 'NVIDIA RTX 4070 Ti', category: 'gpu', level: 8, price: 2279, specs: 'RTX 4070', description: 'Next-gen performance' },
  { id: 'gpu8', name: 'NVIDIA RTX 4090', category: 'gpu', level: 9, price: 3419, specs: 'RTX 4090', description: 'Flagship gaming GPU' },
  { id: 'gpu9', name: 'NVIDIA H100 Tensor Core', category: 'gpu', level: 10, price: 5128, specs: 'Quantum X1', description: 'AI/ML powerhouse' },
  
  // Storage
  { id: 'stor1', name: 'WD Blue 256GB SSD', category: 'storage', level: 2, price: 80, specs: '256 GB', description: 'Basic SSD storage' },
  { id: 'stor2', name: 'Samsung 870 EVO 512GB', category: 'storage', level: 3, price: 120, specs: '512 GB', description: 'Fast SATA SSD' },
  { id: 'stor3', name: 'Crucial P3 1TB NVMe', category: 'storage', level: 4, price: 180, specs: '1 TB', description: 'High-speed NVMe' },
  { id: 'stor4', name: 'Samsung 980 PRO 2TB', category: 'storage', level: 5, price: 270, specs: '2 TB', description: 'Premium NVMe drive' },
  { id: 'stor5', name: 'WD Black SN850X 4TB', category: 'storage', level: 6, price: 405, specs: '4 TB', description: 'Gaming optimized' },
  { id: 'stor6', name: 'Samsung 990 PRO 8TB', category: 'storage', level: 7, price: 608, specs: '8 TB', description: 'Massive fast storage' },
  { id: 'stor7', name: 'Sabrent Rocket 16TB', category: 'storage', level: 8, price: 911, specs: '16 TB', description: 'Content creator dream' },
  { id: 'stor8', name: 'Samsung PM9A3 32TB', category: 'storage', level: 9, price: 1367, specs: '32 TB', description: 'Enterprise NVMe' },
  { id: 'stor9', name: 'Micron 9400 64TB', category: 'storage', level: 10, price: 2050, specs: '64 TB', description: 'Datacenter grade SSD' },
]

export const PCStoreWebsite: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<Product[]>([])
  const [showCart, setShowCart] = useState(false)
  const cached = getCachedDesktop()

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory)

  const addToCart = (product: Product) => {
    setCart([...cart, product])
  }

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const getTotalPrice = () => {
    return cart.reduce((sum, p) => sum + p.price, 0)
  }

  const checkout = () => {
    if (cart.length === 0) {
      alert('Cart is empty!')
      return
    }

    const total = getTotalPrice()
    const currentCredits = Number(cached?.credits ?? 1000)
    
    if (currentCredits < total) {
      alert(`Insufficient credits! You need ${total} but only have ${currentCredits}.`)
      return
    }

    // Process upgrades
    cart.forEach(product => {
      const baseSpecs = cached?.computerSpecs || {}
      const specs = { ...baseSpecs }
      const componentKey = product.category
      if (!specs[componentKey]) specs[componentKey] = {}
      specs[componentKey].level = product.level
      const valueKey = product.category === 'cpu' ? 'speed' :
                      product.category === 'ram' ? 'size' :
                      product.category === 'gpu' ? 'model' : 'capacity'
      specs[componentKey][valueKey] = product.specs
      // Save updated specs optimistically
      saveDesktopState({ computerSpecs: specs }).catch(() => {})
    })

    // Deduct credits
    saveDesktopState({ credits: currentCredits - total }).catch(() => {})
    
    alert(`Purchase successful! ${cart.length} item(s) installed. ${total} credits spent.`)
    setCart([])
    setShowCart(false)
  }

  return (
    <div className="pc-store">
      {/* Header */}
      <header className="store-header">
        <div className="header-content">
          <h1 className="store-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            AXI PC STORE
          </h1>
          <nav className="store-nav">
            <button 
              className={selectedCategory === 'all' ? 'active' : ''}
              onClick={() => setSelectedCategory('all')}
            >
              All Products
            </button>
            <button 
              className={selectedCategory === 'cpu' ? 'active' : ''}
              onClick={() => setSelectedCategory('cpu')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                <rect x="9" y="9" width="6" height="6"/>
                <line x1="9" y1="1" x2="9" y2="4"/>
                <line x1="15" y1="1" x2="15" y2="4"/>
                <line x1="9" y1="20" x2="9" y2="23"/>
                <line x1="15" y1="20" x2="15" y2="23"/>
                <line x1="20" y1="9" x2="23" y2="9"/>
                <line x1="20" y1="14" x2="23" y2="14"/>
                <line x1="1" y1="9" x2="4" y2="9"/>
                <line x1="1" y1="14" x2="4" y2="14"/>
              </svg>
              CPUs
            </button>
            <button 
              className={selectedCategory === 'ram' ? 'active' : ''}
              onClick={() => setSelectedCategory('ram')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 9v6h20V9"/>
                <path d="M2 15h20"/>
                <path d="M6 9V6h12v3"/>
                <path d="M6 15v3h12v-3"/>
                <line x1="8" y1="9" x2="8" y2="15"/>
                <line x1="12" y1="9" x2="12" y2="15"/>
                <line x1="16" y1="9" x2="16" y2="15"/>
              </svg>
              RAM
            </button>
            <button 
              className={selectedCategory === 'gpu' ? 'active' : ''}
              onClick={() => setSelectedCategory('gpu')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 3l-4 4-4-4"/>
                <line x1="6" y1="11" x2="6" y2="17"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
                <line x1="18" y1="11" x2="18" y2="17"/>
              </svg>
              GPUs
            </button>
            <button 
              className={selectedCategory === 'storage' ? 'active' : ''}
              onClick={() => setSelectedCategory('storage')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                <line x1="2" y1="13" x2="22" y2="13"/>
                <line x1="2" y1="17" x2="22" y2="17"/>
                <path d="M6 9V5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v4"/>
              </svg>
              Storage
            </button>
          </nav>
          <button className="cart-button" onClick={() => setShowCart(!showCart)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            Cart ({cart.length})
          </button>
        </div>
      </header>

      {/* Banner */}
      <div className="store-banner">
        <h2>Upgrade Your System</h2>
        <p>Premium hardware components for maximum performance</p>
      </div>

      {/* Products Grid */}
      <div className="products-section">
        <div className="products-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-icon">
                {product.category === 'cpu' && (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                    <rect x="9" y="9" width="6" height="6"/>
                    <line x1="9" y1="1" x2="9" y2="4"/>
                    <line x1="15" y1="1" x2="15" y2="4"/>
                    <line x1="9" y1="20" x2="9" y2="23"/>
                    <line x1="15" y1="20" x2="15" y2="23"/>
                    <line x1="20" y1="9" x2="23" y2="9"/>
                    <line x1="20" y1="14" x2="23" y2="14"/>
                    <line x1="1" y1="9" x2="4" y2="9"/>
                    <line x1="1" y1="14" x2="4" y2="14"/>
                  </svg>
                )}
                {product.category === 'ram' && (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 9v6h20V9"/>
                    <path d="M2 15h20"/>
                    <path d="M6 9V6h12v3"/>
                    <path d="M6 15v3h12v-3"/>
                    <line x1="8" y1="9" x2="8" y2="15"/>
                    <line x1="12" y1="9" x2="12" y2="15"/>
                    <line x1="16" y1="9" x2="16" y2="15"/>
                  </svg>
                )}
                {product.category === 'gpu' && (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 3l-4 4-4-4"/>
                    <line x1="6" y1="11" x2="6" y2="17"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                    <line x1="18" y1="11" x2="18" y2="17"/>
                  </svg>
                )}
                {product.category === 'storage' && (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                    <line x1="2" y1="13" x2="22" y2="13"/>
                    <line x1="2" y1="17" x2="22" y2="17"/>
                    <path d="M6 9V5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v4"/>
                  </svg>
                )}
              </div>
              <h3 className="product-name">{product.name}</h3>
              <div className="product-specs">{product.specs}</div>
              <p className="product-description">{product.description}</p>
              <div className="product-level">Level {product.level} Component</div>
              <div className="product-footer">
                <div className="product-price">{product.price} CR</div>
                <button 
                  className="add-to-cart-btn"
                  onClick={() => addToCart(product)}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Shopping Cart Modal */}
      {showCart && (
        <div className="cart-modal">
          <div className="cart-content">
            <div className="cart-header">
              <h2>Shopping Cart</h2>
              <button className="close-cart" onClick={() => setShowCart(false)}>❌</button>
            </div>
            <div className="cart-items">
              {cart.length === 0 ? (
                <p className="empty-cart">Your cart is empty</p>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="cart-item">
                    <div className="cart-item-info">
                      <strong>{item.name}</strong>
                      <span className="cart-item-specs">{item.specs}</span>
                    </div>
                    <div className="cart-item-actions">
                      <span className="cart-item-price">{item.price} CR</span>
                      <button onClick={() => removeFromCart(idx)}>[DEL]</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-total">
                  <strong>Total:</strong>
                  <strong>{getTotalPrice()} CR</strong>
                </div>
                <button className="checkout-btn" onClick={checkout}>
                  Complete Purchase
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
