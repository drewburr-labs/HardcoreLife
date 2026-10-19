// Test harness: drives a Paper server's console and mineflayer bots
const { spawn } = require('child_process')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const mineflayer = require('mineflayer')

// mineflayer supports up to Minecraft 26.1, so tests run on the oldest Paper version the plugin supports
const PAPER_VERSION = '26.1.2'
const PAPER_BUILD = 74
const PAPER_SHA256 = '1d70b1dab9cf4a6de615209a536f3a45a2186240253c428213ce2188ab95e5f7'
const JAR = `paper-${PAPER_VERSION}-${PAPER_BUILD}.jar`
const VERSION = '26.1'
const PORT = Number(process.env.PORT || 25598)
const SERVER_DIR = path.join(__dirname, 'server')
const REPO_DIR = path.join(__dirname, '..', '..')

const net = require('net')
const running = new Set()
// Never leave a test server behind
process.on('exit', () => { for (const p of running) p.kill('SIGKILL') })
process.on('SIGTERM', () => process.exit(1))
process.on('SIGINT', () => process.exit(1))

function portInUse (port) {
  return new Promise(resolve => {
    const srv = net.createServer().once('error', () => resolve(true)).once('listening', () => srv.close(() => resolve(false)))
    srv.listen(port)
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '')

let results = []
function check (name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}
function summary () {
  const failed = results.filter(r => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('Failed: ' + failed.map(f => f.name).join('; '))
    process.exitCode = 1
  }
  results = []
}

class Server {
  constructor (logName) {
    this.lines = []
    this.waiters = []
    this.logFile = fs.createWriteStream(path.join(SERVER_DIR, logName), { flags: 'a' })
  }

  async start () {
    if (await portInUse(PORT)) throw new Error(`port ${PORT} is already in use; is an old test server still running?`)
    this.proc = spawn('java', ['-Xmx2G', '-jar', JAR, '--nogui'], { cwd: SERVER_DIR })
    this.exited = new Promise(resolve => this.proc.on('exit', resolve))
    running.add(this.proc)
    this.proc.on('exit', () => running.delete(this.proc))
    let buf = ''
    const onData = d => {
      this.logFile.write(d)
      buf += d.toString()
      const parts = buf.split('\n')
      buf = parts.pop()
      for (const raw of parts) {
        const line = strip(raw)
        this.lines.push(line)
        for (const w of [...this.waiters]) {
          if (w.re.test(line)) {
            this.waiters.splice(this.waiters.indexOf(w), 1)
            w.resolve(line)
          }
        }
      }
    }
    this.proc.stdout.on('data', onData)
    this.proc.stderr.on('data', onData)
    const done = await Promise.race([this.waitFor(/Done \(/, 180000), this.exited.then(() => null)])
    if (!done) throw new Error('server exited or timed out before finishing startup')
  }

  // Resolves with the first line matching re after this call (or already seen since `from`)
  waitFor (re, timeout = 15000, from = null) {
    if (from !== null) {
      const hit = this.lines.slice(from).find(l => re.test(l))
      if (hit) return Promise.resolve(hit)
    }
    return new Promise(resolve => {
      const w = { re, resolve }
      this.waiters.push(w)
      setTimeout(() => {
        const i = this.waiters.indexOf(w)
        if (i >= 0) { this.waiters.splice(i, 1); resolve(null) }
      }, timeout)
    })
  }

  mark () { return this.lines.length }
  since (mark) { return this.lines.slice(mark) }

  cmd (c) { this.proc.stdin.write(c + '\n') }

  async stop () {
    if (this.proc.exitCode !== null) return
    this.cmd('stop')
    await Promise.race([this.exited, sleep(60000)])
  }
}

async function connectBot (name) {
  const bot = mineflayer.createBot({ host: 'localhost', port: PORT, username: name, version: VERSION, auth: 'offline' })
  bot.chatLog = []
  bot.commandNames = new Set()
  bot.on('messagestr', m => bot.chatLog.push(m))
  bot._client.on('declare_commands', packet => {
    bot.commandNames = new Set(packet.nodes.map(n => n.extraNodeData && n.extraNodeData.name).filter(Boolean))
  })
  // Movement speed the server last sent (0 when frozen)
  bot._client.on('abilities', packet => { bot.walkSpeed = packet.walkingSpeed })
  bot.on('kicked', r => { bot.kickReason = typeof r === 'string' ? r : JSON.stringify(r) })
  bot.on('error', e => { bot.lastError = e.message })
  await new Promise((resolve, reject) => {
    bot.once('spawn', resolve)
    bot.once('end', () => reject(new Error(`${name} disconnected before spawning: ${bot.kickReason || bot.lastError}`)))
  })
  await sleep(1500)
  return bot
}

// Waits until a bot's chat log has a line matching re (searching from index `from`)
async function waitChat (bot, re, timeout = 8000, from = 0) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (bot.chatLog.slice(from).some(m => re.test(m))) return true
    await sleep(200)
  }
  return false
}

async function waitGameMode (bot, mode, timeout = 8000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (bot.game && bot.game.gameMode === mode) return true
    await sleep(200)
  }
  return false
}

function quit (bots) {
  for (const b of bots) { try { b.quit() } catch (e) {} }
}

function writeConfig (overrides) {
  const file = path.join(SERVER_DIR, 'plugins', 'Hardcorelife', 'config.yml')
  let text = fs.readFileSync(file, 'utf8')
  for (const [k, v] of Object.entries(overrides)) {
    text = text.replace(new RegExp(`^${k}:\\s*\\S+`, 'm'), `${k}: ${v}`)
  }
  fs.writeFileSync(file, text)
}

// Prepares test/bots/server: the Paper jar, the EULA, server.properties and the freshly built plugin
async function setupServer () {
  fs.mkdirSync(path.join(SERVER_DIR, 'plugins'), { recursive: true })

  if (process.env.MINECRAFT_EULA !== 'true') {
    throw new Error('Running a Minecraft server requires accepting the Minecraft EULA (https://aka.ms/MinecraftEULA). ' +
      'Set MINECRAFT_EULA=true to accept it for this test server.')
  }
  fs.writeFileSync(path.join(SERVER_DIR, 'eula.txt'), 'eula=true\n')

  const jarPath = path.join(SERVER_DIR, JAR)
  if (!fs.existsSync(jarPath)) {
    const url = `https://fill-data.papermc.io/v1/objects/${PAPER_SHA256}/${JAR}`
    console.log(`Downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to download Paper: HTTP ${res.status}`)
    const data = Buffer.from(await res.arrayBuffer())
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    if (hash !== PAPER_SHA256) throw new Error(`Paper jar checksum mismatch: ${hash}`)
    fs.writeFileSync(jarPath, data)
  }

  const props = path.join(SERVER_DIR, 'server.properties')
  if (!fs.existsSync(props)) {
    fs.writeFileSync(props, [
      `server-port=${PORT}`, 'online-mode=false', 'white-list=false', 'spawn-protection=0',
      'view-distance=4', 'simulation-distance=4', 'gamemode=survival', 'hardcore=false', ''
    ].join('\n'))
  }

  // Install the plugin built by ./mvnw package
  const targetDir = path.join(REPO_DIR, 'target')
  const built = fs.existsSync(targetDir) &&
    fs.readdirSync(targetDir).find(f => /^hardcorelife-.*\.jar$/.test(f) && !f.startsWith('original-'))
  if (!built) throw new Error('No plugin jar in target/. Run ./mvnw package first.')
  for (const f of fs.readdirSync(path.join(SERVER_DIR, 'plugins'))) {
    if (/^hardcorelife-.*\.jar$/.test(f)) fs.rmSync(path.join(SERVER_DIR, 'plugins', f))
  }
  fs.copyFileSync(path.join(targetDir, built), path.join(SERVER_DIR, 'plugins', built))
}

// Copies the plugin's default config.yml into the test server, with overrides
function installConfig (overrides) {
  fs.mkdirSync(path.join(SERVER_DIR, 'plugins', 'Hardcorelife'), { recursive: true })
  fs.copyFileSync(path.join(REPO_DIR, 'src', 'main', 'resources', 'config.yml'),
    path.join(SERVER_DIR, 'plugins', 'Hardcorelife', 'config.yml'))
  writeConfig(overrides)
}

function resetServerFiles () {
  if (running.size) throw new Error('refusing to delete world files while a server is running')
  for (const p of ['world', 'plugins/Hardcorelife', 'logs']) {
    fs.rmSync(path.join(SERVER_DIR, p), { recursive: true, force: true })
  }
  fs.writeFileSync(path.join(SERVER_DIR, 'ops.json'), '[]')
  // Undo any default gamemode the plugin persisted
  const props = path.join(SERVER_DIR, 'server.properties')
  fs.writeFileSync(props, fs.readFileSync(props, 'utf8').replace(/^gamemode=.*$/m, 'gamemode=survival'))
}

function setProperty (key, value) {
  const props = path.join(SERVER_DIR, 'server.properties')
  let text = fs.readFileSync(props, 'utf8')
  const re = new RegExp(`^${key}=.*$`, 'm')
  text = re.test(text) ? text.replace(re, `${key}=${value}`) : text + `\n${key}=${value}\n`
  fs.writeFileSync(props, text)
}

module.exports = { setupServer, installConfig, setProperty, Server, connectBot, waitChat, waitGameMode, check, summary, sleep, quit, writeConfig, resetServerFiles, SERVER_DIR }
