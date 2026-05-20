# DevOps Activity: Microservices on Kubernetes

Two REST API services that call each other, deployed on Kubernetes.

```
┌─────────────────────────────────────────────┐
│              Kubernetes Cluster              │
│  namespace: microservices                    │
│                                              │
│  ┌──────────────────┐   ┌────────────────┐  │
│  │  orders-service  │──▶│products-service│  │
│  │   (Node.js)      │◀──│  (Python/Fast  │  │
│  │   port: 3000     │   │   API) :8000   │  │
│  └──────────────────┘   └────────────────┘  │
└─────────────────────────────────────────────┘
```

## Services

| Service | Language | Port | Calls |
|---------|----------|------|-------|
| orders-service | Node.js + Express | 3000 | → products-service |
| products-service | Python + FastAPI | 8000 | → orders-service |

### API Endpoints

**orders-service**
- `GET /health` — health check
- `GET /orders` — list all orders (enriched with product details)
- `GET /orders/:id` — single order with product details
- `POST /orders` — create order `{ "productId": 101, "quantity": 2 }`

**products-service**
- `GET /health` — health check
- `GET /products` — list all products
- `GET /products/:id` — single product
- `GET /products/:id/orders` — product with its orders (calls back to orders-service)

---

## Prerequisites

- Docker
- kubernetes cluster 
- kubectl (`brew install kubectl`)

---

## Step 1 — Setup cluster docker desktop or minikube
### Option A: Docker Desktop
- Install Docker Desktop and enable Kubernetes in settings.
### Option B: Minikube
- Install minikube (`brew install minikube`).
- Start cluster: `minikube start --cpus=4 --memory=4096`

---

## Step 2 — Build Docker images

```bash
# Build orders-service (Node.js)
docker build -t orders-service:latest ./service-a

# Build products-service (Python FastAPI)
docker build -t products-service:latest ./service-b
```

Verify both images are available:

```bash
docker images | grep -E "orders|products"
```

---

## Step 4 — Deploy to Kubernetes

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy products-service first (orders-service depends on it)
kubectl apply -f k8s/service-b/configmap.yaml
kubectl apply -f k8s/service-b/deployment.yaml
kubectl apply -f k8s/service-b/service.yaml

# Deploy orders-service
kubectl apply -f k8s/service-a/configmap.yaml
kubectl apply -f k8s/service-a/deployment.yaml
kubectl apply -f k8s/service-a/service.yaml
```

---

## Step 5 — Verify pods are running

```bash
kubectl get pods -n microservices
```

Expected output:
```
NAME                               READY   STATUS    RESTARTS   AGE
orders-service-xxx-xxx             1/1     Running   0          30s
orders-service-yyy-yyy             1/1     Running   0          30s
products-service-xxx-xxx           1/1     Running   0          35s
products-service-yyy-yyy           1/1     Running   0          35s
```

Check logs:
```bash
kubectl logs -n microservices -l app=orders-service --tail=20
kubectl logs -n microservices -l app=products-service --tail=20
```

---

## Step 6 — Test the services

Open two terminals. In the first, forward orders-service:

```bash
kubectl port-forward -n microservices svc/orders-service 3000:3000
```

In the second, forward products-service:

```bash
kubectl port-forward -n microservices svc/products-service 8000:8000
```

### Test orders-service (calls products-service internally)

```bash
# Health check
curl http://localhost:3000/health

# List all orders — each order is enriched with product data from products-service
curl http://localhost:3000/orders | jq

# Get a single order
curl http://localhost:3000/orders/1 | jq

# Create a new order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": 102, "quantity": 3}' | jq

# Try a non-existent product (should return 404)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": 999, "quantity": 1}' | jq
```

### Test products-service (calls back to orders-service)

```bash
# Health check
curl http://localhost:8000/health

# List products
curl http://localhost:8000/products | jq

# Get a single product
curl http://localhost:8000/products/101 | jq

# Get product with its orders (calls orders-service!)
curl http://localhost:8000/products/101/orders | jq

# Swagger UI (FastAPI auto-generates this)
open http://localhost:8000/docs
```

---

## Step 7 — Inspect environment variables in pods

```bash
# See all env vars injected from ConfigMap
kubectl exec -n microservices \
  $(kubectl get pod -n microservices -l app=orders-service -o jsonpath='{.items[0].metadata.name}') \
  -- env | grep -E "APP_ENV|PORT|SERVICE"

kubectl exec -n microservices \
  $(kubectl get pod -n microservices -l app=products-service -o jsonpath='{.items[0].metadata.name}') \
  -- env | grep -E "APP_ENV|PORT|SERVICE"
```

---

## Step 8 — Scale a deployment

```bash
# Scale orders-service to 3 replicas
kubectl scale deployment orders-service -n microservices --replicas=3

# Watch pods spin up
kubectl get pods -n microservices -w
```

---

## Step 9 — Update a ConfigMap and restart

```bash
# Edit the configmap
kubectl edit configmap orders-service-config -n microservices

# Rolling restart to pick up new env vars
kubectl rollout restart deployment/orders-service -n microservices

# Watch rollout status
kubectl rollout status deployment/orders-service -n microservices
```

## Cleanup

```bash
kubectl delete namespace microservices
minikube stop
```

---

## Project Structure

```
devops/
├── service-a/                  # Node.js Orders service
│   ├── src/
│   │   └── index.js            # Express app
│   ├── package.json
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
├── service-b/                  # Python FastAPI Products service
│   ├── main.py                 # FastAPI app
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env.example
└── k8s/
    ├── namespace.yaml
    ├── service-a/
    │   ├── configmap.yaml      # Environment variables
    │   ├── deployment.yaml     # Pod spec + resource limits + probes
    │   └── service.yaml        # ClusterIP for internal DNS
    ├── service-b/
    │   ├── configmap.yaml
    │   ├── deployment.yaml
    │   └── service.yaml
    └── ingress.yaml            # Optional external access
```


