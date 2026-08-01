import { useState } from "react";
import MedicineCard from "../components/MedicineCard"; // Make sure this path matches your folder structure!

export default function Inventory({ medicines, addToCart, loading = false }) {
  const [search, setSearch] = useState("");

  const filteredMedicines = medicines.filter((medicine) =>
    `${medicine.name} ${medicine.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container" style={{ padding: 24 }}>
      <input
        className="search"
        placeholder="Search medicines or category"
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", maxWidth: 420, padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", marginBottom: 24 }}
      />

      {loading ? (
        <div>Loading inventory from database...</div>
      ) : (
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {filteredMedicines.map((medicine) => (
            <MedicineCard 
              key={medicine.id} 
              med={medicine} 
              addToCart={addToCart} 
            />
          ))}
        </div>
      )}
    </div>
  );
}