# Bot tests

These tests start a local Paper server with the plugin and connect simulated players ([mineflayer](https://github.com/PrismarineJS/mineflayer) bots) to it. The tests then kill players from the server console and check what the players see.

They cover:

- **Global lives:** deaths drain the shared lives, game over puts everyone in spectator (including new players), and non-op players can use `/resetserver` once the game is over, even after a restart. After the reset, players are back in survival with the starting lives.
- **Per-player lives:** each player's own life count, permadeath with movement frozen, gaining a life for a kill, and reviving a player with `/setlives`.

Each scenario runs with and without `hardcore=true`.

The tests run on Paper 26.1.2, because mineflayer doesn't support later Minecraft versions yet.

## Requirements

- Java 25
- Node.js 22 or later
- Port 25598 free (set `PORT` to use a different one)

## Running

Build the plugin, then run the tests:

```sh
./mvnw package
cd test/bots
npm install
MINECRAFT_EULA=true npm test
```

Setting `MINECRAFT_EULA=true` accepts the [Minecraft EULA](https://aka.ms/MinecraftEULA) for the test server. The tests don't run without it.

The first run downloads the Paper server jar into `test/bots/server/`. Each scenario deletes and recreates the test world, and logs the server console to `test/bots/server/<scenario>.log`.

To run one scenario:

```sh
MINECRAFT_EULA=true node global.js
MINECRAFT_EULA=true node perplayer.js hardcore
```
