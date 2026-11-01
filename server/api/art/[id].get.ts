export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { status: 'disabled', message: 'Bilden levereras i Forge-svaret. Den här läsningen startar ingen bildgenerering.' }
})
