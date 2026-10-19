// Languages: players see messages in their client language, broadcasts are sent per player,
// unknown regions fall back to the closest language, and use_client_language: false uses the server language
const h = require('./harness')
const { check, sleep } = h

async function main () {
  await h.setupServer()
  h.resetServerFiles()
  h.setProperty('hardcore', 'false')
  h.installConfig({ global_lives: 'false', starting_lives: '2', language: 'en_EN', use_client_language: 'true' })

  let server = new h.Server('locale.log')
  await server.start()
  let m = server.mark()

  const hans = await h.connectBot('Hans', 'de_DE')
  const jean = await h.connectBot('Jean', 'fr_FR')
  const ana = await h.connectBot('Ana', 'pt_PT')
  const tom = await h.connectBot('Tom', 'en_US')
  const luca = await h.connectBot('Luca', 'it_IT')

  check('de_DE client gets German welcome', await h.waitChat(hans, /Willkommen zurück an Bord, Hans! Du hast noch 2 Leben übrig/), hans.chatLog.join(' | '))
  check('fr_FR client gets French welcome', await h.waitChat(jean, /Bon retour à bord Jean ! Vous avez 2 vie\(s\) restante\(s\)/), jean.chatLog.join(' | '))
  check('pt_PT client falls back to pt_BR', await h.waitChat(ana, /Bem-vindo de volta a bordo, Ana! Você tem 2 vida\(s\)/), ana.chatLog.join(' | '))
  check('en_US client gets English welcome', await h.waitChat(tom, /Welcome back aboard Tom! You have 2 live\(s\) remaining/), tom.chatLog.join(' | '))
  check('it_IT client (not bundled) gets server language', await h.waitChat(luca, /Welcome back aboard Luca! You have 2 live\(s\) remaining/), luca.chatLog.join(' | '))

  // Command replies, errors and usage use the sender's language
  let cj = jean.chatLog.length
  jean.chat('/lives')
  check('/lives reply in French', await h.waitChat(jean, /Vous avez 2 vie\(s\) restante\(s\)/, 5000, cj), jean.chatLog.slice(cj).join(' | '))
  cj = jean.chatLog.length
  jean.chat('/lives Nobody')
  check('unknown player error in French', await h.waitChat(jean, /ERREUR : Joueur inconnu 'Nobody'/, 5000, cj), jean.chatLog.slice(cj).join(' | '))
  check('usage message in French', await h.waitChat(jean, /Utilisation : \/lives \[joueur\]/, 5000, cj), jean.chatLog.slice(cj).join(' | '))
  server.cmd('lives Hans')
  check('console /lives uses server language', !!await server.waitFor(/Hans has 2 live\(s\) left/, 5000, m))

  // Private death message in the victim's language
  let ch = hans.chatLog.length
  server.cmd('kill Hans')
  check('death message in German', await h.waitChat(hans, /Du hast noch 1 Leben übrig/, 8000, ch), hans.chatLog.slice(ch).join(' | '))
  await sleep(2000)

  // Permadeath broadcast reaches each player in their own language
  cj = jean.chatLog.length
  const ca = ana.chatLog.length
  const ct = tom.chatLog.length
  const m2 = server.mark()
  server.cmd('kill Hans')
  check('broadcast in French for Jean', await h.waitChat(jean, /Hans a épuisé toutes ses vies/, 8000, cj), jean.chatLog.slice(cj).join(' | '))
  check('broadcast in Portuguese for Ana', await h.waitChat(ana, /Hans ficou sem vidas/, 8000, ca), ana.chatLog.slice(ca).join(' | '))
  check('broadcast in English for Tom', await h.waitChat(tom, /Hans has run out of lives/, 8000, ct), tom.chatLog.slice(ct).join(' | '))
  check('broadcast in server language on console', !!await server.waitFor(/Hans has run out of lives/, 8000, m2))
  check('Jean does not get the English broadcast', !jean.chatLog.slice(cj).some(l => /run out of lives/.test(l)))

  // use_client_language: false sends everyone the server language
  h.quit([hans, jean, ana, tom, luca])
  await sleep(1000)
  await server.stop()
  h.writeConfig({ language: 'de_DE', use_client_language: 'false' })
  server = new h.Server('locale.log')
  await server.start()
  m = server.mark()
  check('server logs German as server language', server.lines.some(l => /Server language: de_DE/.test(l)))

  const tom2 = await h.connectBot('Tom', 'en_US')
  const jean2 = await h.connectBot('Jean', 'fr_FR')
  check('client language off: en_US client gets German', await h.waitChat(tom2, /Willkommen zurück an Bord, Tom!/), tom2.chatLog.join(' | '))
  check('client language off: fr_FR client gets German', await h.waitChat(jean2, /Willkommen zurück an Bord, Jean!/), jean2.chatLog.join(' | '))

  h.quit([tom2, jean2])
  await sleep(1000)
  await server.stop()
  h.summary()
}

main().catch(e => { console.error(e); process.exitCode = 1 }).then(() => process.exit())
