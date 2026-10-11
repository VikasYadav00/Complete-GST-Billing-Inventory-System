import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { WhatsAppService } from './services/whatsapp.service.js';

const PORT = env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected successfully');

    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║     RetailPro - GST Billing & Inventory API     ║
╠════════════════════════════════════════════════╣
║  Status:  🟢 Running                           ║
║  Mode:    ${env.NODE_ENV.padEnd(36)}║
║  URL:     http://localhost:${PORT}              ║
║  API:     /api/v1                              ║
║  Health:  /health                              ║
╚════════════════════════════════════════════════╝
      `);
    });

    // Background WhatsApp job processor — runs every 2 minutes
    if (env.NODE_ENV !== 'test') {
      setInterval(async () => {
        try {
          await WhatsAppService.processPendingJobs();
        } catch (err) {
          console.error('[WHATSAPP_WORKER] Error processing jobs:', err);
        }
      }, 2 * 60 * 1000);
    }

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[${signal}] Shutting down server gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('✅ Server and database connections closed');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
