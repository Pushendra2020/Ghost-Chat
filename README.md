# Ghost Chat: Private P2P Messaging App

## 1. What is Ghost Chat?
Ghost Chat is an end-to-end encrypted, true Peer-to-Peer (P2P) messaging application designed for **temporary, secure file sharing and communication.**

Unlike standard chat apps (like WhatsApp or Telegram), **Ghost Chat is completely ephemeral:**
- **No Message History:** Messages and files are sent directly from your device to your peer's device. The server never touches your messages, meaning your chat is lost forever the moment you close the tab.
- **Both Users Must Be Online:** Because there is no server acting as a holding area, you and your friend must both be online simultaneously to connect via IDs and start chatting.
- **Auto-Deleting Accounts:** To ensure total anonymity, every user ID and connection request stored in the database is subject to a 4-hour TTL (Time-To-Live) index. **Every 4 hours, the database completely resets**, leaving zero trace of your existence.

The central server is only used momentarily to introduce the two devices to each other (signaling/handshake). Once the direct WebRTC connection is established, the central server drops out entirely.
- **True P2P Connectivity:** Direct device-to-device communication using WebRTC Data Channels.
- **Zero Storage Policy:** Only connection requests and user identifiers are temporarily stored in the database. Messages vanish when you close the chat.
- **Rich File Sharing:** Send large files directly to your peers without waiting for server uploads.
  - Files, Videos, Audio up to 200MB.
  - Images up to 10MB (rendered inline).
- **Modern Interface:** Clean, familiar iMessage/WhatsApp-style UI with fluid micro-animations.
- **Encrypted by Default:** WebRTC data channels are inherently encrypted.

## 3. Technology Stack and Architecture
To achieve a seamless P2P connection across the internet, Ghost Chat utilizes several networking technologies working in tandem:

- **WebRTC (Web Real-Time Communication):** The core API built into modern browsers that establishes the secure, direct tunnel for high-speed data transfer without an intermediary server.
- **STUN (Session Traversal Utilities for NAT):** A lightweight server that helps devices discover their own public IP addresses. Devices sitting behind home routers use STUN to find out how the outside internet sees them.
- **TURN (Traversal Using Relays around NAT):** A fallback server. If strict corporate firewalls or symmetric NATs block a direct WebRTC connection between two peers, the TURN server acts as a relay to pass the encrypted data between them.
- **Socket.io (WebSockets):** The "Signaling Server". Before WebRTC can connect, the devices must exchange their public IP information (discovered via STUN) with each other. Socket.io handles this initial, temporary "handshake" introduction.
- **Next.js & React:** The frontend framework and UI layer.
- **MongoDB:** A lightweight database used strictly to generate unique User IDs and track pending connection requests (`/lobby`).

## 4. Installation and Local Setup

### Prerequisites
1. **Node.js** installed on your machine.
2. A **MongoDB Server** (or MongoDB Atlas Cloud Database).
3. A **TURN Server Provider** (We recommend the free tier of [Metered.ca](https://www.metered.ca/docs/)).

### Steps to Run Locally
1. Clone the repository and navigate into the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory and add your MongoDB connection string and Metered TURN credentials:
   ```env
   # Database
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/

   # TURN Server (Get these from Metered.ca)
   NEXT_PUBLIC_TURN_SERVER_URL=turn:your-metered-subdomain.metered.live:80
   NEXT_PUBLIC_TURN_SERVER_USERNAME=your_metered_username
   NEXT_PUBLIC_TURN_SERVER_CREDENTIAL=your_metered_credential
   ```
4. Start the custom Next.js Socket server:
   ```bash
   node server.mjs
   ```
5. Open your browser and navigate to `http://localhost:3000`.

## 5. Configuring STUN vs. TURN

By default, the application is configured to use your custom **TURN server** (which handles both STUN and TURN capabilities reliably). 

If you want to test the app locally without signing up for a TURN provider, you can easily switch back to Google's public (and free) **STUN server**. 

To do this, simply modify the `RTCPeerConnection` configuration in your codebase:

**File:** `hooks/useWebRTC.ts` (around Line 246)

```typescript
const peerConnection = new RTCPeerConnection({
    iceServers: [
        // --- STUN Server Configuration ---
        // To use STUN, UNCOMMENT the line below and COMMENT OUT the TURN block.
        // { urls: 'stun:stun.l.google.com:19302' }
        
        // --- TURN Server Configuration ---
        // To use TURN, keep this block active and ensure your .env variables are set.
        {
            urls: process.env.NEXT_PUBLIC_TURN_SERVER_URL || 'turn:turn.server.url:3478',
            username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME || 'username',
            credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL || 'password'
        }
    ],
    iceTransportPolicy: 'relay' // IMPORTANT: Remove this line if switching to STUN!
});
```

*(Note: When switching to pure STUN, be sure to remove the `iceTransportPolicy: 'relay'` flag, as that flag forces the connection to strictly use the TURN relay.)*
