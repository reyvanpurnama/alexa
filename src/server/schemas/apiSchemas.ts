import { z } from 'zod';

export const sendMessageSchema = z.object({
  to: z.string().min(5, 'Target phone number or JID is required'),
  message: z.string().min(1, 'Message text cannot be empty'),
  queued: z.boolean().optional().default(true),
});

export const sendMediaSchema = z.object({
  to: z.string().min(5, 'Target phone number or JID is required'),
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.string().url('A valid media URL is required'),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mimetype: z.string().optional(),
  queued: z.boolean().optional().default(true),
});

export const pairingSchema = z.object({
  phoneNumber: z.string().min(8, 'Phone number must be at least 8 digits'),
  sessionName: z.string().optional(),
});

export const checkNumberSchema = z.object({
  phoneNumber: z.string().min(5, 'Phone number is required'),
});

export const switchSessionSchema = z.object({
  sessionName: z
    .string()
    .min(1, 'Session name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Session name must contain only letters, numbers, underscores, and hyphens'),
});

export const startBroadcastSchema = z.object({
  targets: z
    .array(
      z.union([
        z.string().min(5),
        z.object({
          phone: z.string().min(5),
          name: z.string().optional(),
        }),
      ])
    )
    .min(1, 'Target recipients cannot be empty'),
  message: z.string().min(1, 'Message template cannot be empty'),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  fileName: z.string().optional(),
  minDelayMs: z.number().int().min(1000).max(60000).optional(),
  maxDelayMs: z.number().int().min(1000).max(120000).optional(),
  batchSize: z.number().int().min(1).max(100).optional(),
  batchDelayMs: z.number().int().min(5000).max(300000).optional(),
});

export const previewSpintaxSchema = z.object({
  template: z.string().min(1, 'Template cannot be empty'),
  count: z.number().int().min(1).max(10).optional().default(3),
  variables: z.record(z.string(), z.string()).optional(),
});
