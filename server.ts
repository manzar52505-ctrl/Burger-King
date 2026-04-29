import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import compression from "compression";
import menuRoutes from "./src/api/routes/menuRoutes.ts";
import userRoutes from "./src/api/routes/userRoutes.ts";
import orderRoutes from "./src/api/routes/orderRoutes.ts";
import authRoutes from "./src/api/routes/authRoutes.ts";
import paymentRoutes from "./src/api/routes/paymentRoutes.ts";
import analyticsRoutes from "./src/api/routes/analyticsRoutes.ts";

// Config & Middleware
import { getDeals } from "./src/api/controllers/menuController.ts";
import { initDb } from "./src/api/models/schema.ts";
import { seedDb } from "./src/api/models/seed.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use compression for responses
  app.use(compression());

  // Trust proxy for external connectivity
  app.set('trust proxy', 1);

  // Enable CORS for same-origin and relative requests
  app.use(cors());

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.use("/api/menu", menuRoutes);
  app.get("/api/deals", getDeals);
  app.use("/api/users", userRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/payment", paymentRoutes);
  app.use("/api/analytics", analyticsRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Cache static assets longer in production
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initialize DB Schema and Seed only if valid credentials are present
    const host = process.env.POSTGRES_HOST;
    const url = process.env.DATABASE_URL;
    
    // Stricter validation for database credentials
    const isInvalidHost = (h: string | undefined) => 
      !h || 
      h === 'base' || 
      h === 'localhost' || 
      h === '0.0.0.0' ||
      h.includes('your-') || 
      h.includes('placeholder');
      
    const isInvalidUrl = (url: string | undefined) => 
      !url || 
      url.includes('base') || 
      url.includes('placeholder') || 
      url.includes('your-');
    
    const hasValidConfig = (!isInvalidUrl(url)) || (!isInvalidHost(host));
    
    if (hasValidConfig) {
      console.log('Valid database credentials detected. Initializing PostgreSQL...');
      try {
        await initDb();
        await seedDb();
      } catch (e) {
        console.warn('Database initialization failed:', e instanceof Error ? e.message : 'Unknown error');
        console.log('Falling back to local data.');
      }
    } else {
      console.log('No external database configured. Using local constants for data.');
    }
  });
}

startServer();

