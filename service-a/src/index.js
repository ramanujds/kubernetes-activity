const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SERVICE_B_URL = process.env.SERVICE_B_URL || "http://localhost:8000";
const APP_ENV = process.env.APP_ENV || "development";

const orders = [
  { id: 1, productId: 101, quantity: 2, status: "pending" },
  { id: 2, productId: 102, quantity: 1, status: "shipped" },
  { id: 3, productId: 103, quantity: 5, status: "delivered" },
];

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "orders-service", env: APP_ENV });
});

app.get("/orders", async (req, res) => {
  try {
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const { data: product } = await axios.get(
          `${SERVICE_B_URL}/products/${order.productId}`
        );
        return { ...order, product };
      })
    );
    res.json({ orders: enriched });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch products", detail: err.message });
  }
});

app.get("/orders/:id", async (req, res) => {
  const order = orders.find((o) => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found" });

  try {
    const { data: product } = await axios.get(
      `${SERVICE_B_URL}/products/${order.productId}`
    );
    res.json({ ...order, product });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch product", detail: err.message });
  }
});

app.post("/orders", async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    return res.status(400).json({ error: "productId and quantity are required" });
  }

  try {
    const { data: product } = await axios.get(
      `${SERVICE_B_URL}/products/${productId}`
    );
    const newOrder = {
      id: orders.length + 1,
      productId,
      quantity,
      status: "pending",
    };
    orders.push(newOrder);
    res.status(201).json({ ...newOrder, product });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: `Product ${productId} not found` });
    }
    res.status(502).json({ error: "Failed to validate product", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Orders service running on port ${PORT} [${APP_ENV}]`);
  console.log(`Products service URL: ${SERVICE_B_URL}`);
});
