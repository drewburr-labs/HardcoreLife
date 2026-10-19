// Per-player lives: individual deaths, permadeath freeze, kill rewards, revive via /setlives
const h = require('./harness')
const { check, sleep } = h

async function main () {
  await h.setupServer()
  h.resetServerFiles()
  h.setProperty('hardcore', process.argv[2] === 'hardcore' ? 'true' : 'false')
  h.installConfig({ global_lives: 'false', starting_lives: '2', kill_gain_lives: 'true', death_movement: 'false' })

  const server = new h.Server('perplayer.log')
  await server.start()
  const m = server.mark()

  const alice = await h.connectBot('Alice')
  const bob = await h.connectBot('Bob')
  const carol = await h.connectBot('Carol')
  check('join message shows own lives', await h.waitChat(alice, /Welcome back aboard Alice! You have 2 live\(s\) remaining/))

  let cb = bob.chatLog.length
  server.cmd('kill Alice')
  check('Alice told she has 1 life left', await h.waitChat(alice, /You have 1 live\(s\) remaining/))
  await sleep(1500)
  check('Bob not told about Alice\'s private life count', !bob.chatLog.slice(cb).some(l => /You have 1 live/.test(l)))
  check('Alice respawns in survival with 1 life', await h.waitGameMode(alice, 'survival'), alice.game.gameMode)

  bob.chat('/lives Alice')
  check('/lives <player> works for non-op', await h.waitChat(bob, /Alice has 1 live\(s\) left/, 5000, cb))

  // Kill reward: Carol kills Bob
  let cc = carol.chatLog.length
  server.cmd('damage Bob 1000 minecraft:player_attack by Carol')
  check('killer is told they gained a life', await h.waitChat(carol, /You have gained a life/, 8000, cc))
  carol.chat('/lives')
  check('killer now has 3 lives', await h.waitChat(carol, /You have 3 live\(s\) left/, 5000, cc))
  check('victim has 1 life', await h.waitChat(bob, /You have 1 live\(s\) remaining/, 5000, cb))
  await sleep(2000)

  // Permadeath
  cb = bob.chatLog.length
  server.cmd('kill Alice')
  check('permadeath announced to everyone', await h.waitChat(bob, /Alice has run out of lives/, 8000, cb))
  await sleep(3000)
  check('Alice is spectator at 0 lives', await h.waitGameMode(alice, 'spectator'), alice.game.gameMode)
  check('Alice movement frozen (death_movement: false)', alice.walkSpeed === 0, `walkSpeed=${alice.walkSpeed}`)
  check('Bob still survival', bob.game.gameMode === 'survival', bob.game.gameMode)
  check('Carol still survival', carol.game.gameMode === 'survival', carol.game.gameMode)

  // Non-op cannot revive
  cb = bob.chatLog.length
  bob.chat('/setlives Alice 5')
  await sleep(1500)
  check('non-op /setlives is refused', !alice.chatLog.some(l => /Your life count has been changed/.test(l)), bob.chatLog.slice(cb).join(' | '))

  // Rejoin at 0 lives stays spectator
  alice.quit()
  await sleep(1500)
  const alice2 = await h.connectBot('Alice')
  check('Alice rejoins as spectator at 0 lives', await h.waitGameMode(alice2, 'spectator'), alice2.game.gameMode)

  // Op revives Alice from the console
  let ca = alice2.chatLog.length
  server.cmd('setlives Alice 2')
  check('Alice told her lives changed', await h.waitChat(alice2, /Your life count has been changed to: 2/, 5000, ca))
  await sleep(4000)
  check('revived Alice is survival', await h.waitGameMode(alice2, 'survival'), alice2.game.gameMode)
  check('revived Alice can move again', alice2.walkSpeed > 0, `walkSpeed=${alice2.walkSpeed}`)
  ca = alice2.chatLog.length
  alice2.chat('/lives')
  check('revived Alice has 2 lives', await h.waitChat(alice2, /You have 2 live\(s\) left/, 5000, ca), alice2.chatLog.slice(ca).join(' | '))

  check('no plugin errors in console', !server.since(m).some(l => /ERROR|Exception/.test(l) && !/Unknown or incomplete/.test(l)),
    server.since(m).filter(l => /ERROR|Exception/.test(l)).slice(0, 3).join(' | '))

  h.quit([alice2, bob, carol])
  await sleep(1000)
  await server.stop()
  h.summary()
}

main().catch(e => { console.error(e); process.exitCode = 1 }).then(() => process.exit())
