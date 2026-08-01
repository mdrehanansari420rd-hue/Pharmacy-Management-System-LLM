import React from "react";

export default function MedicineCard({ med, medicine, addToCart, onAddToCart }) {
  const product = med || medicine || {};
  const addFn = addToCart || onAddToCart || (() => {});

  const name = product.name || "Medicine Name";
  const image = product.image || product.image_url || "https://via.placeholder.com/150";
  const originalPrice = Number(product.price || 0);
  const discount = Number(product.discount || product.discount_percent || 0);
  const discountedPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
  const stock = Number(product.stock || 0);
  const isAvailable = stock > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '12px',
      backgroundColor: '#ffffff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      width: '100%',
      maxWidth: '220px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative'
    }}>
      
      {discount > 0 && (
        <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
          {discount}% OFF
        </div>
      )}

      <div style={{ height: '130px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
        <img src={image} alt={name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={name}>
            {name}
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>₹{discountedPrice.toFixed(2)}</span>
            {discount > 0 && (
              <span style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'line-through' }}>₹{originalPrice.toFixed(2)}</span>
            )}
          </div>
        </div>

        <button onClick={() => addFn(product)} disabled={!isAvailable} style={{ padding: '6px 16px', backgroundColor: isAvailable ? '#ff6f61' : '#e5e7eb', color: isAvailable ? '#ffffff' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: isAvailable ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
          {isAvailable ? 'ADD' : 'OUT'}
        </button>
      </div>
    </div>
  );
}