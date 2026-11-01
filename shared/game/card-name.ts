import { z } from 'zod'

export const CARD_NAME_MAX = 48
export const CARD_NAME_HELP = 'Använd 1–48 tecken: bokstäver, siffror, blanksteg och enkla skiljetecken.'
// Shared by preview, confirmation endpoint and deterministic balancing. No markup,
// control characters, invisible direction overrides or executable content.
export const cardNameSchema = z.string().trim().min(1).max(CARD_NAME_MAX)
  .regex(/^[\p{L}\p{M}\p{N} .,'’!?():–—\-]+$/u)
  .refine(name => /[\p{L}\p{N}]/u.test(name))
