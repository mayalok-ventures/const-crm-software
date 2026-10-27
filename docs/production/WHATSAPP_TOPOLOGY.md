# Sahyak CRM — WhatsApp & Baileys Architecture Topology

## 1. Current Architectural Design
- **Session Management**: Baileys WebSocket sockets are maintained in Node.js process memory (`waSession.js`).
- **Auth State Storage**: WhatsApp authentication credentials and multi-device session keys are persisted securely in MongoDB (`waAuthStore`).
- **Isolation**: Sessions are isolated on a per-user basis.

---

## 2. Deployment Topology Constraints

### Single-Instance Deployment (Fully Supported)
In a single-instance container or VM (e.g., AWS EC2, single ECS task), WhatsApp connections function out of the box with auto-reconnect and database auth persistence.

### Multi-Instance / Horizontal Scaling (Documented Limitation)
Because Baileys sockets are in-memory TCP/WebSocket connections bound to the local process:
1. **Option A (Recommended for Multi-Instance)**: Run a dedicated singleton WhatsApp Socket Worker service that manages all Baileys connections. The HTTP API communicates with the worker via internal RPC or Redis pub/sub.
2. **Option B**: Use sticky session load balancing with routing keys ensuring all requests for a given tenant/user route to the container hosting their active socket.
