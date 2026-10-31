// Executed atomically by Redis, never emulated by application process memory.
// The ledger has no expiry. It must be initialized by the operator (see DEPLOY.md).
export const LEDGER = 'murgik:poc:v1:ledger'
export const ACTIVE = 'murgik:poc:v1:active'
const guard = `
if redis.call('HGET', KEYS[1], 'enabled') ~= '1' or redis.call('TTL', KEYS[1]) ~= -1 then return {'unavailable'} end
local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts'))
if not attempts or attempts < 0 or attempts % 1 ~= 0 then return {'unavailable'} end
`
export const STATUS = guard + `
local successes = tonumber(redis.call('HGET', KEYS[1], 's:' .. ARGV[1] .. ':success') or '0')
local pending = tonumber(redis.call('HGET', KEYS[1], 's:' .. ARGV[1] .. ':reserved') or '0')
return {'ok', tostring(math.max(0, 50-attempts)), tostring(math.max(0, 10-successes-pending))}
`
export const LOOKUP = guard + `
local value = redis.call('HGET', KEYS[1], 'r:' .. ARGV[1] .. ':' .. ARGV[2])
if not value then return {'new'} end
local record = cjson.decode(value)
if record.fingerprint ~= ARGV[3] then return {'conflict'} end
if record.state == 'done' then return {'cached', record.response} end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if record.state == 'pending' and record.started + 45000 <= now then return {'expired'} end
return {record.state}
`
export const RESERVE = guard + `
local sid, rid, fingerprint, match = ARGV[1], ARGV[2], ARGV[3], ARGV[4]
local field = 'r:' .. sid .. ':' .. rid
local previous = redis.call('HGET', KEYS[1], field)
if previous then
  local record = cjson.decode(previous)
  if record.fingerprint ~= fingerprint then return {'conflict'} end
  if record.state == 'done' then return {'cached', record.response} end
  return {record.state}
end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local busy = redis.call('HGET', KEYS[1], 's:' .. sid .. ':busy')
if busy then
  local pending = cjson.decode(redis.call('HGET', KEYS[1], 'r:' .. sid .. ':' .. busy))
  if pending.started + 45000 > now then return {'busy'} end
end
local successes = tonumber(redis.call('HGET', KEYS[1], 's:' .. sid .. ':success') or '0')
local pendingSlots = tonumber(redis.call('HGET', KEYS[1], 's:' .. sid .. ':reserved') or '0')
local matchSuccess = tonumber(redis.call('HGET', KEYS[1], 'm:' .. sid .. ':' .. match) or '0')
if successes + pendingSlots >= 10 then return {'session_limit'} end
if matchSuccess >= 3 then return {'match_limit'} end
if attempts >= 50 then return {'global_limit'} end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= 2 then return {'busy'} end
local last = tonumber(redis.call('HGET', KEYS[1], 's:' .. sid .. ':last') or '0')
if now-last < 6000 then return {'rate_limit'} end
redis.call('HINCRBY', KEYS[1], 'attempts', 1)
redis.call('HINCRBY', KEYS[1], 's:' .. sid .. ':reserved', 1)
redis.call('HSET', KEYS[1], field, cjson.encode({state='pending', fingerprint=fingerprint, started=now, match=match}))
redis.call('HSET', KEYS[1], 's:' .. sid .. ':busy', rid, 's:' .. sid .. ':last', now)
redis.call('ZADD', KEYS[2], now+45000, sid .. ':' .. rid)
return {'reserved'}
`
export const FINISH = guard + `
local sid, rid, fingerprint = ARGV[1], ARGV[2], ARGV[3]
local field = 'r:' .. sid .. ':' .. rid
local value = redis.call('HGET', KEYS[1], field)
if not value then return {'conflict'} end
local record = cjson.decode(value)
if record.fingerprint ~= fingerprint then return {'conflict'} end
if record.state == 'done' then return {'cached', record.response} end
if record.state ~= 'pending' or redis.call('HGET', KEYS[1], 's:' .. sid .. ':busy') ~= rid then return {'conflict'} end
if ARGV[4] == 'done' then
  local successes = tonumber(redis.call('HGET', KEYS[1], 's:' .. sid .. ':success') or '0')
  if successes >= 10 then return {'session_limit'} end
  redis.call('HINCRBY', KEYS[1], 's:' .. sid .. ':success', 1)
  redis.call('HINCRBY', KEYS[1], 'm:' .. sid .. ':' .. record.match, 1)
  record.response = ARGV[5]
end
record.state = ARGV[4]
redis.call('HINCRBY', KEYS[1], 's:' .. sid .. ':reserved', -1)
redis.call('HSET', KEYS[1], field, cjson.encode(record))
redis.call('HDEL', KEYS[1], 's:' .. sid .. ':busy')
redis.call('ZREM', KEYS[2], sid .. ':' .. rid)
return {'ok'}
`
// Rate-limit every POST, including invalid challenge attempts. IPs are HMAC-hashed.
export const RATE = `
local a = redis.call('INCR', KEYS[1]); if a == 1 then redis.call('EXPIRE', KEYS[1], 60) end
local b = redis.call('INCR', KEYS[2]); if b == 1 then redis.call('EXPIRE', KEYS[2], 60) end
if a > 12 or b > 24 then return {'rate_limit'} end
return {'ok'}
`
