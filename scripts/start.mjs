// Use local/injected server variables without overriding the player's Forge mode.
process.env.NITRO_HOST = '127.0.0.1'
const portIndex = process.argv.indexOf('--port')
if (portIndex >= 0) {
  const port = Number(process.argv[portIndex + 1])
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose a port between 1024 and 65535.')
  process.env.NITRO_PORT = String(port)
}
await import('../.output/server/index.mjs')
