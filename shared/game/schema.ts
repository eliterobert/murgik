import { z } from 'zod'

export const effectSchema = z.object({
  kind: z.enum(['damage', 'damageAll', 'healPlayer', 'healCreature', 'draw', 'summon', 'buff', 'shield', 'destroyDamaged', 'stun', 'gainMana']),
  target: z.enum(['enemy', 'enemyCreature', 'allyCreature', 'opponent', 'player', 'allEnemies', 'allAllies', 'self', 'none']),
  amount: z.number().int().min(0).max(100),
  secondary: z.number().int().min(0).max(100),
  filter: z.enum(['any', 'flying'])
}).strict()
export const cardSchema = z.object({
  name: z.string().min(1).max(48),
  type: z.enum(['creature', 'spell']),
  flavor: z.string().max(180),
  cost: z.number().int().min(0).max(100),
  attack: z.number().int().min(0).max(100),
  health: z.number().int().min(0).max(100),
  keywords: z.array(z.enum(['flying', 'guard', 'haste', 'lifesteal', 'enrage'])).max(4),
  effects: z.array(effectSchema).max(3),
  artPrompt: z.string().max(240),
  theme: z.enum(['ember', 'forest', 'void', 'storm', 'frost', 'gold'])
}).strict()
export const forgeRequestSchema = z.object({
  matchId: z.string().uuid(),
  requestId: z.string().uuid(),
  challengeToken: z.string().max(2048).optional(),
  demo: z.boolean().optional(),
  prompt: z.string().trim().min(3).max(500),
  context: z.object({
    turn: z.number().int().min(1).max(1000),
    life: z.number().int().min(1).max(20),
    opponentLife: z.number().int().min(1).max(20),
    maxMana: z.number().int().min(1).max(10),
    allies: z.number().int().min(0).max(6),
    enemies: z.number().int().min(0).max(6)
  }).strict()
}).strict()
