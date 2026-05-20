from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import httpx

app = FastAPI(title="Products Service", version="1.0.0")

APP_ENV = os.getenv("APP_ENV", "development")
PORT = int(os.getenv("PORT", 8000))
SERVICE_A_URL = os.getenv("SERVICE_A_URL", "http://localhost:3000")

PRODUCTS = {
    101: {"id": 101, "name": "Mechanical Keyboard", "price": 129.99, "stock": 50},
    102: {"id": 102, "name": "USB-C Hub", "price": 49.99, "stock": 120},
    103: {"id": 103, "name": "4K Monitor", "price": 399.99, "stock": 15},
    104: {"id": 104, "name": "Webcam HD", "price": 79.99, "stock": 80},
}


class Product(BaseModel):
    id: int
    name: str
    price: float
    stock: int


@app.get("/health")
def health():
    return {"status": "ok", "service": "products-service", "env": APP_ENV}


@app.get("/products", response_model=list[Product])
def list_products():
    return list(PRODUCTS.values())


@app.get("/products/{product_id}", response_model=Product)
def get_product(product_id: int):
    product = PRODUCTS.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return product


@app.get("/products/{product_id}/orders")
async def get_orders_for_product(product_id: int):
    """Calls back to Orders service to fetch orders for this product."""
    if product_id not in PRODUCTS:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(f"{SERVICE_A_URL}/orders")
            resp.raise_for_status()
            all_orders = resp.json().get("orders", [])
            matching = [o for o in all_orders if o.get("productId") == product_id]
            return {
                "product": PRODUCTS[product_id],
                "orders": matching,
                "total": len(matching),
            }
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach orders service: {exc}",
            )
