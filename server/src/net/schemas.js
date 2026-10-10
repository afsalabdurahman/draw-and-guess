import { z } from 'zod';

export const roomJoinSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().min(1).max(20).transform(s => s.replace(/[\x00-\x1F\x7F]/g, '').trim()),
  reconnectToken: z.string().optional(),
});

export const settingsUpdateSchema = z.object({
  roomId: z.string().min(1),
  settings: z.object({
    rounds: z.number().int().min(1).max(10).optional(),
    drawTimeSec: z.number().int().min(30).max(180).optional(),
    maxPlayers: z.number().int().min(2).max(12).optional(),
    wordList: z.union([
      z.literal('default'),
      z.array(z.string().min(2).max(30)).max(500)
    ]).optional()
  })
});

export const gameStartSchema = z.object({
  roomId: z.string().min(1)
});

export const strokeStartSchema = z.object({
  roomId: z.string().min(1),
  id: z.string().min(1),
  tool: z.enum(['pen', 'eraser']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.number().int().min(1).max(50),
  point: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
});

export const strokePointsSchema = z.object({
  roomId: z.string().min(1),
  id: z.string().min(1),
  points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(50)
});

export const strokeEndSchema = z.object({
  roomId: z.string().min(1),
  id: z.string().min(1)
});

export const fillSchema = z.object({
  roomId: z.string().min(1),
  id: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1)
});

export const simpleOpSchema = z.object({
  roomId: z.string().min(1),
  id: z.string().min(1)
});

export const wordPickSchema = z.object({
  roomId: z.string().min(1),
  word: z.string().min(1)
});

export const chatSendSchema = z.object({
  roomId: z.string().min(1),
  text: z.string().max(100).transform(s => s.replace(/[\x00-\x1F\x7F]/g, ''))
});
