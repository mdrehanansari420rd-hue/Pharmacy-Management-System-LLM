import React from "react";

const HD_IMAGES = {
  'Paracetamol 500mg': 'https://5.imimg.com/data5/SELLER/Default/2021/12/LK/ON/KX/43755673/paracetamol-500mg-tablet.jpg',
  'Amoxicillin 250mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4rUTmsSq76nvUcBf61uKp_7OeEcVOd2k1piSEyIZ22gyaIE1fkDwIXH5o&s=10',
  'Vitamin C Tablets': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSgJ6rVMTnEXt1YrNnunSTotYLiOlIEf6_L9awE2iDKOQZ5runhzkrDxqk&s=10',
  'Cough Syrup': 'https://wockhardtepharmacy.com/wp-content/uploads/2022/03/zedex-cough-syrup.jpg',
  'Ibuprofen 400mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzr8D_m3qeaaTXvWjn0CWvpNx-8k2NiXJ-ApWi2xcVAaUgQ8FfZy3iDfER&s=10',
  'Insulin Pen': 'https://images.apollo247.in/pub/media/catalog/product/n/o/nov0022.jpg?tr=q-80,f-webp,w-400,dpr-3,c-at_max%20400w',
  'Dolo 650 Tablet': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXZCpgj_NFqKc4Ho3F-72HZ2AHCadPpkqKDXCIB7bSE9K9oKfttQHtTD4&s=10',
  'Cetirizine 10mg': 'https://medino-product.imgix.net/teva-cetirizine-10mg-hay-fever-allergy-relief-30-tablets-b9ce9411.png?h=467&bg=FFF&auto=format,compress&q=60',
  'Azithromycin 500mg': 'https://5.imimg.com/data5/SELLER/Default/2024/9/449844947/GJ/KT/XF/15668789/azithromycin-500-mg-tablets-500x500.jpg',
  'Pantoprazole 40mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8OftC6_tJzZOKDSLed2OyYeN6APr2xzUIVIVg-BTMFQ&s=10',
  'Omeprazole 20mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNudyy_kAKAa3qWWrT0eW2bNNd0S-56lZSyz0ZR_OTW_plLZd8e2GNbG0&s=10',
  'Metformin 500mg': 'https://5.imimg.com/data5/SELLER/Default/2024/4/407065514/UV/CF/EI/217937612/okamet-500-metformin-3-500x500.jpg',
  'Amlodipine 5mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrHl4l9Bj0JQr_fndoCiQ1Gr1HBUG2S_mB6SjNnT9wFlUQteyPWtuK2Sus&s=10',
  'Atorvastatin 10mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiDtMS5l8uxJboGjtKNQUjVXU1uqrsDM-vbODhKwbr7g&s=10',
  'Aspirin 75mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRw2ZyzpxwtQvSVZH6AW4RVfjASW2BJH8sBSsKYzPpyemTV-v3d3IUaE14&s=10',
  'Montelukast 10mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgYpDZpGwxq3tYdEvvujwUsMWUdDid4_U0t8lWbHJiU8908gLO0igmvqro&s=10',
  'Disprin Tablet': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR80nc8Wo2KLv6EgZEG_JcW773MWyLHEVtZ0ID9pPzu_efkZLT4YCxiuNzy&s=10',
  'Combiflam Tablet': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQ0aWYiJ6W3Eb5LpM4L6MhKOuKCl7LvTsgICU69rB3zwmetZouCEbkX9I&s=10',
  'Becosules Capsule': 'https://onemg.gumlet.io/l_watermark_346/a_ignore,c_fit,q_auto,f_auto/69e588a556b54334af736fc860e1e057.jpg',
  'Shelcal 500mg': 'https://cdn01.pharmeasy.in/dam/products_otc/159115/shelcal-500mg-strip-of-15-tablets-6.1-1766498211.jpg',
  'Liv.52 Tablet': 'https://cdn01.pharmeasy.in/dam/products_otc/105920/himalaya-liv52-tablets-100s-6.5-1748863395.jpg',
  'ORS Powder Sachet': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQv0FwiqxnEnh8owj-Ad9k5oburNF0Wkb4Yij2PG9eVKp7yI2hIz0Dr78UZ&s=10',
  'Allegra 120mg': 'https://www.apollopharmacy.in/catalog/product/a/l/allegra_120_1.jpg',
  'Pan D Capsule': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTILTrHIEQU_2hoNZlFNXfVmw3yd1Cpt1xIIrFX9aEzxA&s=10',
  'Taxim-O 200mg': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1rRhp7QnHtNokWv0m8axdmhUmPZIJmaqVqG8K5IKm-RsuKi3lGvAU1_w&s=10',
  'Augmentin 625 Duo': 'https://5.imimg.com/data5/SELLER/Default/2024/4/412063072/LW/CM/MO/44153686/augmentin-625-tablet.jpg',
  'Gelusil Syrup': 'https://www.apollopharmacy.in/catalog/product/G/E/GEL0002_3_1.jpg',
  'Vicks VapoRub': 'https://cdn01.pharmeasy.in/dam/products_otc/181135/vicks-vaporub-25ml-relief-from-cold-cough-headache-and-body-pain-2-1755070449.jpg',
  'Strepsils Lozenges': 'https://cdn01.pharmeasy.in/dam/products_otc/J73374/strepsils-ginger-and-lemon-flavour-jar-120-8-free-lozenges-6.1-1775912514.jpg',
  'Benadryl Cough Syrup': 'https://images.ctfassets.net/00ko9qtwe33b/4gVUt0H0AqpRhg9LXV3Vge/90d99c026eeee9b6408c8ad42b9f9782/bottle_2-en-in',
  'Clavam 625mg': 'https://cdn01.pharmeasy.in/dam/productsnowatermark/042840/clavam-625mg-strip-of-10-tablets-box-front-1-1756894273-non-watermarked.jpg',
  'Glycomet-GP 1': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRinjXujFEeWqKjTPWrGWm0nQiCxsUH9tqFd777-elc6g&s=10'
};

export default function MedicineCard({ med, medicine, addToCart, onAddToCart }) {
  const product = med || medicine || {};
  const addFn = addToCart || onAddToCart || (() => {});

  const name = product.name || "Medicine Name";
  const category = product.category || "General";
  const description = product.description || "Trusted healthcare medicine.";
  const image = HD_IMAGES[name] || product.image || product.image_url || "https://via.placeholder.com/150";
  
  const price = Number(product.price || 0);
  const discount = Number(product.discount || product.discount_percent || 0);
  const stock = Number(product.stock || 0);
  const isAvailable = stock > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #f3f4f6',
      borderRadius: '16px',
      padding: '16px',
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      width: '100%',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      
      {/* Product Image */}
      <div style={{ height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
        <img src={image} alt={name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {/* Medicine Name */}
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f4a66', lineHeight: '1.2' }}>
          {name}
        </h3>
        
        {/* Category */}
        <span style={{ fontSize: '13px', color: '#0284c7', marginBottom: '8px' }}>
          {category}
        </span>
        
        {/* Description */}
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {description}
        </p>

        {/* Price & Discount */}
        <div style={{ fontSize: '14px', color: '#111827', marginBottom: '4px' }}>
          Rs {price} {discount > 0 && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>-{discount}%</span>}
        </div>
        
        {/* Stock */}
        <div style={{ fontSize: '13px', color: '#16a34a', marginBottom: '16px' }}>
          Stock: {stock}
        </div>
      </div>

      {/* Add to Cart Button */}
      <button 
        onClick={() => addFn(product)} 
        disabled={!isAvailable} 
        style={{ 
          width: '100%',
          padding: '10px', 
          backgroundColor: isAvailable ? '#0ea5e9' : '#e5e7eb', 
          color: isAvailable ? '#ffffff' : '#9ca3af', 
          border: 'none', 
          borderRadius: '8px', 
          fontSize: '14px', 
          fontWeight: 'bold', 
          cursor: isAvailable ? 'pointer' : 'not-allowed',
          marginTop: 'auto'
        }}
      >
        Add to Cart
      </button>
    </div>
  );
}