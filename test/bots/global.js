// Global lives: deaths drain the shared pool, game over puts everyone in spectator,
// and a non-op player can run /resetserver
const h = require('./harness')
const { check, sleep } = h

async function main () {
  await h.setupServer()
  h.resetServerFiles()
  h.setProperty('hardcore', process.argv[2] === 'hardcore' ? 'true' : 'false')
  let server = new h.Server('global.log')
  await server.start()
  let m = server.mark()

  const alice = await h.connectBot('Alice')
  const bob = await h.connectBot('Bob')
  check('join message shows server lives', await h.waitChat(alice, /The server has 3 lives remaining/))
  check('players start in survival', alice.game.gameMode === 'survival' && bob.game.gameMode === 'survival')
  check('non-op cannot see /resetserver before game over', !bob.commandNames.has('resetserver'))

  let c = bob.chatLog.length
  bob.chat('/resetserver true')
  await sleep(2000)
  check('non-op /resetserver is refused before game over', server.proc.exitCode === null && !server.since(m).some(l => /Restarting the server/.test(l)),
    bob.chatLog.slice(c).join(' | '))

  bob.chat('/lives')
  check('/lives works for non-op', await h.waitChat(bob, /The server has 3 live\(s\) left/, 5000, c))

  server.cmd('kill Alice')
  check('death 1 -> 2 lives broadcast', !!await server.waitFor(/The server has 2 live\(s\) remaining/, 8000, m))
  check('Alice sees broadcast', await h.waitChat(alice, /The server has 2 live\(s\) remaining/))
  await sleep(2000)
  check('Alice respawns in survival', await h.waitGameMode(alice, 'survival'))

  server.cmd('kill Bob')
  check('death 2 -> 1 life broadcast', !!await server.waitFor(/The server has 1 live\(s\) remaining/, 8000, m))
  await sleep(2000)

  server.cmd('kill Alice')
  check('death 3 -> 0 lives broadcast', !!await server.waitFor(/The server has 0 live\(s\) remaining/, 8000, m))
  check('game over broadcast', !!await server.waitFor(/Game over! When ready, use the '\/resetserver'/, 8000, m))
  await sleep(3000)
  check('Alice is spectator after game over', await h.waitGameMode(alice, 'spectator'), alice.game.gameMode)
  check('Bob is spectator after game over', await h.waitGameMode(bob, 'spectator'), bob.game.gameMode)
  check('non-op can see /resetserver after game over', bob.commandNames.has('resetserver'))

  // A brand new player joining after game over
  const carol = await h.connectBot('Carol')
  check('new player joins as spectator after game over', await h.waitGameMode(carol, 'spectator'), carol.game.gameMode)
  check('new player is told the game is over', await h.waitChat(carol, /Game over!/))
  check('new player can see /resetserver', carol.commandNames.has('resetserver'))

  // Spectators trying to get out of spectator
  bob.chat('/gamemode survival')
  await sleep(1500)
  check('non-op cannot leave spectator with /gamemode', bob.game.gameMode === 'spectator')

  // Restart without resetting: game over should persist
  h.quit([alice, bob, carol])
  await sleep(1000)
  await server.stop()
  server = new h.Server('global.log')
  await server.start()
  m = server.mark()
  const alice2 = await h.connectBot('Alice')
  check('after plain restart, still spectator', await h.waitGameMode(alice2, 'spectator'), alice2.game.gameMode)
  check('after plain restart, still 0 lives', await h.waitChat(alice2, /Game over!/))
  check('after plain restart, non-op can see /resetserver', alice2.commandNames.has('resetserver'))

  // Non-op resets the server
  alice2.chat('/resetserver true')
  check('non-op /resetserver triggers reset', !!await server.waitFor(/Restarting the server/, 8000, m))
  check('players are kicked with reset message', await new Promise(resolve => {
    const t = setTimeout(() => resolve(/resetting/.test(alice2.kickReason || '')), 8000)
    alice2.once('end', () => setTimeout(() => { clearTimeout(t); resolve(/resetting/.test(alice2.kickReason || '')) }, 500))
  }), alice2.kickReason)
  await Promise.race([server.exited, sleep(60000)])
  check('server stops for restart', server.proc.exitCode !== null)

  // Next boot: fresh world, lives restored, players back in survival
  server = new h.Server('global.log')
  await server.start()
  m = server.mark()
  check('world data deleted on boot', server.lines.some(l => /\[Hardcorelife\] Deleting all world data/.test(l)))
  const alice3 = await h.connectBot('Alice')
  const bob3 = await h.connectBot('Bob')
  await sleep(3000)
  check('after reset, Alice is survival', await h.waitGameMode(alice3, 'survival'), alice3.game.gameMode)
  check('after reset, Bob is survival', await h.waitGameMode(bob3, 'survival'), bob3.game.gameMode)
  check('after reset, server lives back to 3', await h.waitChat(alice3, /The server has 3 lives remaining/))
  check('after reset, non-op cannot see /resetserver', !bob3.commandNames.has('resetserver'))
  server.cmd('lives')
  check('after reset, console /lives says 3', !!await server.waitFor(/The server has 3 live\(s\) left/, 5000, m))

  h.quit([alice3, bob3])
  await sleep(1000)
  await server.stop()
  h.summary()
}

main().catch(e => { console.error(e); process.exitCode = 1 }).then(() => process.exit())
