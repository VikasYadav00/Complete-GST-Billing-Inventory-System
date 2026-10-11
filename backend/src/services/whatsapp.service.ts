import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

export interface QueueAlertParams {
  businessId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  currentStock: number;
  threshold: number;
  isCritical?: boolean;
}

export class WhatsAppService {
  /**
   * Format Bilingual Hindi/English Low Stock Alert Message
   */
  public static formatLowStockMessage(params: {
    businessName: string;
    productName: string;
    sku: string;
    unit: string;
    currentStock: number;
    threshold: number;
    isCritical?: boolean;
  }): string {
    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const header = params.isCritical
      ? '🚨 *CRITICAL OUT OF STOCK / गंभीर स्टॉक समाप्ति*'
      : '⚠️ *LOW STOCK ALERT / कम स्टॉक की सूचना*';

    return (
      `${header}\n\n` +
      `🏢 *Business / प्रतिष्ठान:* ${params.businessName}\n` +
      `📦 *Product / उत्पाद:* ${params.productName}\n` +
      `🔖 *SKU / कोड:* ${params.sku}\n` +
      `📊 *Current Stock / वर्तमान स्टॉक:* ${params.currentStock} ${params.unit}\n` +
      `🎯 *Minimum Stock / न्यूनतम सीमा:* ${params.threshold} ${params.unit}\n\n` +
      `⚡ *Action Required / आवश्यक कार्यवाही:*\n` +
      `Please reorder or refill this product immediately.\n` +
      `कृपया इस सामान का स्टॉक तुरंत दोबारा भरें।\n\n` +
      `🕒 *Time:* ${timestamp}`
    );
  }

  /**
   * Queue a low stock alert job in the database
   */
  public static async queueLowStockAlert(params: QueueAlertParams): Promise<void> {
    const { businessId, product, currentStock, threshold, isCritical } = params;

    // Fetch business and settings
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    if (!business) return;

    // Check if WhatsApp is configured and enabled
    const recipientPhone =
      business.settings?.whatsAppAlertRecipientPhone || business.phone;
    const isWhatsAppEnabled = business.settings?.whatsAppEnabled ?? false;
    const phoneNumberId = business.settings?.whatsAppPhoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = business.settings?.whatsAppAccessToken || env.WHATSAPP_ACCESS_TOKEN;

    const messageText = this.formatLowStockMessage({
      businessName: business.name,
      productName: product.name,
      sku: product.sku,
      unit: product.unit,
      currentStock,
      threshold,
      isCritical,
    });

    // Also create in-app notification
    await prisma.notification.create({
      data: {
        businessId,
        type: isCritical ? 'CRITICAL_STOCK' : 'LOW_STOCK',
        title: isCritical ? `Critical: ${product.name} Out of Stock` : `Low Stock: ${product.name}`,
        message: `Current stock: ${currentStock} ${product.unit} (Threshold: ${threshold})`,
        metadataJson: JSON.stringify({
          productId: product.id,
          sku: product.sku,
          currentStock,
          threshold,
        }),
      },
    });

    // If WhatsApp not configured or disabled, create job marked as FAILED with descriptive warning
    if (!isWhatsAppEnabled || !phoneNumberId || !accessToken || !recipientPhone) {
      await prisma.notificationJob.create({
        data: {
          businessId,
          channel: 'WHATSAPP',
          recipientPhone: recipientPhone || 'NOT_CONFIGURED',
          messageText,
          payloadJson: JSON.stringify({ productId: product.id, currentStock, threshold }),
          status: 'FAILED',
          errorMessage: 'WhatsApp Cloud API credentials not configured or notifications disabled in Business Settings.',
        },
      });
      return;
    }

    // Create queued notification job
    const job = await prisma.notificationJob.create({
      data: {
        businessId,
        channel: 'WHATSAPP',
        recipientPhone,
        messageText,
        payloadJson: JSON.stringify({ productId: product.id, currentStock, threshold }),
        status: 'QUEUED',
      },
    });

    // Attempt immediate dispatch
    this.processJob(job.id).catch((err) => {
      console.error('[WHATSAPP_DISPATCH_ERR]', err);
    });
  }

  /**
   * Process a specific notification job
   */
  public static async processJob(jobId: string): Promise<boolean> {
    const job = await prisma.notificationJob.findUnique({
      where: { id: jobId },
      include: {
        business: {
          include: { settings: true },
        },
      },
    });

    if (!job || job.status === 'SENT' || job.status === 'DELIVERED') {
      return false;
    }

    const settings = job.business.settings;
    const phoneNumberId = settings?.whatsAppPhoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = settings?.whatsAppAccessToken || env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      await prisma.notificationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: 'Missing WhatsApp Phone Number ID or Access Token',
        },
      });
      return false;
    }

    try {
      // Standardize recipient phone: strip '+' or non-digit chars, ensure 91 prefix for India if missing
      let cleanPhone = job.recipientPhone.replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }

      // Send via WhatsApp Cloud API
      const response = await axios.post(
        `${env.WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: job.messageText,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const gatewayMessageId = response.data?.messages?.[0]?.id || null;

      await prisma.notificationJob.update({
        where: { id: jobId },
        data: {
          status: 'SENT',
          gatewayMessageId,
          errorMessage: null,
        },
      });

      return true;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown }; message?: string };
      const errorMsg =
        typeof axiosErr.response?.data === 'object'
          ? JSON.stringify(axiosErr.response.data)
          : axiosErr.message || 'WhatsApp Cloud API Error';

      const nextRetryCount = job.retryCount + 1;
      const isExhausted = nextRetryCount >= job.maxRetries;

      // Exponential backoff: 2min, 4min, 8min...
      const delayMs = Math.pow(2, nextRetryCount) * 60 * 1000;
      const nextRetryAt = isExhausted ? null : new Date(Date.now() + delayMs);

      await prisma.notificationJob.update({
        where: { id: jobId },
        data: {
          status: isExhausted ? 'FAILED' : 'QUEUED',
          retryCount: nextRetryCount,
          nextRetryAt,
          errorMessage: errorMsg,
        },
      });

      return false;
    }
  }

  /**
   * Run background retry worker for pending queued jobs
   */
  public static async processPendingJobs(): Promise<void> {
    const pendingJobs = await prisma.notificationJob.findMany({
      where: {
        status: 'QUEUED',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      take: 10,
    });

    for (const job of pendingJobs) {
      await this.processJob(job.id);
    }
  }

  /**
   * Owner-only Test Notification Dispatcher
   */
  public static async sendTestNotification(
    businessId: string,
    targetPhone: string
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { settings: true },
    });

    if (!business) {
      return { success: false, message: 'Business not found' };
    }

    const settings = business.settings;
    const phoneNumberId = settings?.whatsAppPhoneNumberId || env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = settings?.whatsAppAccessToken || env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      return {
        success: false,
        message:
          'WhatsApp Phone Number ID or Access Token is missing. Please configure credentials in Business Settings.',
      };
    }

    let cleanPhone = targetPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const testMessage =
      `🧪 *RetailPro WhatsApp Integration Test / परीक्षण संदेश*\n\n` +
      `Business: ${business.name}\n` +
      `System: RetailPro GST Billing & Inventory\n` +
      `Status: WhatsApp Cloud API connection established successfully! ✅\n\n` +
      `Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

    try {
      const response = await axios.post(
        `${env.WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: testMessage,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      // Record job in database
      await prisma.notificationJob.create({
        data: {
          businessId,
          channel: 'WHATSAPP',
          recipientPhone: cleanPhone,
          messageText: testMessage,
          payloadJson: JSON.stringify({ isTest: true }),
          status: 'SENT',
          gatewayMessageId: response.data?.messages?.[0]?.id || null,
        },
      });

      return {
        success: true,
        message: 'Test notification sent successfully to WhatsApp!',
        details: response.data,
      };
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown }; message?: string };
      const errorMessage =
        axiosErr.response?.data && typeof axiosErr.response.data === 'object'
          ? JSON.stringify(axiosErr.response.data)
          : axiosErr.message || 'WhatsApp Cloud API Request Failed';

      return {
        success: false,
        message: `WhatsApp API error: ${errorMessage}`,
        details: axiosErr.response?.data,
      };
    }
  }

  /**
   * Verify WhatsApp Webhook Signature
   */
  public static verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader?: string,
    appSecret?: string
  ): boolean {
    const secret = appSecret || env.WHATSAPP_WEBHOOK_APP_SECRET;
    if (!signatureHeader || !secret) return true; // If secret not set, pass verification in dev

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  }
}
