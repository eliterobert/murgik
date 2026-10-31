// Runs the production Lua source, not a second implementation of quota rules.
// Redis command primitives use deterministic in-memory data only in this test adapter.
import { createRequire } from 'node:module'
import type { RedisCommand } from '../server/utils/quota-store'
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = createRequire(import.meta.url)('fengari')
export class LuaRedis {
  hashes = new Map<string, Map<string, string>>()
  strings = new Map<string, number>()
  sets = new Map<string, Map<string, number>>()
  expires = new Map<string, number>()
  now = 1_800_000_000_000
  available = true
  constructor() { this.hashes.set('murgik:poc:v1:ledger', new Map([['enabled', '1'], ['attempts', '0']])) }
  private push(L: unknown, value: any) {
    if (value === undefined || value === null) lua.lua_pushboolean(L, false)
    else if (typeof value === 'string') lua.lua_pushstring(L, to_luastring(value))
    else if (typeof value === 'number') lua.lua_pushnumber(L, value)
    else if (typeof value === 'boolean') lua.lua_pushboolean(L, value)
    else {
      lua.lua_newtable(L)
      for (const [key, item] of Object.entries(value)) { this.push(L, item); if (Array.isArray(value)) lua.lua_seti(L, -2, Number(key) + 1); else lua.lua_setfield(L, -2, to_luastring(key)) }
    }
  }
  private read(L: unknown, index: number): any {
    const type = lua.lua_type(L, index)
    if (type === lua.LUA_TNUMBER) return lua.lua_tonumber(L, index)
    if (type === lua.LUA_TSTRING) return to_jsstring(lua.lua_tolstring(L, index))
    if (type === lua.LUA_TBOOLEAN) return lua.lua_toboolean(L, index)
    if (type !== lua.LUA_TTABLE) return null
    const absolute = lua.lua_absindex(L, index), object: Record<string, any> = {}; let array = true
    lua.lua_pushnil(L)
    while (lua.lua_next(L, absolute)) {
      const key = this.read(L, -2); if (typeof key !== 'number') array = false
      object[String(key)] = this.read(L, -1); lua.lua_pop(L, 1)
    }
    return array && Object.keys(object).length ? Object.keys(object).sort((a, b) => Number(a)-Number(b)).map(k => object[k]) : object
  }
  private call(command: string, ...args: any[]): unknown {
    const key = String(args[0]), hash = () => { if (!this.hashes.has(key)) this.hashes.set(key, new Map()); return this.hashes.get(key)! }
    if (this.expires.has(key) && this.expires.get(key)! <= this.now) { this.strings.delete(key); this.expires.delete(key) }
    switch (command) {
      case 'HGET': return hash().get(String(args[1])) ?? false
      case 'HSET': for (let i = 1; i < args.length; i += 2) hash().set(String(args[i]), String(args[i+1])); return 1
      case 'HDEL': return hash().delete(String(args[1])) ? 1 : 0
      case 'HINCRBY': { const n = Number(hash().get(String(args[1])) || 0) + Number(args[2]); hash().set(String(args[1]), String(n)); return n }
      case 'TIME': return [String(Math.floor(this.now/1000)), String((this.now%1000)*1000)]
      case 'TTL': return this.expires.has(key) ? Math.ceil((this.expires.get(key)!-this.now)/1000) : this.hashes.has(key) || this.strings.has(key) ? -1 : -2
      case 'INCR': { const n = (this.strings.get(key) || 0) + 1; this.strings.set(key, n); return n }
      case 'EXPIRE': this.expires.set(key, this.now + Number(args[1])*1000); return 1
      case 'ZADD': if (!this.sets.has(key)) this.sets.set(key, new Map()); this.sets.get(key)!.set(String(args[2]), Number(args[1])); return 1
      case 'ZCARD': return this.sets.get(key)?.size || 0
      case 'ZREM': return this.sets.get(key)?.delete(String(args[1])) ? 1 : 0
      case 'ZREMRANGEBYSCORE': for (const [member, score] of this.sets.get(key) || []) if (score <= Number(args[2])) this.sets.get(key)!.delete(member); return 1
      default: throw new Error(`Unsupported test Redis primitive ${command}`)
    }
  }
  command: RedisCommand = async command => {
    if (!this.available) throw new Error('storage offline')
    const [, script, count, ...values] = command
    const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L)
    this.push(L, values.slice(0, Number(count))); lua.lua_setglobal(L, to_luastring('KEYS'))
    this.push(L, values.slice(Number(count))); lua.lua_setglobal(L, to_luastring('ARGV'))
    lua.lua_newtable(L)
    lua.lua_pushcfunction(L, (state: unknown) => {
      const args = Array.from({ length: lua.lua_gettop(state) }, (_, i) => this.read(state, i+1))
      this.push(state, this.call(args[0], ...args.slice(1))); return 1
    }); lua.lua_setfield(L, -2, to_luastring('call')); lua.lua_setglobal(L, to_luastring('redis'))
    lua.lua_newtable(L)
    lua.lua_pushcfunction(L, (state: unknown) => { this.push(state, JSON.stringify(this.read(state, 1))); return 1 }); lua.lua_setfield(L, -2, to_luastring('encode'))
    lua.lua_pushcfunction(L, (state: unknown) => { this.push(state, JSON.parse(this.read(state, 1))); return 1 }); lua.lua_setfield(L, -2, to_luastring('decode')); lua.lua_setglobal(L, to_luastring('cjson'))
    try {
      if (lauxlib.luaL_dostring(L, to_luastring(String(script))) !== lua.LUA_OK) throw new Error(String(this.read(L, -1)))
      return this.read(L, -1)
    } finally { lua.lua_close(L) }
  }
}
