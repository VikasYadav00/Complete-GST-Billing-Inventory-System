import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import saleRoutes from './routes/sale.routes.js';
import customerRoutes from './routes/customer.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import reportRoutes from './routes/report.routes.js';
import businessRoutes from './routes/business.routes.js';

const app = express();

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: env.NODE_ENV === 'production',
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
}));

// Body parsing (capture raw body for webhook signature verification)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/v1/webhooks/whatsapp') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'RetailPro API is running', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/purchases', purchaseRoutes);
apiRouter.use('/sales', saleRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/business', businessRoutes);

// WhatsApp Webhook Verification & Events
apiRouter.get('/webhooks/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[WEBHOOK] WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ success: false, message: 'Webhook verification failed' });
  }
});

apiRouter.post('/webhooks/whatsapp', (req: Request, res: Response) => {
  // Acknowledge immediately to prevent WhatsApp from retrying
  res.sendStatus(200);
  
  const rawBody = req.body as Buffer;
  const signature = req.headers['x-hub-signature-256'] as string;
  
  const { WhatsAppService } = require('./services/whatsapp.service.js');
  if (!WhatsAppService.verifyWebhookSignature(rawBody, signature)) {
    console.warn('[WEBHOOK] Invalid WhatsApp webhook signature, ignoring');
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch { return; }

  // Handle delivery status updates
  const statuses = payload?.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (statuses) {
    for (const status of statuses) {
      const { id: gatewayMessageId, status: deliveryStatus } = status;
      const prismaStatus = deliveryStatus === 'delivered' ? 'DELIVERED' : deliveryStatus === 'failed' ? 'FAILED' : null;
      if (prismaStatus) {
        const { prisma } = require('./db/prisma.js');
        prisma.notificationJob.updateMany({ where: { gatewayMessageId }, data: { status: prismaStatus } }).catch(console.error);
      }
    }
  }
});

app.use('/api/v1', apiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
});

// Global error handler
app.use(errorHandler);

export { app };
