import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, relative } from 'node:path'
const roots = ['app','server','shared','scripts','docs','public','.output/public','.output/server','.vercel/output/static','.vercel/output/functions']
const names = ['OPENAI_API_KEY','MURGIK_ACCESS_PASSWORD','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_TOKEN','MURGIK_SESSION_SECRET','TURNSTILE_SECRET_KEY']
const secrets = names.map(name=>process.env[name]).filter(value=>value && value.length >= 8)
const findings = []
let checked = 0
async function scan(path) {
  let entries
  try { entries = await readdir(path,{withFileTypes:true}) } catch { return }
  for (const entry of entries) {
    const filename = join(path,entry.name)
    if (entry.isDirectory()) await scan(filename)
    else if (/\.(?:[cm]?js|ts|vue|json|html|css|md|txt)$/i.test(filename)) {
      const text = await readFile(filename,'utf8'); checked++
      if (/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/.test(text) || /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/.test(text) || /-{5}BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-{5}/.test(text) || secrets.some(secret=>text.includes(secret))) findings.push(relative('.',filename))
      if (/^(?:\.output[\\/]public|\.vercel[\\/]output[\\/]static)/.test(filename) && names.some(name=>text.includes(name))) findings.push(`${filename} (server secret name in public bundle)`)
    }
  }
}
for (const root of roots) await scan(root)
for (const file of ['package.json','package-lock.json','nuxt.config.ts','README.md','DEPLOY.md']) {
  const text = await readFile(file,'utf8'); checked++
  if (secrets.some(secret=>text.includes(secret)) || /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/.test(text)) findings.push(file)
}
const ignore = await readFile('.gitignore','utf8')
if (!ignore.split(/\r?\n/).includes('.env') || !ignore.split(/\r?\n/).includes('.env.*')) findings.push('.gitignore (private env patterns missing)')
const vercelIgnore = await readFile('.vercelignore','utf8')
if (!vercelIgnore.split(/\r?\n/).includes('.env') || !vercelIgnore.split(/\r?\n/).includes('.env.*') || !vercelIgnore.split(/\r?\n/).includes('output/')) findings.push('.vercelignore (private files or test fixtures not excluded)')
let gitHistory = 'unavailable: this directory has no Git metadata'
try {
  const tracked = execFileSync('git',['ls-files','-z'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0')
  if (tracked.some(path=>/(^|\/)\.env(?:\.|$)/.test(path) && path!=='.env.demo')) findings.push('private environment file tracked by Git')
  gitHistory = 'tracked-file inventory checked; historical secret scan is still a predeploy operator check'
} catch {}
console.log(JSON.stringify({checkedTextFiles:checked,findings,gitHistory,credentialValuesPrinted:false},null,2))
if (findings.length) process.exitCode = 1
