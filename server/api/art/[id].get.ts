export default defineEventHandler(event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { status: 'disabled', message: 'Murgik använder sina befintliga originalillustrationer.' }
})
