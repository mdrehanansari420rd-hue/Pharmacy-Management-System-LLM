import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { initializeDatabase, pool } from "./db.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "development-secret";
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const DEV_EXPOSE_OTP = process.env.DEV_EXPOSE_OTP === "true";
const execFileAsync = promisify(execFile);
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, "..");
const diseaseModelDir = path.join(projectRoot, "Disease-Prediction-from-Symptoms-master");
const diseaseTrainingCsv = path.join(diseaseModelDir, "dataset", "training_data.csv");
const pythonCommand = process.env.PYTHON_COMMAND || "python";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

function sanitizeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    profilePhoto: row.profile_photo ?? "",
    role: row.role,
    isAdmin: row.role === "admin",
    businessName: row.business_name ?? "",
    businessAddress: row.business_address ?? "",
    verification: row.verification_document ?? "",
  };
}

const diseaseRecommendations = {
  "Common Cold": { medicineName: "Cough Syrup", advice: "Stay hydrated and rest. Consult a doctor if symptoms worsen." },
  Flu: { medicineName: "Paracetamol 500mg", advice: "Take fever and pain relief only as directed." },
  Allergy: { medicineName: "Vitamin C Tablets", advice: "Avoid known triggers and consult a doctor for antihistamines." },
  Migraine: { medicineName: "Ibuprofen 400mg", advice: "Use pain relief carefully and rest in a dark room." },
  Arthritis: { medicineName: "Ibuprofen 400mg", advice: "Pain relief may help temporarily; follow medical guidance." },
  Osteoarthristis: { medicineName: "Ibuprofen 400mg", advice: "Pain relief may help temporarily; follow medical guidance." },
  Diabetes: { medicineName: "Insulin Pen", advice: "Only use insulin under doctor supervision." },
  "Diabetes ": { medicineName: "Insulin Pen", advice: "Only use insulin under doctor supervision." },
  Impetigo: { medicineName: "Antibiotic Cream", advice: "Keep the affected area clean and consult a doctor." },
  Acne: { medicineName: "Antibiotic Cream", advice: "Use topical treatment carefully and avoid skin irritation." },
  Psoriasis: { medicineName: "Antibiotic Cream", advice: "Consult a dermatologist for the right treatment plan." },
  "Fungal infection": { medicineName: "Antifungal Cream", advice: "Keep the area dry and seek medical advice if persistent." },
  GERD: { medicineName: "Antacid", advice: "Avoid spicy food and consult a doctor if symptoms continue." },
  "Urinary tract infection": { medicineName: "Consult Doctor for Antibiotics", advice: "This usually needs prescription treatment." },
};

function mapMedicine(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? "",
    image: row.image_url ?? "",
    price: Number(row.price),
    discount: Number(row.discount_percent),
    stock: row.stock,
  };
}

function mapDeliveryPartner(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    orders: row.completed_order_count,
    activeOrders: row.active_order_count,
  };
}

function mapVendor(row) {
  return {
    id: row.id,
    type: row.vendor_type,
    name: row.name,
    phone: row.phone ?? "",
    location: row.location ?? "",
    rating: Number(row.rating || 0),
  };
}

async function fetchProcurementOrders(source = null) {
  const params = [];
  const whereClause = source ? "WHERE po.source = ?" : "";
  if (source) params.push(source);

  const [orderRows] = await pool.query(
    `SELECT
      po.*,
      vp.name AS vendor_name,
      vp.phone AS vendor_phone,
      vp.location AS vendor_location
     FROM procurement_orders po
     INNER JOIN vendor_partners vp ON vp.id = po.vendor_id
     ${whereClause}
     ORDER BY po.created_at DESC`,
    params
  );

  if (orderRows.length === 0) {
    return [];
  }

  const orderIds = orderRows.map((row) => row.id);
  const placeholders = orderIds.map(() => "?").join(", ");
  const [itemRows] = await pool.query(
    `SELECT * FROM procurement_order_items WHERE procurement_order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds
  );

  const itemsByOrderId = itemRows.reduce((acc, item) => {
    if (!acc[item.procurement_order_id]) acc[item.procurement_order_id] = [];
    acc[item.procurement_order_id].push({
      id: item.medicine_id,
      name: item.medicine_name,
      price: Number(item.unit_price),
      quantity: item.quantity,
      totalPrice: Number(item.total_price),
    });
    return acc;
  }, {});

  return orderRows.map((row) => ({
    id: row.id,
    vendorId: row.vendor_id,
    vendorType: row.vendor_type,
    vendorName: row.vendor_name,
    vendorPhone: row.vendor_phone,
    vendorLocation: row.vendor_location,
    source: row.source,
    status: row.status,
    urgency: row.urgency,
    total: Number(row.total),
    notes: row.notes ?? "",
    items: itemsByOrderId[row.id] || [],
    createdAt: row.created_at,
  }));
}

async function fetchOrdersForUser(userId = null) {
  const params = [];
  let whereClause = "";
  if (userId) {
    whereClause = "WHERE o.user_id = ?";
    params.push(userId);
  }

  const [orderRows] = await pool.query(
    `SELECT
      o.*,
      u.name AS customer_name,
      u.email AS customer_email,
      dp.name AS delivery_partner_name,
      dp.phone AS delivery_partner_phone
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     LEFT JOIN delivery_partners dp ON dp.id = o.delivery_partner_id
     ${whereClause}
     ORDER BY o.created_at DESC`,
    params
  );

  if (orderRows.length === 0) {
    return [];
  }

  const orderIds = orderRows.map((row) => row.id);
  const placeholders = orderIds.map(() => "?").join(", ");
  const [itemRows] = await pool.query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds
  );

  const itemsByOrderId = itemRows.reduce((acc, item) => {
    if (!acc[item.order_id]) acc[item.order_id] = [];
    acc[item.order_id].push({
      id: item.medicine_id,
      name: item.medicine_name,
      price: Number(item.unit_price),
      discount: Number(item.discount_percent),
      qty: item.quantity,
      totalPrice: Number(item.total_price),
    });
    return acc;
  }, {});

  return orderRows.map((row) => {
    const items = itemsByOrderId[row.id] || [];
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.customer_name,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      items,
      medicine: items.map((item) => item.name).join(", "),
      qty: items.reduce((sum, item) => sum + item.qty, 0),
      subtotal: Number(row.subtotal),
      discountTotal: Number(row.discount_total),
      deliveryFee: Number(row.delivery_fee),
      total: Number(row.total),
      totalPrice: Number(row.total),
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      deliveryPartner: row.delivery_partner_name,
      deliveryPartnerPhone: row.delivery_partner_phone,
      address: {
        label: row.address_label,
        details: row.address_details,
      },
      notes: row.notes ?? "",
      createdAt: row.created_at,
    };
  });
}

async function fetchOverview(userId) {
  const [medicineRows] = await pool.query(
    `SELECT * FROM medicines WHERE is_active = 1 ORDER BY category ASC, name ASC`
  );
  const medicines = medicineRows.map(mapMedicine);

  const categories = Array.from(
    new Map(
      medicines.map((medicine) => [
        medicine.category,
        {
          name: medicine.category,
          count: medicines.filter((item) => item.category === medicine.category).length,
        },
      ])
    ).values()
  );

  const orders = await fetchOrdersForUser(userId);
  return { medicines, categories, orders };
}

async function loadSymptomList() {
  const firstLine = (await fs.readFile(diseaseTrainingCsv, "utf8")).split(/\r?\n/)[0] || "";
  return firstLine
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "prognosis");
}

async function runDiseasePrediction(symptoms) {
  const { stdout } = await execFileAsync(
    pythonCommand,
    [path.join(diseaseModelDir, "predict_api.py"), JSON.stringify(symptoms)],
    { cwd: diseaseModelDir }
  );
  return JSON.parse(stdout);
}

function formatDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getDateRange(range, startDate, endDate) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (range === "weekly") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (range === "monthly") {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (range === "quarterly") {
    start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (range === "yearly") {
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  if (range === "custom" && startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate) };
  }
  return { start: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), end };
}

async function fetchAnalyticsBaseData() {
  const [orders] = await pool.query(`
    SELECT
      o.*,
      u.name AS customer_name
    FROM orders o
    INNER JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC
  `);
  const [orderItems] = await pool.query("SELECT * FROM order_items");
  const [medicines] = await pool.query("SELECT * FROM medicines WHERE is_active = 1");
  const [users] = await pool.query("SELECT * FROM users");
  const [deliveryPartners] = await pool.query("SELECT * FROM delivery_partners WHERE is_active = 1");
  return { orders, orderItems, medicines, users, deliveryPartners };
}

function buildAnalytics(range, baseData) {
  const { orders, orderItems, medicines, users } = baseData;
  const now = new Date();
  const salesSeries = [];

  if (range === "weekly") {
    for (let i = 6; i >= 0; i -= 1) {
      const current = new Date(now);
      current.setDate(now.getDate() - i);
      const label = current.toLocaleDateString("en-IN", { weekday: "short" });
      const key = formatDateKey(current);
      const dayOrders = orders.filter((order) => formatDateKey(order.created_at) === key);
      salesSeries.push({
        day: label,
        sales: dayOrders.reduce((sum, order) => sum + Number(order.total), 0),
        orders: dayOrders.length,
      });
    }
  } else if (range === "monthly") {
    for (let i = 3; i >= 0; i -= 1) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7 - 6);
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekOrders = orders.filter((order) => {
        const created = new Date(order.created_at);
        return created >= weekStart && created <= weekEnd;
      });
      salesSeries.push({
        month: `Week ${4 - i}`,
        sales: weekOrders.reduce((sum, order) => sum + Number(order.total), 0),
        orders: weekOrders.length,
      });
    }
  } else {
    for (let i = 11; i >= 0; i -= 1) {
      const current = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthOrders = orders.filter((order) => {
        const created = new Date(order.created_at);
        return created >= current && created < next;
      });
      salesSeries.push({
        month: current.toLocaleDateString("en-IN", { month: "short" }),
        sales: monthOrders.reduce((sum, order) => sum + Number(order.total), 0),
        orders: monthOrders.length,
      });
    }
  }

  const orderItemByMedicine = orderItems.reduce((acc, item) => {
    const current = acc.get(item.medicine_id) || { quantity: 0, sales: 0, name: item.medicine_name };
    current.quantity += item.quantity;
    current.sales += Number(item.total_price);
    acc.set(item.medicine_id, current);
    return acc;
  }, new Map());

  const topProducts = Array.from(orderItemByMedicine.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5)
    .map((item) => ({
      name: item.name,
      sales: item.sales,
      quantity: item.quantity,
    }));

  const categoryMap = medicines.reduce((acc, medicine) => {
    const sold = orderItems
      .filter((item) => item.medicine_id === medicine.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    acc.set(medicine.category, (acc.get(medicine.category) || 0) + sold);
    return acc;
  }, new Map());

  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const totalOrders = orders.length;
  const activeCustomers = new Set(orders.map((order) => order.user_id)).size;

  return {
    stats: {
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders ? totalSales / totalOrders : 0,
      activeCustomers,
      totalMedicines: medicines.length,
      totalCategories: new Set(medicines.map((medicine) => medicine.category)).size,
      lowStockCount: medicines.filter((medicine) => medicine.stock < 20).length,
      totalCustomers: users.filter((user) => user.role === "customer").length,
    },
    salesData: salesSeries,
    topProducts,
    categoryData,
  };
}

function buildAlerts(baseData) {
  const { medicines, orders, deliveryPartners } = baseData;
  const alerts = [];

  medicines
    .filter((medicine) => medicine.stock < 20)
    .forEach((medicine) => {
      alerts.push({
        id: `stock-${medicine.id}`,
        type: "low-stock",
        title: "Low Stock Alert",
        message: `${medicine.name} is running low. Only ${medicine.stock} units left.`,
        severity: medicine.stock < 10 ? "high" : "medium",
        date: new Date().toISOString(),
        read: false,
        medicine: medicine.name,
        currentStock: medicine.stock,
        minStock: 20,
      });
    });

  orders
    .filter((order) => order.payment_status === "failed" || (order.payment_method === "cod" && order.payment_status === "pending"))
    .slice(0, 5)
    .forEach((order) => {
      alerts.push({
        id: `payment-${order.id}`,
        type: "payment",
        title: "Payment Attention",
        message: `Payment for order #${order.id} is ${order.payment_status}.`,
        severity: order.payment_status === "failed" ? "high" : "info",
        date: order.created_at,
        read: false,
        orderId: order.id,
      });
    });

  orders
    .filter((order) => order.status === "Processing")
    .slice(0, 5)
    .forEach((order) => {
      alerts.push({
        id: `order-${order.id}`,
        type: "order",
        title: "Processing Order",
        message: `Order #${order.id} is still processing and ready for dispatch.`,
        severity: "info",
        date: order.created_at,
        read: false,
        orderId: order.id,
      });
    });

  deliveryPartners
    .filter((partner) => partner.active_order_count > 3)
    .forEach((partner) => {
      alerts.push({
        id: `delivery-${partner.id}`,
        type: "delivery",
        title: "Delivery Load High",
        message: `${partner.name} currently has ${partner.active_order_count} active deliveries.`,
        severity: "medium",
        date: new Date().toISOString(),
        read: false,
        deliveryPartner: partner.name,
      });
    });

  return alerts.slice(0, 20);
}

function buildInsights(baseData) {
  const { orders, orderItems, medicines, users, deliveryPartners } = baseData;
  const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const last30Start = new Date();
  last30Start.setDate(last30Start.getDate() - 30);
  const last30Orders = orders.filter((order) => new Date(order.created_at) >= last30Start);
  const topMedicine = orderItems
    .reduce((acc, item) => {
      acc[item.medicine_name] = (acc[item.medicine_name] || 0) + item.quantity;
      return acc;
    }, {});
  const topMedicineEntry = Object.entries(topMedicine).sort((a, b) => b[1] - a[1])[0];
  const lowStockMedicine = medicines.sort((a, b) => a.stock - b.stock)[0];
  const busiestPartner = [...deliveryPartners].sort((a, b) => b.active_order_count - a.active_order_count)[0];

  return {
    insights: [
      {
        id: 1,
        title: "Sales Trend Analysis",
        description: `Total recorded sales are Rs ${totalSales.toFixed(0)} with ${last30Orders.length} orders in the last 30 days.`,
        impact: "high",
        category: "sales",
      },
      {
        id: 2,
        title: "Customer Behavior",
        description: `${new Set(orders.map((order) => order.user_id)).size} customers have placed orders so far.`,
        impact: "medium",
        category: "customers",
      },
      {
        id: 3,
        title: "Inventory Optimization",
        description: lowStockMedicine
          ? `${lowStockMedicine.name} has the lowest stock at ${lowStockMedicine.stock} units.`
          : "Inventory is currently healthy.",
        impact: "high",
        category: "inventory",
      },
    ],
    predictions: [
      {
        id: 1,
        title: "Next Month Sales Forecast",
        value: `Rs ${(last30Orders.reduce((sum, order) => sum + Number(order.total), 0) * 1.08 || 0).toFixed(0)}`,
        confidence: "78%",
        trend: "up",
      },
      {
        id: 2,
        title: "Expected Order Volume",
        value: `${Math.round(last30Orders.length * 1.05)} orders`,
        confidence: "74%",
        trend: "up",
      },
      {
        id: 3,
        title: "Customer Growth",
        value: `${users.filter((user) => user.role === "customer").length} customers`,
        confidence: "81%",
        trend: "up",
      },
    ],
    recommendations: [
      {
        id: 1,
        title: "Increase Low Stock Inventory",
        action: lowStockMedicine ? `Restock ${lowStockMedicine.name} soon to avoid stockouts.` : "No urgent inventory gaps detected.",
        priority: "high",
        roi: "Reduced missed sales",
      },
      {
        id: 2,
        title: "Promote Top Seller",
        action: topMedicineEntry ? `Bundle or feature ${topMedicineEntry[0]} which has sold ${topMedicineEntry[1]} units.` : "Collect more order history for product recommendations.",
        priority: "medium",
        roi: "Higher repeat orders",
      },
      {
        id: 3,
        title: "Balance Delivery Load",
        action: busiestPartner ? `Review assignments for ${busiestPartner.name} who has ${busiestPartner.active_order_count} active orders.` : "Delivery team load is balanced.",
        priority: "medium",
        roi: "Faster fulfilment",
      },
    ],
  };
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function isEmail(value) {
  return value.includes("@");
}

function createOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function findUserByIdentifier(identifier, role) {
  const field = isEmail(identifier) ? "email" : "phone";
  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${field} = ? AND role = ? LIMIT 1`,
    [identifier, role]
  );
  return rows[0] ?? null;
}

async function createOtp(userId, purpose) {
  const otp = createOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    "UPDATE auth_otps SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
    [userId, purpose]
  );

  await pool.query(
    "INSERT INTO auth_otps (user_id, purpose, otp_code, expires_at) VALUES (?, ?, ?, ?)",
    [userId, purpose, otp, expiresAt]
  );

  return { otp, expiresAt };
}

async function consumeOtp(userId, purpose, otpCode) {
  const [rows] = await pool.query(
    `SELECT * FROM auth_otps
     WHERE user_id = ? AND purpose = ? AND otp_code = ? AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, purpose, otpCode]
  );

  const record = rows[0];
  if (!record) {
    return { ok: false, message: "Invalid OTP." };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "OTP has expired." };
  }

  await pool.query("UPDATE auth_otps SET used_at = NOW() WHERE id = ?", [record.id]);
  return { ok: true };
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Database connection failed." });
  }
});

app.get("/api/prediction/symptoms", async (_req, res) => {
  try {
    const symptoms = await loadSymptomList();
    res.json(symptoms);
  } catch (error) {
    console.error("Symptom list load error:", error);
    res.status(500).json({ message: "Unable to load symptoms right now." });
  }
});

app.post("/api/prediction/disease", async (req, res) => {
  try {
    const { symptoms = [] } = req.body;
    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ message: "Please select at least one symptom." });
    }

    const prediction = await runDiseasePrediction(symptoms);
    const recommendation =
      diseaseRecommendations[prediction.disease] ||
      { medicineName: "Consult Doctor", advice: "A direct medicine recommendation is not available for this disease in the current catalog." };

    const [medicineRows] = await pool.query(
      "SELECT * FROM medicines WHERE name = ? AND is_active = 1 LIMIT 1",
      [recommendation.medicineName]
    );

    res.json({
      disease: prediction.disease,
      recognizedSymptoms: prediction.recognizedSymptoms,
      recommendedMedicine: recommendation.medicineName,
      advice: recommendation.advice,
      recommendedProduct: medicineRows[0] ? mapMedicine(medicineRows[0]) : null,
    });
  } catch (error) {
    console.error("Disease prediction error:", error);
    res.status(500).json({ message: "Unable to run disease prediction right now. Make sure Python dependencies for the model are installed." });
  }
});

app.get("/api/home", async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    const overview = await fetchOverview(userId);
    res.json(overview);
  } catch (error) {
    console.error("Home overview error:", error);
    res.status(500).json({ message: "Unable to load home data right now." });
  }
});

app.get("/api/medicines", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM medicines WHERE is_active = 1 ORDER BY category ASC, name ASC"
    );
    res.json(rows.map(mapMedicine));
  } catch (error) {
    console.error("Medicines fetch error:", error);
    res.status(500).json({ message: "Unable to load medicines right now." });
  }
});

app.get("/api/delivery-partners", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM delivery_partners WHERE is_active = 1 ORDER BY name ASC"
    );
    res.json(rows.map(mapDeliveryPartner));
  } catch (error) {
    console.error("Delivery partners fetch error:", error);
    res.status(500).json({ message: "Unable to load delivery partners right now." });
  }
});

app.get("/api/admin/dashboard", async (_req, res) => {
  try {
    const baseData = await fetchAnalyticsBaseData();
    const analytics = buildAnalytics("yearly", baseData);
    const recentOrders = await fetchOrdersForUser();
    res.json({
      stats: analytics.stats,
      deliverySummary: {
        totalPartners: baseData.deliveryPartners.length,
        activeOrders: baseData.orders.filter((order) => order.status !== "Delivered").length,
        completedDeliveries: baseData.deliveryPartners.reduce(
          (sum, partner) => sum + partner.completed_order_count,
          0
        ),
      },
      salesData: analytics.salesData,
      medicineData: analytics.topProducts.map((item) => ({
        name: item.name,
        qty: item.quantity,
      })),
      recentOrders: recentOrders.slice(0, 8),
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ message: "Unable to load dashboard data right now." });
  }
});

app.get("/api/admin/analytics", async (req, res) => {
  try {
    const range = req.query.range || "weekly";
    const baseData = await fetchAnalyticsBaseData();
    res.json(buildAnalytics(range, baseData));
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ message: "Unable to load analytics right now." });
  }
});

app.get("/api/admin/alerts", async (_req, res) => {
  try {
    const baseData = await fetchAnalyticsBaseData();
    res.json(buildAlerts(baseData));
  } catch (error) {
    console.error("Admin alerts error:", error);
    res.status(500).json({ message: "Unable to load alerts right now." });
  }
});

app.get("/api/admin/insights", async (_req, res) => {
  try {
    const baseData = await fetchAnalyticsBaseData();
    res.json(buildInsights(baseData));
  } catch (error) {
    console.error("Admin insights error:", error);
    res.status(500).json({ message: "Unable to load insights right now." });
  }
});

app.get("/api/admin/report", async (req, res) => {
  try {
    const { reportType = "sales", dateRange = "weekly", startDate, endDate } = req.query;
    const { start, end } = getDateRange(dateRange, startDate, endDate);
    const baseData = await fetchAnalyticsBaseData();
    const filteredOrders = baseData.orders.filter((order) => {
      const created = new Date(order.created_at);
      return created >= start && created <= end;
    });

    let rows = [];
    if (reportType === "sales") {
      const byDate = filteredOrders.reduce((acc, order) => {
        const key = formatDateKey(order.created_at);
        if (!acc[key]) acc[key] = { date: key, orders: 0, revenue: 0 };
        acc[key].orders += 1;
        acc[key].revenue += Number(order.total);
        return acc;
      }, {});
      rows = Object.values(byDate).map((entry) => ({
        ...entry,
        avgOrder: entry.orders ? entry.revenue / entry.orders : 0,
      }));
    } else if (reportType === "inventory" || reportType === "expiry") {
      rows = baseData.medicines.map((medicine) => ({
        medicine: medicine.name,
        stock: medicine.stock,
        lowStock: medicine.stock < 20 ? "Yes" : "No",
        category: medicine.category,
      }));
    } else if (reportType === "orders") {
      rows = filteredOrders.map((order) => ({
        orderId: order.id,
        customer: order.customer_name,
        total: Number(order.total),
        status: order.status,
        paymentStatus: order.payment_status,
      }));
    } else if (reportType === "customers") {
      const customers = baseData.users.filter((user) => user.role === "customer");
      rows = customers.map((customer) => ({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      }));
    }

    res.json({
      title: `${reportType[0].toUpperCase()}${reportType.slice(1)} Report`,
      reportType,
      dateRange,
      generatedOn: new Date().toISOString(),
      totalRecords: rows.length,
      rows,
    });
  } catch (error) {
    console.error("Admin report error:", error);
    res.status(500).json({ message: "Unable to generate report preview right now." });
  }
});

app.get("/api/admin/vendors", async (req, res) => {
  try {
    const { vendorType } = req.query;
    const params = [];
    let whereClause = "WHERE is_active = 1";
    if (vendorType) {
      whereClause += " AND vendor_type = ?";
      params.push(vendorType);
    }

    const [rows] = await pool.query(
      `SELECT * FROM vendor_partners ${whereClause} ORDER BY rating DESC, name ASC`,
      params
    );
    res.json(rows.map(mapVendor));
  } catch (error) {
    console.error("Vendor fetch error:", error);
    res.status(500).json({ message: "Unable to load vendors right now." });
  }
});

app.get("/api/admin/procurement-orders", async (req, res) => {
  try {
    const { source } = req.query;
    const orders = await fetchProcurementOrders(source || null);
    res.json(orders);
  } catch (error) {
    console.error("Procurement orders fetch error:", error);
    res.status(500).json({ message: "Unable to load procurement orders right now." });
  }
});

app.post("/api/admin/procurement-orders", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      vendorId,
      vendorType,
      source,
      items,
      notes = "",
      urgency = null,
      createdByUserId = null,
    } = req.body;

    const validSources = ["seller-order", "restock", "emergency"];
    const validVendorTypes = ["seller", "supplier"];
    const validUrgency = [null, "low", "medium", "high"];

    if (!vendorId || !validVendorTypes.includes(vendorType) || !validSources.includes(source)) {
      return res.status(400).json({ message: "Vendor, vendor type, and order source are required." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one medicine is required." });
    }

    if (!validUrgency.includes(urgency)) {
      return res.status(400).json({ message: "Invalid urgency value." });
    }

    await connection.beginTransaction();

    const [vendorRows] = await connection.query(
      "SELECT * FROM vendor_partners WHERE id = ? AND vendor_type = ? AND is_active = 1 LIMIT 1",
      [vendorId, vendorType]
    );
    const vendor = vendorRows[0];
    if (!vendor) {
      throw new Error("Selected vendor was not found.");
    }

    const medicineIds = items.map((item) => Number(item.id)).filter(Boolean);
    if (medicineIds.length !== items.length) {
      throw new Error("Invalid medicine selection.");
    }

    const placeholders = medicineIds.map(() => "?").join(", ");
    const [medicineRows] = await connection.query(
      `SELECT * FROM medicines WHERE id IN (${placeholders})`,
      medicineIds
    );
    const medicineMap = new Map(medicineRows.map((row) => [row.id, row]));

    let total = 0;
    const normalizedItems = [];
    for (const item of items) {
      const medicine = medicineMap.get(Number(item.id));
      if (!medicine) {
        throw new Error(`Medicine ${item.id} not found.`);
      }

      const quantity = Number(item.qty || item.quantity || 0);
      if (!quantity || quantity < 1) {
        throw new Error(`Invalid quantity for ${medicine.name}.`);
      }

      const lineTotal = Number(medicine.price) * quantity;
      total += lineTotal;
      normalizedItems.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        unitPrice: Number(medicine.price),
        quantity,
        totalPrice: lineTotal,
      });
    }

    const [orderResult] = await connection.query(
      `INSERT INTO procurement_orders
        (vendor_id, vendor_type, source, status, urgency, total, notes, created_by_user_id)
       VALUES (?, ?, ?, 'Pending', ?, ?, ?, ?)`,
      [vendor.id, vendorType, source, urgency, total, notes || null, createdByUserId || null]
    );

    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO procurement_order_items
          (procurement_order_id, medicine_id, medicine_name, unit_price, quantity, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderResult.insertId, item.medicineId, item.medicineName, item.unitPrice, item.quantity, item.totalPrice]
      );
    }

    await connection.commit();

    const orders = await fetchProcurementOrders(source);
    const createdOrder = orders.find((order) => order.id === orderResult.insertId);
    res.status(201).json({
      message: "Procurement order created successfully.",
      order: createdOrder,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Procurement order create error:", error);
    res.status(400).json({ message: error.message || "Unable to create procurement order right now." });
  } finally {
    connection.release();
  }
});

app.post("/api/admin/discounts/apply", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      medicineIds,
      discountType,
      discountValue,
      minQuantity = null,
      validUntil = null,
      promoCode = "",
    } = req.body;

    if (!Array.isArray(medicineIds) || medicineIds.length === 0) {
      return res.status(400).json({ message: "Select at least one medicine." });
    }

    const numericDiscount = Number(discountValue);
    if (!numericDiscount || numericDiscount <= 0) {
      return res.status(400).json({ message: "Enter a valid discount value." });
    }

    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({ message: "Invalid discount type." });
    }

    await connection.beginTransaction();
    const placeholders = medicineIds.map(() => "?").join(", ");
    const [medicineRows] = await connection.query(
      `SELECT * FROM medicines WHERE id IN (${placeholders}) FOR UPDATE`,
      medicineIds
    );
    if (medicineRows.length === 0) {
      throw new Error("No medicines found for discount.");
    }

    const [campaignResult] = await connection.query(
      `INSERT INTO discount_campaigns
        (title, discount_type, discount_value, min_quantity, valid_until, promo_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        promoCode ? `Promo ${promoCode}` : `Discount Campaign ${new Date().toISOString().slice(0, 10)}`,
        discountType,
        numericDiscount,
        minQuantity || null,
        validUntil || null,
        promoCode || null,
      ]
    );

    for (const medicine of medicineRows) {
      const originalPrice = Number(medicine.price);
      const appliedDiscountPercent =
        discountType === "percentage"
          ? Math.min(numericDiscount, 100)
          : Math.min((numericDiscount / originalPrice) * 100, 100);
      const discountedPrice = Math.max(originalPrice * (1 - appliedDiscountPercent / 100), 0);

      await connection.query(
        "UPDATE medicines SET discount_percent = ? WHERE id = ?",
        [appliedDiscountPercent, medicine.id]
      );
      await connection.query(
        `INSERT INTO discount_campaign_items
          (campaign_id, medicine_id, original_price, applied_discount_percent, discounted_price)
         VALUES (?, ?, ?, ?, ?)`,
        [campaignResult.insertId, medicine.id, originalPrice, appliedDiscountPercent, discountedPrice]
      );
    }

    await connection.commit();

    const [updatedRows] = await pool.query(
      `SELECT * FROM medicines WHERE id IN (${placeholders}) ORDER BY category ASC, name ASC`,
      medicineIds
    );
    res.json({
      message: "Discount applied successfully.",
      medicines: updatedRows.map(mapMedicine),
    });
  } catch (error) {
    await connection.rollback();
    console.error("Discount apply error:", error);
    res.status(400).json({ message: error.message || "Unable to apply discount right now." });
  } finally {
    connection.release();
  }
});

app.post("/api/delivery-partners", async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ message: "Name and phone are required." });
    }

    const [result] = await pool.query(
      "INSERT INTO delivery_partners (name, phone) VALUES (?, ?)",
      [name.trim(), phone.trim()]
    );
    const [rows] = await pool.query("SELECT * FROM delivery_partners WHERE id = ?", [result.insertId]);
    res.status(201).json(mapDeliveryPartner(rows[0]));
  } catch (error) {
    console.error("Delivery partner create error:", error);
    res.status(500).json({ message: "Unable to add delivery partner right now." });
  }
});

app.delete("/api/delivery-partners/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid delivery partner id." });
    }

    await pool.query("UPDATE delivery_partners SET is_active = 0 WHERE id = ?", [id]);
    res.json({ message: "Delivery partner removed." });
  } catch (error) {
    console.error("Delivery partner delete error:", error);
    res.status(500).json({ message: "Unable to remove delivery partner right now." });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const orders = await fetchOrdersForUser(userId);
    res.json(orders);
  } catch (error) {
    console.error("Orders fetch error:", error);
    res.status(500).json({ message: "Unable to load orders right now." });
  }
});

app.post("/api/orders", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      userId,
      items,
      paymentMethod,
      address,
      notes = "",
    } = req.body;

    if (!userId || !Array.isArray(items) || items.length === 0 || !paymentMethod || !address?.label || !address?.details) {
      return res.status(400).json({ message: "Order items, address, payment method, and user are required." });
    }

    await connection.beginTransaction();

    const sortedPartnerQuery = `
      SELECT *
      FROM delivery_partners
      WHERE is_active = 1
      ORDER BY active_order_count ASC, completed_order_count DESC, id ASC
      LIMIT 1
      FOR UPDATE
    `;
    const [partnerRows] = await connection.query(sortedPartnerQuery);
    const partner = partnerRows[0] ?? null;

    const medicineIds = items.map((item) => item.id);
    const placeholders = medicineIds.map(() => "?").join(", ");
    const [medicineRows] = await connection.query(
      `SELECT * FROM medicines WHERE id IN (${placeholders}) FOR UPDATE`,
      medicineIds
    );

    const medicineMap = new Map(medicineRows.map((row) => [row.id, row]));
    let subtotal = 0;
    let discountTotal = 0;
    const normalizedItems = [];

    for (const item of items) {
      const medicine = medicineMap.get(item.id);
      if (!medicine) {
        throw new Error(`Medicine ${item.id} not found.`);
      }

      const quantity = Number(item.qty || item.quantity || 0);
      if (!quantity || quantity < 1) {
        throw new Error(`Invalid quantity for ${medicine.name}.`);
      }

      if (medicine.stock < quantity) {
        throw new Error(`Not enough stock for ${medicine.name}.`);
      }

      const unitPrice = Number(medicine.price);
      const discountPercent = Number(medicine.discount_percent);
      const lineSubtotal = unitPrice * quantity;
      const lineDiscount = (unitPrice * discountPercent * quantity) / 100;
      const lineTotal = lineSubtotal - lineDiscount;

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      normalizedItems.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        unitPrice,
        discountPercent,
        quantity,
        totalPrice: lineTotal,
      });
    }

    const deliveryFee = normalizedItems.length > 0 ? 7 : 0;
    const total = subtotal - discountTotal + deliveryFee;
    const paymentStatus = paymentMethod === "cod" ? "pending" : "paid";

    const [orderResult] = await connection.query(
      `INSERT INTO orders
        (user_id, delivery_partner_id, status, payment_method, payment_status, subtotal, discount_total, delivery_fee, total, address_label, address_details, notes)
       VALUES (?, ?, 'Processing', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        partner?.id ?? null,
        paymentMethod,
        paymentStatus,
        subtotal,
        discountTotal,
        deliveryFee,
        total,
        address.label,
        address.details,
        notes || null,
      ]
    );

    for (const item of normalizedItems) {
      await connection.query(
        `INSERT INTO order_items
          (order_id, medicine_id, medicine_name, unit_price, discount_percent, quantity, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          item.medicineId,
          item.medicineName,
          item.unitPrice,
          item.discountPercent,
          item.quantity,
          item.totalPrice,
        ]
      );

      await connection.query(
        "UPDATE medicines SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.medicineId]
      );
    }

    if (partner) {
      await connection.query(
        "UPDATE delivery_partners SET active_order_count = active_order_count + 1 WHERE id = ?",
        [partner.id]
      );
    }

    await connection.commit();

    const orders = await fetchOrdersForUser();
    const createdOrder = orders.find((order) => order.id === orderResult.insertId);
    res.status(201).json({
      message: partner
        ? `Order placed successfully and assigned to ${partner.name}.`
        : "Order placed successfully.",
      order: createdOrder,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Order create error:", error);
    res.status(400).json({ message: error.message || "Unable to place order right now." });
  } finally {
    connection.release();
  }
});

app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const validStatuses = ["Processing", "Out for Delivery", "Delivered", "Cancelled"];

    if (!id || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Valid order id and status are required." });
    }

    const [existingRows] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ message: "Order not found." });
    }

    await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    if (existing.delivery_partner_id && existing.status !== "Delivered" && status === "Delivered") {
      await pool.query(
        `UPDATE delivery_partners
         SET active_order_count = GREATEST(active_order_count - 1, 0),
             completed_order_count = completed_order_count + 1
         WHERE id = ?`,
        [existing.delivery_partner_id]
      );
    }

    if (existing.delivery_partner_id && existing.status === "Delivered" && status !== "Delivered") {
      await pool.query(
        `UPDATE delivery_partners
         SET active_order_count = active_order_count + 1,
             completed_order_count = GREATEST(completed_order_count - 1, 0)
         WHERE id = ?`,
        [existing.delivery_partner_id]
      );
    }

    const orders = await fetchOrdersForUser();
    const updatedOrder = orders.find((order) => order.id === id);
    res.json({
      message: "Order status updated successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Order status update error:", error);
    res.status(500).json({ message: "Unable to update order status right now." });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      role = "customer",
      name,
      email,
      mobile,
      password,
      businessName = "",
      businessAddress = "",
      verification = "",
    } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ message: "Name, email, mobile, and password are required." });
    }

    if (role === "admin" && (!businessName || !businessAddress || !verification)) {
      return res.status(400).json({ message: "Admin signup requires business details and verification." });
    }

    const [existingRows] = await pool.query(
      "SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1",
      [email, mobile]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({ message: "An account with this email or phone already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users
        (role, name, email, phone, password_hash, business_name, business_address, verification_document)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [role, name, email, mobile, passwordHash, businessName || null, businessAddress || null, verification || null]
    );

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const user = sanitizeUser(rows[0]);

    res.status(201).json({
      message: "Account created successfully.",
      token: createToken(user),
      user,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Unable to create account right now." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, password, role = "customer" } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier and password are required." });
    }

    const userRow = await findUserByIdentifier(identifier, role);
    if (!userRow) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const user = sanitizeUser(userRow);
    res.json({
      message: "Signed in successfully.",
      token: createToken(user),
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Unable to sign in right now." });
  }
});

app.post("/api/auth/login/request-otp", async (req, res) => {
  try {
    const { identifier, role = "customer" } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Email or phone is required." });
    }

    const userRow = await findUserByIdentifier(identifier, role);
    if (!userRow) {
      return res.status(404).json({ message: "No account found for that email or phone." });
    }

    const { otp } = await createOtp(userRow.id, "login");
    res.json({
      message: "Login OTP generated successfully.",
      devOtp: DEV_EXPOSE_OTP ? otp : undefined,
    });
  } catch (error) {
    console.error("Login OTP request error:", error);
    res.status(500).json({ message: "Unable to generate OTP right now." });
  }
});

app.post("/api/auth/login/verify-otp", async (req, res) => {
  try {
    const { identifier, otp, role = "customer" } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ message: "Email/phone and OTP are required." });
    }

    const userRow = await findUserByIdentifier(identifier, role);
    if (!userRow) {
      return res.status(404).json({ message: "No account found for that email or phone." });
    }

    const result = await consumeOtp(userRow.id, "login", otp);
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    const user = sanitizeUser(userRow);
    res.json({
      message: "Signed in successfully.",
      token: createToken(user),
      user,
    });
  } catch (error) {
    console.error("Login OTP verify error:", error);
    res.status(500).json({ message: "Unable to verify OTP right now." });
  }
});

app.post("/api/auth/forgot-password/request-otp", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Email or phone is required." });
    }

    const field = isEmail(identifier) ? "email" : "phone";
    const [rows] = await pool.query(`SELECT * FROM users WHERE ${field} = ? LIMIT 1`, [identifier]);
    const userRow = rows[0];

    if (!userRow) {
      return res.status(404).json({ message: "No account found for that email or phone." });
    }

    const { otp } = await createOtp(userRow.id, "password_reset");
    res.json({
      message: "Reset OTP generated successfully.",
      devOtp: DEV_EXPOSE_OTP ? otp : undefined,
    });
  } catch (error) {
    console.error("Forgot password OTP request error:", error);
    res.status(500).json({ message: "Unable to generate reset OTP right now." });
  }
});

app.post("/api/auth/forgot-password/reset", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "Identifier, OTP, and new password are required." });
    }

    const field = isEmail(identifier) ? "email" : "phone";
    const [rows] = await pool.query(`SELECT * FROM users WHERE ${field} = ? LIMIT 1`, [identifier]);
    const userRow = rows[0];

    if (!userRow) {
      return res.status(404).json({ message: "No account found for that email or phone." });
    }

    const result = await consumeOtp(userRow.id, "password_reset", otp);
    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userRow.id]);

    res.json({ message: "Password reset successfully." });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Unable to reset password right now." });
  }
});

app.patch("/api/users/:id/profile", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, profilePhoto = "" } = req.body;

    if (!id || !name || !email || !phone) {
      return res.status(400).json({ message: "Name, email, and phone are required." });
    }

    const [existingRows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ message: "User not found." });
    }

    const [duplicateRows] = await pool.query(
      "SELECT id FROM users WHERE (email = ? OR phone = ?) AND id <> ? LIMIT 1",
      [email.trim(), phone.trim(), id]
    );
    if (duplicateRows.length > 0) {
      return res.status(409).json({ message: "Email or phone already belongs to another account." });
    }

    await pool.query(
      `UPDATE users
       SET name = ?, email = ?, phone = ?, profile_photo = ?
       WHERE id = ?`,
      [name.trim(), email.trim(), phone.trim(), profilePhoto || null, id]
    );

    const [updatedRows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    const user = sanitizeUser(updatedRows[0]);
    res.json({
      message: "Profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Unable to update profile right now." });
  }
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Auth server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
