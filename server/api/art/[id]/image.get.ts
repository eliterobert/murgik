export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Bilden levereras i Forge-svaret. Ingen bildgenerering sker via GET.' })
})
