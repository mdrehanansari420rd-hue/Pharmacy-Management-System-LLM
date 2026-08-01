import React from "react";

export default function MedicineCard({ med, addToCart }) {
  const originalPrice = Number(med.price || 0);
  const discount = Number(med.discount || med.discount_percent || 0);
  const discountedPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;
  const isAvailable = Number(med.stock || 0) > 0;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden p-4 relative">
      {/* Stock & Discount Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow ${isAvailable ? 'bg-green-600' : 'bg-red-500'}`}>
          {isAvailable ? `Stock: ${med.stock}` : 'Out of Stock'}
        </span>
        {discount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* Medicine Image Container */}
      <div className="relative w-full h-40 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden mb-3">
        <img
          src={med.image || med.image_url || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400"}
          alt={med.name}
          className="object-contain h-full w-full p-2 hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* Category */}
      <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">
        {med.category || "General"}
      </span>

      {/* Medicine Name */}
      <h3 className="font-bold text-gray-800 text-base line-clamp-1 mb-1" title={med.name}>
        {med.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-grow">
        {med.description || "Trusted healthcare medicine."}
      </p>

      {/* Pricing & Add to Cart Button */}
      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-extrabold text-gray-900">
              ₹{discountedPrice.toFixed(2)}
            </span>
            {discount > 0 && (
              <span className="text-xs text-gray-400 line-through">
                ₹{originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-500">Inclusive of all taxes</span>
        </div>

        <button
          onClick={() => addToCart(med)}
          disabled={!isAvailable}
          className={`text-sm font-semibold px-4 py-2 rounded-lg shadow-md transition-colors duration-200 flex items-center space-x-1 ${
            isAvailable 
              ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer" 
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          <span>{isAvailable ? "Add" : "Sold Out"}</span>
        </button>
      </div>
    </div>
  );
}

export default MedicineCard;