# StockGrid

**Intelligent Multi-Warehouse Inventory Management & Proximity Fulfillment Platform**

[![Node.js](https://img.shields.io/badge/Node.js-v20.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20ReplSet-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-In--Memory%20Cache-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Message%20Queues-FF4500)](https://bullmq.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

```
   ____  _             _     ____      _     _ 
  / ___|| |_ ___   ___| | __/ ___|_ __(_) __| |
  \___ \| __/ _ \ / __| |/ / |  _| '__| |/ _` |
   ___) | || (_) | (__|   <| |_| | |  | | (_| |
  |____/ \__\___/ \___|_|\_\\____|_|  |_|\__,_|
```

---

## 💼 The Business Problem

Modern commerce and logistics operations that scale across multiple regional fulfillment hubs struggle with critical operational bottlenecks:

1. **Overselling During Traffic Spikes:** When high-volume orders hit simultaneously across multiple channels, systems sell stock they do not possess, resulting in canceled orders, negative customer reviews, and marketplace penalty fees.
2. **High Shipping Costs & Delayed Delivery:** Orders are routinely routed to default warehouses rather than the facility closest to the customer, inflating freight expenses and extending shipping times.
3. **Cart Abandonment "Ghost Locks":** E-commerce checkouts lock up physical stock indefinitely when shoppers abandon carts, creating artificial stockouts that prevent genuine customers from buying.
4. **Facility Blind Spots & Overcrowding:** Warehouse managers lack real-time visibility into physical capacity limits, leading to facility overcrowding or stock sitting stranded in high-cost distribution centers.
5. **Disconnected Supply Chain Ecosystems:** External enterprise resource planning (ERP) platforms, suppliers, and third-party logistics (3PL) providers are not notified when stock drops below minimum thresholds, delaying restock cycles.

---

## 💡 What StockGrid Does

**StockGrid** is an intelligent supply chain command center designed to optimize multi-node inventory allocation, safeguard inventory integrity, and automate downstream fulfillment:

* 📍 **Smart Proximity Routing:** Evaluates destination GPS coordinates and automatically fulfills orders from the nearest regional warehouse to minimize transit times and carrier freight costs.
* 📦 **Dynamic Split-Fulfillment:** If the closest warehouse cannot fulfill an entire order, StockGrid intelligently splits allocations across neighboring facilities to fulfill the order without manual intervention.
* ⏱️ **Zero-Ghost Checkout Reservations:** Places temporary holds on stock during checkout with an autonomous 10-minute expiration timer. If the purchase is abandoned, inventory is returned to sellable stock immediately.
* 🛡️ **Guaranteed Concurrency Protection:** Eliminates negative stock and duplicate inventory deductions under high-volume webhook surges using database-level transaction locks.
* 🔔 **Automated Supplier Restock Signals:** Continuously evaluates inventory against minimum safety thresholds and immediately broadcasts cryptographically signed webhooks to external vendors and ERPs.
* 🏢 **Facility Capacity & Occupancy Tracking:** Monitors physical space limits and occupancy rates across all fulfillment centers to prevent facility over-allocation.
* 📜 **Full Auditability:** Maintains an immutable ledger tracking every inbound restock, outbound dispatch, inter-facility transfer, and manual stock adjustment.

---

## ⚙️ How We Built It (Technical Implementation)

| Business Capability | How It Was Solved Technically |
| :--- | :--- |
| **Proximity Dispatching** | Applied the **Haversine Great-Circle Formula** to calculate real-world physical distances between delivery coordinates and warehouse latitude/longitude nodes. Implemented a fallback sorter that evaluates single-node vs. multi-node split shipments. |
| **Oversell Prevention** | Wrapped all stock mutations in **MongoDB ACID Multi-Document Transactions** (`session.withTransaction`). Atomic condition checks verify available stock before decrementing, completely isolating concurrent requests. |
| **Temporary Reservation Holds** | Implemented an **Available-to-Promise (ATP)** model (`ATP = currentQuantity - reservedQuantity`). When stock is held, a delayed **BullMQ job with a 10-minute TTL** is queued. If checkout confirmation is not received, a background worker autonomously rolls back the reservation. |
| **Duplicate Order Protection** | Built custom **Redis Network Idempotency Middleware**. Hashes incoming `Idempotency-Key` headers or order IDs, intercepts concurrent in-flight retries with `409 Conflict`, and caches successful responses for 24 hours. |
| **Downstream System Sync** | Engineered an **asynchronous event worker** on BullMQ. When stock crosses thresholds, events (`stock.low`, `stock.replenished`) are broadcast to registered subscriber URLs with **HMAC-SHA256 cryptographic signatures** for validation. |
| **Command Center UI** | Created a **React 18 + Vite** dashboard with real-time capacity meters, browser GPS location detection, and an interactive routing dispatch simulator. |

---

## 🔄 End-to-End Fulfillment Flow

```
[ Customer Places Order ] ──► (Web / REST / Webhook)
                                     │
                                     ▼
                   [ Redis Idempotency Interceptor ]
                   ├── Key exists in cache? ──► Return cached result (No double deduction)
                   └── Key is new? ──► Acquire processing lock
                                     │
                                     ▼
                     [ Haversine Proximity Router ]
                   ├── Calculate distance to all active warehouses
                   ├── Sort facilities by shortest transit distance
                   └── Determine single-node or split fulfillment
                                     │
                                     ▼
                    [ Two-Phase Stock Reservation ]
                   ├── Check Available-to-Promise (ATP >= Requested Qty)
                   ├── Increment reservedQuantity in ACID Transaction
                   └── Schedule BullMQ 10-Minute Expiry Job
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
     [ Payment Confirmed ]                   [ Cart Abandoned / Timeout ]
     ├── Deduct currentQuantity              ├── BullMQ Worker wakes up
     ├── Clear reservedQuantity              ├── Decrement reservedQuantity
     ├── Write StockMovement Ledger          └── Restore ATP for other shoppers
     └── Queue low-stock alerts if needed
```

---

## 🏛️ System Architecture

```
                                 ┌───────────────────────────────┐
                                 │      React 18 + Vite Web      │
                                 │   • Live Inventory Ledger     │
                                 │   • GPS Dispatch Simulator    │
                                 │   • Multi-Facility Analytics  │
                                 └───────────────┬───────────────┘
                                                 │ HTTPS / Bearer Token
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Express.js 5 API Gateway                                    │
│   ├── JWT Auth & Role-Based Access Control (Admin / Standard)                              │
│   ├── SHA-256 API Key Verification (External Systems)                                       │
│   ├── Redis Network Idempotency Layer (Duplicate Request Interception)                     │
│   └── Route Rate Limiting & Error Handlers                                                  │
└──────────────┬───────────────────────────────┬───────────────────────────────┬──────────────┘
               │                               │                               │
    (ACID Transactions)              (Cache & Job Backing)            (Queue Monitoring)
               ▼                               ▼                               ▼
  ┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
  │      MongoDB Atlas      │     │      Redis (Alpine)     │     │    Bull-Board Admin     │
  │ • Compound Unique Index │     │ • Cache Aside Layer     │     │ • Path: /admin/queues   │
  │ • Stock & Movement Logs │     │ • Idempotency 24h Store │     │ • Stock & Rsv Monitors  │
  │ • Replica Set Ready     │     │ • BullMQ Stream Queues  │     │ • Protected Route       │
  └─────────────────────────┘     └────────────┬────────────┘     └─────────────────────────┘
                                               │
                                      BullMQ Job Processors
                                               │
                                 ┌─────────────┴─────────────┐
                                 ▼                           ▼
                    ┌─────────────────────────┐ ┌─────────────────────────┐
                    │    Reservation Worker   │ │   Stock Alert Worker    │
                    │ • 10-Minute Expiry TTL  │ │ • Low-Stock Notifications│
                    │ • Auto Rollback to ATP  │ │ • HMAC-SHA256 Webhooks  │
                    └─────────────────────────┘ └─────────────────────────┘
```

---

## 🛠️ Tech Stack

* **Frontend:** React 18, Vite, React Router v6, Tailwind CSS, Lucide Icons, React Hot Toast, Axios
* **Backend:** Node.js 20, Express.js 5, Mongoose ODM, Dotenv, CORS, Express Validator
* **Queues & Cache:** Redis 7 (Alpine), BullMQ, `@bull-board/express`
* **Security:** JWT (JSON Web Tokens), Bcrypt.js, SHA-256 (API Keys), HMAC-SHA256, Express Rate Limit
* **Testing:** Jest, Supertest, `mongodb-memory-server` (Replica Sets)
* **DevOps & Cloud:** Docker (Multi-Stage), Docker Compose, GitHub Actions, AWS EC2

---

## 📡 Core API Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Access | Business Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Onboard new warehouse operators and admins |
| `POST` | `/api/auth/login` | Public | Authenticate operator and issue JWT session token |
| `GET` | `/api/auth/me` | User | Retrieve current user profile and role |

### 🏬 Facility Management (`/api/warehouses`)
| Method | Endpoint | Access | Business Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/warehouses` | User / Key | View all active facilities with GPS locations and capacities |
| `POST` | `/api/warehouses` | Admin | Register new regional fulfillment center with physical capacity |
| `PUT` | `/api/warehouses/:id` | Admin | Update facility address, storage limits, or status |
| `DELETE` | `/api/warehouses/:id` | Admin | Decommission or deactivate warehouse node |

### 📦 Catalog Management (`/api/products`)
| Method | Endpoint | Access | Business Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | User / Key | View product catalog, unit costs, and reorder thresholds |
| `POST` | `/api/products` | Admin | Add new inventory SKU to system |
| `PUT` | `/api/products/:id` | Admin | Modify SKU unit costs or minimum safety stock thresholds |
| `DELETE` | `/api/products/:id` | Admin | Deactivate discontinued SKU |

### 📊 Stock Management & Reservations (`/api/stock`)
| Method | Endpoint | Access | Business Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stock` | User / Key | Live visibility into on-hand and available-to-promise inventory |
| `GET` | `/api/stock/warehouse/:warehouseId` | User / Key | Monitor facility occupancy rate, total items, and space remaining |
| `GET` | `/api/stock/product/:productId` | User / Key | View SKU distribution across all regional warehouses |
| `GET` | `/api/stock/availability` | User / Key | **Simulate order dispatch** with Haversine distance and split suggestions |
| `POST` | `/api/stock/reserve` | User / Key | **Hold stock for checkout** with automated 10-minute TTL release |
| `POST` | `/api/stock/confirm` | User / Key | **Confirm purchase** and convert reservation into physical outbound dispatch |
| `POST` | `/api/stock/release` | User / Key | **Cancel hold** and immediately restore sellable balance |

### 🔄 Movements & Audit Ledger (`/api/movements`)
| Method | Endpoint | Access | Business Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/movements` | User / Key | Immutable audit trail of all receipts, dispatches, and adjustments |
| `POST` | `/api/movements` | User / Key | Record inbound restock or outbound shipment via ACID transaction |
| `POST` | `/api/movements/transfer` | User / Key | Transfer inventory between two facilities with capacity checking |

### 🔑 External Integrations & Webhooks
| Method | Endpoint | Access | Business Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/apikeys` | Admin | List external developer API credentials and webhook subscribers |
| `POST` | `/api/apikeys` | Admin | Provision API key & HMAC secret for third-party ERP/3PL integration |
| `DELETE` | `/api/apikeys/:id` | Admin | Instantly revoke compromised API credentials |
| `POST` | `/api/webhooks/order-placed` | User / Key | **Automated order ingestion** with duplicate protection and nearest dispatch |

---

## 🧪 Testing & Reliability

The test suite validates data consistency and concurrency handling using **Jest**, **Supertest**, and `mongodb-memory-server` configured with an in-memory **replica set** to execute real multi-document ACID transactions:

```bash
# Run the test suite
cd server
npm test

# Run tests in watch mode
npm run test:watch
```

* **Concurrency Race Tests (`concurrency_idempotency.test.js`):** Simulates 20 simultaneous parallel order requests racing for 5 units of stock to prove zero overselling and zero negative balances.
* **Idempotency Verification:** Confirms that duplicate network retries return identical cached payloads without deducting inventory twice.
* **Reservation Lifecycle Tests (`reservation.test.js`):** Confirms that reserved stock locks sellable balance and restores upon expiration or manual release.

---

## 🚀 Quickstart (Local Development)

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v20.x+)
* [Docker Desktop](https://www.docker.com/) (v24.0+)
* [Git](https://git-scm.com/)

### 2. Setup Environment Variables

In `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/stockgrid?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

In `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Run with Docker Compose
```bash
docker compose up -d --build
```

### 4. Endpoints
* **Web Dashboard:** [http://localhost:5173](http://localhost:5173)
* **API Server:** [http://localhost:5000](http://localhost:5000)
* **Bull-Board Queue Monitor:** [http://localhost:5000/admin/queues](http://localhost:5000/admin/queues) *(Admin JWT required)*
* **Redis Instance:** `localhost:6379`

---

## 🚢 CI/CD & Production Deployment

* **Automated CI (GitHub Actions):** On every pull request or push to `main`, an automated pipeline boots an isolated Redis container, runs full test suites against an in-memory replica set, and verifies production Vite builds.
* **Continuous Deployment (AWS EC2):** Automatically pulls the latest release into AWS EC2 and executes zero-downtime container rebuilds.

---

## 📄 License

This project is licensed under the ISC License.
