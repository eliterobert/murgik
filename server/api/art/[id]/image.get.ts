export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'AI-bildgenerering är avstängd.' })
})
