import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const {
  MYSQL_HOST = "localhost",
  MYSQL_PORT = "3306",
  MYSQL_USER = "root",
  MYSQL_PASSWORD = "", 
  MYSQL_DATABASE = "pharmacy_app",
} = process.env;

export const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false },
});

export async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
        name VARCHAR(120) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        phone VARCHAR(20) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        profile_photo LONGTEXT NULL,
        business_name VARCHAR(160) NULL,
        business_address VARCHAR(255) NULL,
        verification_document VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const [profilePhotoColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_photo'`,
      [MYSQL_DATABASE]
    );
    if (profilePhotoColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN profile_photo LONGTEXT NULL");
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_otps (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        purpose ENUM('login', 'password_reset') NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_auth_otps_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicines (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(160) NOT NULL,
        category VARCHAR(120) NOT NULL,
        description TEXT NULL,
        image_url VARCHAR(255) NULL,
        price DECIMAL(10,2) NOT NULL,
        discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_partners (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        active_order_count INT NOT NULL DEFAULT 0,
        completed_order_count INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_partners (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_type ENUM('seller', 'supplier') NOT NULL,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(20) NULL,
        location VARCHAR(120) NULL,
        rating DECIMAL(3,2) NOT NULL DEFAULT 4.50,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS procurement_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_id INT NOT NULL,
        vendor_type ENUM('seller', 'supplier') NOT NULL,
        source ENUM('seller-order', 'restock', 'emergency') NOT NULL,
        status ENUM('Pending', 'Approved', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
        urgency ENUM('low', 'medium', 'high') NULL,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        notes VARCHAR(255) NULL,
        created_by_user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_procurement_orders_vendor
          FOREIGN KEY (vendor_id) REFERENCES vendor_partners(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_procurement_orders_user
          FOREIGN KEY (created_by_user_id) REFERENCES users(id)
          ON DELETE SET NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS procurement_order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        procurement_order_id INT NOT NULL,
        medicine_id INT NOT NULL,
        medicine_name VARCHAR(160) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_procurement_order_items_order
          FOREIGN KEY (procurement_order_id) REFERENCES procurement_orders(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_procurement_order_items_medicine
          FOREIGN KEY (medicine_id) REFERENCES medicines(id)
          ON DELETE RESTRICT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS discount_campaigns (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(160) NOT NULL,
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        min_quantity INT NULL,
        valid_until DATE NULL,
        promo_code VARCHAR(80) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS discount_campaign_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        campaign_id INT NOT NULL,
        medicine_id INT NOT NULL,
        original_price DECIMAL(10,2) NOT NULL,
        applied_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        discounted_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_discount_campaign_items_campaign
          FOREIGN KEY (campaign_id) REFERENCES discount_campaigns(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_discount_campaign_items_medicine
          FOREIGN KEY (medicine_id) REFERENCES medicines(id)
          ON DELETE RESTRICT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        delivery_partner_id INT NULL,
        status ENUM('Processing', 'Out for Delivery', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Processing',
        payment_method ENUM('cod', 'upi', 'card') NOT NULL,
        payment_status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
        subtotal DECIMAL(10,2) NOT NULL,
        discount_total DECIMAL(10,2) NOT NULL DEFAULT 0,
        delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        address_label VARCHAR(80) NOT NULL,
        address_details VARCHAR(255) NOT NULL,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_orders_user
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_orders_delivery_partner
          FOREIGN KEY (delivery_partner_id) REFERENCES delivery_partners(id)
          ON DELETE SET NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NOT NULL,
        medicine_id INT NOT NULL,
        medicine_name VARCHAR(160) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        quantity INT NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id) REFERENCES orders(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_order_items_medicine
          FOREIGN KEY (medicine_id) REFERENCES medicines(id)
          ON DELETE RESTRICT
      )
    `);

    // Complete list of 32 medicines with YOUR professional images!
    const medicinesData = [
      ['Paracetamol 500mg', 'Pain Relief', 'Fast relief for fever and mild pain.', 'https://5.imimg.com/data5/SELLER/Default/2021/12/LK/ON/KX/43755673/paracetamol-500mg-tablet.jpg', 25.00, 10, 120],
      ['Amoxicillin 250mg', 'Antibiotics', 'Prescription antibiotic for bacterial infections.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4rUTmsSq76nvUcBf61uKp_7OeEcVOd2k1piSEyIZ22gyaIE1fkDwIXH5o&s=10', 45.00, 5, 90],
      ['Vitamin C Tablets', 'Vitamins', 'Daily immunity support tablets.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRSgJ6rVMTnEXt1YrNnunSTotYLiOlIEf6_L9awE2iDKOQZ5runhzkrDxqk&s=10', 120.00, 15, 160],
      ['Cough Syrup', 'Cough & Cold', 'Syrup for dry and wet cough relief.', 'https://wockhardtepharmacy.com/wp-content/uploads/2022/03/zedex-cough-syrup.jpg', 85.00, 8, 75],
      ['Ibuprofen 400mg', 'Pain Relief', 'Anti-inflammatory tablets for pain relief.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzr8D_m3qeaaTXvWjn0CWvpNx-8k2NiXJ-ApWi2xcVAaUgQ8FfZy3iDfER&s=10', 35.00, 0, 140],
      ['Insulin Pen', 'Diabetes Care', 'Insulin delivery pen for diabetes management.', 'https://images.apollo247.in/pub/media/catalog/product/n/o/nov0022.jpg?tr=q-80,f-webp,w-400,dpr-3,c-at_max%20400w', 450.00, 12, 35],
      ['Dolo 650 Tablet', 'Pain Relief', 'Trusted fever and body ache relief.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXZCpgj_NFqKc4Ho3F-72HZ2AHCadPpkqKDXCIB7bSE9K9oKfttQHtTD4&s=10', 32.12, 25, 200],
      ['Cetirizine 10mg', 'Antiallergic', 'Allergy relief for sneezing and watery eyes.', 'https://medino-product.imgix.net/teva-cetirizine-10mg-hay-fever-allergy-relief-30-tablets-b9ce9411.png?h=467&bg=FFF&auto=format,compress&q=60', 20.00, 10, 150],
      ['Azithromycin 500mg', 'Antibiotics', 'Broad-spectrum antibiotic for respiratory infections.', 'https://5.imimg.com/data5/SELLER/Default/2024/9/449844947/GJ/KT/XF/15668789/azithromycin-500-mg-tablets-500x500.jpg', 115.00, 8, 80],
      ['Pantoprazole 40mg', 'Gastric & Digestion', 'Reduces stomach acid and treats acidity.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8OftC6_tJzZOKDSLed2OyYeN6APr2xzUIVIVg-BTMFQ&s=10', 95.00, 15, 110],
      ['Omeprazole 20mg', 'Gastric & Digestion', 'Effective relief from acid reflux and ulcers.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRNudyy_kAKAa3qWWrT0eW2bNNd0S-56lZSyz0ZR_OTW_plLZd8e2GNbG0&s=10', 78.00, 10, 95],
      ['Metformin 500mg', 'Diabetes Care', 'Blood sugar control medication for Type 2 diabetes.', 'https://5.imimg.com/data5/SELLER/Default/2024/4/407065514/UV/CF/EI/217937612/okamet-500-metformin-3-500x500.jpg', 60.00, 5, 130],
      ['Amlodipine 5mg', 'Cardiac Care', 'Calcium channel blocker for high blood pressure.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrHl4l9Bj0JQr_fndoCiQ1Gr1HBUG2S_mB6SjNnT9wFlUQteyPWtuK2Sus&s=10', 45.00, 12, 90],
      ['Atorvastatin 10mg', 'Cardiac Care', 'Lowers cholesterol and reduces cardiovascular risks.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiDtMS5l8uxJboGjtKNQUjVXU1uqrsDM-vbODhKwbr7g&s=10', 140.00, 20, 70],
      ['Aspirin 75mg', 'Cardiac Care', 'Blood thinner used for heart health protection.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRw2ZyzpxwtQvSVZH6AW4RVfjASW2BJH8sBSsKYzPpyemTV-v3d3IUaE14&s=10', 22.00, 5, 180],
      ['Montelukast 10mg', 'Antiallergic', 'Prevents asthma symptoms and allergic rhinitis.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgYpDZpGwxq3tYdEvvujwUsMWUdDid4_U0t8lWbHJiU8908gLO0igmvqro&s=10', 160.00, 18, 65],
      ['Disprin Tablet', 'Pain Relief', 'Fast dissolution for headaches and mild pain.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR80nc8Wo2KLv6EgZEG_JcW773MWyLHEVtZ0ID9pPzu_efkZLT4YCxiuNzy&s=10', 15.00, 0, 220],
      ['Combiflam Tablet', 'Pain Relief', 'Combination pain reliever and anti-inflammatory.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQ0aWYiJ6W3Eb5LpM4L6MhKOuKCl7LvTsgICU69rB3zwmetZouCEbkX9I&s=10', 40.00, 10, 160],
      ['Becosules Capsule', 'Vitamins', 'Vitamin B-complex with Vitamin C capsules.', 'https://onemg.gumlet.io/l_watermark_346/a_ignore,c_fit,q_auto,f_auto/69e588a556b54334af736fc860e1e057.jpg', 45.00, 5, 140],
      ['Shelcal 500mg', 'Vitamins', 'Calcium and Vitamin D3 supplement for bones.', 'https://cdn01.pharmeasy.in/dam/products_otc/159115/shelcal-500mg-strip-of-15-tablets-6.1-1766498211.jpg', 125.00, 12, 100],
      ['Liv.52 Tablet', 'Gastric & Digestion', 'Herbal liver care and protection tablets.', 'https://cdn01.pharmeasy.in/dam/products_otc/105920/himalaya-liv52-tablets-100s-6.5-1748863395.jpg', 150.00, 10, 85],
      ['ORS Powder Sachet', 'Vitamins', 'Oral rehydration salts for electrolyte balance.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQv0FwiqxnEnh8owj-Ad9k5oburNF0Wkb4Yij2PG9eVKp7yI2hIz0Dr78UZ&s=10', 21.00, 5, 300],
      ['Allegra 120mg', 'Antiallergic', 'Non-drowsy 24-hour allergy relief medication.', 'https://www.apollopharmacy.in/catalog/product/a/l/allegra_120_1.jpg', 190.00, 15, 75],
      ['Pan D Capsule', 'Gastric & Digestion', 'Pantoprazole and Domperidone capsule for acidity.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTILTrHIEQU_2hoNZlFNXfVmw3yd1Cpt1xIIrFX9aEzxA&s=10', 165.00, 14, 90],
      ['Taxim-O 200mg', 'Antibiotics', 'Cefixime oral suspension tablet for infections.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT1rRhp7QnHtNokWv0m8axdmhUmPZIJmaqVqG8K5IKm-RsuKi3lGvAU1_w&s=10', 220.00, 10, 60],
      ['Augmentin 625 Duo', 'Antibiotics', 'Advanced antibiotic tablet for bacterial defence.', 'https://5.imimg.com/data5/SELLER/Default/2024/4/412063072/LW/CM/MO/44153686/augmentin-625-tablet.jpg', 205.00, 12, 50],
      ['Gelusil Syrup', 'Gastric & Digestion', 'Antacid gel for instant relief from gas and heartburn.', 'https://www.apollopharmacy.in/catalog/product/G/E/GEL0002_3_1.jpg', 145.00, 8, 80],
      ['Vicks VapoRub', 'Cough & Cold', 'Relief from cold symptoms, cough, and blocked nose.', 'https://cdn01.pharmeasy.in/dam/products_otc/181135/vicks-vaporub-25ml-relief-from-cold-cough-headache-and-body-pain-2-1755070449.jpg', 135.00, 5, 110],
      ['Strepsils Lozenges', 'Cough & Cold', 'Soothing throat lozenges for sore throat relief.', 'https://cdn01.pharmeasy.in/dam/products_otc/J73374/strepsils-ginger-and-lemon-flavour-jar-120-8-free-lozenges-6.1-1775912514.jpg', 40.00, 0, 250],
      ['Benadryl Cough Syrup', 'Cough & Cold', 'Trusted cough formula for chest congestion.', 'https://images.ctfassets.net/00ko9qtwe33b/4gVUt0H0AqpRhg9LXV3Vge/90d99c026eeee9b6408c8ad42b9f9782/bottle_2-en-in', 140.00, 10, 95],
      ['Clavam 625mg', 'Antibiotics', 'Amoxicillin and Potassium clavulanate tablets.', 'https://cdn01.pharmeasy.in/dam/productsnowatermark/042840/clavam-625mg-strip-of-10-tablets-box-front-1-1756894273-non-watermarked.jpg', 210.00, 15, 60],
      ['Glycomet-GP 1', 'Diabetes Care', 'Combination anti-diabetic tablet.', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRinjXujFEeWqKjTPWrGWm0nQiCxsUH9tqFd777-elc6g&s=10', 88.00, 10, 115]
    ];

    // This loop ensures that whether the medicine exists or not, it will be updated with your new images.
    for (const med of medicinesData) {
      const [existing] = await pool.query("SELECT id FROM medicines WHERE name = ? LIMIT 1", [med[0]]);
      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO medicines (name, category, description, image_url, price, discount_percent, stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          med
        );
      } else {
        await pool.query(
          `UPDATE medicines SET category = ?, description = ?, image_url = ?, price = ?, discount_percent = ?, stock = ? WHERE name = ?`,
          [med[1], med[2], med[3], med[4], med[5], med[6], med[0]]
        );
      }
    }

    const [partnerCountRows] = await pool.query("SELECT COUNT(*) AS count FROM delivery_partners");
    if ((partnerCountRows[0]?.count || 0) === 0) {
      await pool.query(
        `INSERT INTO delivery_partners (name, phone, active_order_count, completed_order_count)
         VALUES
         ('Ravi Kumar', '9876543210', 0, 5),
         ('Priya Sharma', '9876543211', 0, 3),
         ('Amit Patel', '9876543212', 0, 7)`
      );
    }

    const [vendorCountRows] = await pool.query("SELECT COUNT(*) AS count FROM vendor_partners");
    if ((vendorCountRows[0]?.count || 0) === 0) {
      await pool.query(
        `INSERT INTO vendor_partners (vendor_type, name, phone, location, rating)
         VALUES
         ('seller', 'MediSupply Co.', '9822001100', 'Mumbai', 4.50),
         ('seller', 'PharmaDistributors Ltd.', '9822001101', 'Delhi', 4.80),
         ('seller', 'HealthCare Wholesale', '9822001102', 'Bangalore', 4.30),
         ('seller', 'Global Pharma Solutions', '9822001103', 'Chennai', 4.70),
         ('supplier', 'Cipla', '9876543210', 'Mumbai', 4.60),
         ('supplier', 'GSK', '9876543211', 'Delhi', 4.70),
         ('supplier', 'Abbott', '9876543212', 'Bangalore', 4.50),
         ('supplier', 'Sun Pharma', '9876543213', 'Mumbai', 4.60),
         ('supplier', 'Pfizer', '9876543214', 'Chennai', 4.80)`
      );
    }
    console.log("✅ Database tables verified and initialized successfully!");
  } catch (error) {
    console.error("❌ Database initialization error:", error.message);
  }
}