import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";

import { prisma } from "./db.js";
import { requireAuth, signToken } from "./auth.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "name, email, password are required" });
  }

  if (String(password).length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      password: passwordHash,
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const token = signToken(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET
  );
  res.status(201).json({ token, user });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user)
    return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });

  const token = signToken(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET
  );
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const userId = Number(req.user?.sub);
  if (!Number.isInteger(userId))
    return res.status(401).json({ error: "Invalid token" });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

app.get("/api/orders", requireAuth, async (req, res) => {
  const userId = Number(req.user?.sub);
  if (!Number.isInteger(userId))
    return res.status(401).json({ error: "Invalid token" });
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  res.json({ orders: orders.map(serializeOrder) });
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const userId = Number(req.user?.sub);
  if (!Number.isInteger(userId))
    return res.status(401).json({ error: "Invalid token" });
  const { location, items } = req.body || {};

  if (!location || !String(location).trim()) {
    return res.status(400).json({ error: "location is required" });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array" });
  }

  // Compute totals server-side from the client-provided snapshot.
  let subtotalCents = 0;
  const normalizedItems = items.map((i) => {
    const qty = Math.max(1, Math.floor(Number(i?.qty) || 1));
    const priceCents = toCents(i?.price);
    subtotalCents += qty * priceCents;

    return {
      name: String(i?.name || ""),
      category: String(i?.category || ""),
      price: Number(i?.price) || 0,
      qty,
    };
  });

  if (subtotalCents <= 0) {
    return res.status(400).json({ error: "Invalid order subtotal" });
  }

  const deliveryFeeCents = toCents(4.99);
  const totalCents = subtotalCents + deliveryFeeCents;

  const createdAt = new Date();
  const etaAt = new Date(createdAt.getTime() + 30 * 60 * 1000);

  const order = await prisma.order.create({
    data: {
      userId,
      location: String(location).trim(),
      items: normalizedItems,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      status: "confirmed",
      etaAt,
    },
  });

  res.status(201).json({ order: serializeOrder(order) });
});

function serializeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt.getTime(),
    etaAt: order.etaAt.getTime(),
    deliveredAt: order.deliveredAt ? order.deliveredAt.getTime() : null,
    location: order.location,
    items: order.items,
    subtotal: order.subtotalCents / 100,
    deliveryFee: order.deliveryFeeCents / 100,
    total: order.totalCents / 100,
  };
}

// Serve your existing static site so fetch() is same-origin (no CORS issues).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname is .../Moms_project/server/src
// We want to serve .../Moms_project
const projectRoot = path.resolve(__dirname, "..", "..");

app.get("/", (req, res) => {
  res.redirect("/home_page.html");
});

app.use(express.static(projectRoot));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`MOMS server running on http://localhost:${port}`);
});
