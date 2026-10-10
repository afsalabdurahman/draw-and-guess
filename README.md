# Pictionary Game

A real-time multiplayer Pictionary game (Skribbl.io style).

## Architecture

Please thoroughly read the [ARCHITECTURE.md](./ARCHITECTURE.md) for the non-negotiable project rules, state management, and structure before starting any work on this project.

## Getting Started

This project is divided into a Node.js server and a React client.

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Running the Server

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server (assuming a `dev` script in `package.json`):
   ```bash
   npm run dev
   ```

### Running the Client

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Deployment

To deploy this application to production:

1. **Build the Client:**
   Navigate to the `client` directory and run:
   ```bash
   npm run build
   ```
   This will generate a `dist` folder. You can serve this folder statically using Nginx, Vercel, or any static file host.

2. **Configure the Server:**
   The server runs on Node.js. 
   - Ensure you set the `PORT` environment variable (defaults to 4000).
   - Ensure your CORS origin in `server/src/index.js` matches your production client URL.

3. **Scaling (Important):**
   This game relies heavily on in-memory state and WebSockets. If you scale the Node.js server horizontally across multiple instances (e.g. using a load balancer or Kubernetes), you **MUST**:
   - Enable sticky sessions on your load balancer.
   - Install and configure a Redis server.
   - Attach the `@socket.io/redis-adapter` to the Socket.IO instance to sync events across nodes.
   - Extract the `roomManager` state into Redis (as the current `Map` is local memory only).
