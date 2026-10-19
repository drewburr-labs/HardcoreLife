# HardcoreLife 3.0.0

[![HardcoreLife](https://www.spigotmc.org/data/resource_icons/91/91375.jpg?1618568731)](https://github.com/drewburr-labs/HardcoreLife)

Minecraft Plugin for a Hardcore survival multiplayer with life system with 2 options:

- Global Lives: The server shares lives wit hall players. If a player dies, everyone loses a life.
- Player Lives: Players have their own set of lives.

**Supports [PaperMC](https://papermc.io/downloads) 26.1-26.3** (requires Java 25). This is a Paper plugin: it does not run on Bukkit or Spigot.

This is a fork of [Chryscorelab/HardcoreLife](https://github.com/Chryscorelab/HardcoreLife), updated for Paper 26.x. Downloads are on the [releases page](https://github.com/drewburr-labs/HardcoreLife/releases). See the [wiki](https://github.com/drewburr-labs/HardcoreLife/wiki) for setup, commands and configuration, and [Upgrading from 2.x](https://github.com/drewburr-labs/HardcoreLife/wiki/Upgrading-from-2.x) for what changed in 3.0.

---

## Commands

`/lives` : Show the numbers of lives you have

`/setlives` : Set the life count of a player

`/resetserver` : Delete all worlds and reset the life count. When global lives is enabled and the life count hits 0, this command becomes gloally accessible.

More details [here](https://github.com/drewburr-labs/HardcoreLife/wiki/Commands)

## Restarting after `/resetserver`

More details on the wiki's [Resetting the server](https://github.com/drewburr-labs/HardcoreLife/wiki/Resetting-the-server) page.

`/resetserver` kicks everyone and restarts the server. The worlds are deleted when the server starts back up, before any world is loaded. **If the server does not start again by itself, the reset only happens on the next manual start.**

Paper can only restart itself when it has a start script to run. Use one of these options:

**Option 1: Paper's restart script.** Paper runs the script set in `spigot.yml` (default `./start.sh`, relative to the server folder):

```yaml
settings:
  restart-script: ./start.sh
```

Create the script in the server folder with your usual launch command, then make it executable (`chmod +x start.sh`):

```sh
#!/bin/sh
cd "$(dirname "$0")"
exec java -Xmx4G -jar paper.jar --nogui
```

On Windows, point `restart-script` to a `.bat` file instead. If the script is missing, the console shows `Startup script './start.sh' does not exist! Stopping server.` and the server stays off.

**Option 2: Your server manager.** If the server runs under something that starts it again when it stops, such as a hosting panel with auto-restart, systemd (`Restart=always`) or Docker (`--restart unless-stopped`), no script is needed. Don't use both options together, or two servers may start at once.

### Crafty Controller

Don't let the restart script start Java itself under Crafty: Crafty would lose track of the server. Use one of these instead:

- **Crash detection:** In the server's Crafty config, turn on **Crash Detection** and remove `0` from **Ignored Exit Codes**. Crafty checks for a stopped server every 30 seconds, so the restart can take up to 30 seconds to begin. Crafty also restarts the server after a normal `stop`.
- **Restart script that calls Crafty's API:** Starts the server again a few seconds after it stops, and only after a restart, not a normal `stop`. Create an API key in Crafty for a user with the **Commands** permission on the server, then use this as the restart script:

  ```sh
  #!/bin/sh
  # Paper runs this on /restart. Ask Crafty to start the server as soon as this one has exited.
  CRAFTY_URL="https://localhost:8443"   # your Crafty panel address
  CRAFTY_TOKEN="paste-api-token-here"   # Crafty API key with the Commands permission on this server
  SERVER_ID="paste-server-id-here"      # the server's ID, shown in its Crafty URL

  JAVA_PID=$PPID   # Paper launches this script, so its parent is the server process
  (
    while kill -0 "$JAVA_PID" 2>/dev/null; do sleep 1; done
    sleep 2   # let Crafty see that the old process exited
    curl -sk -X POST \
      -H "Authorization: Bearer $CRAFTY_TOKEN" \
      "$CRAFTY_URL/api/v2/servers/$SERVER_ID/action/start_server"
  ) >/dev/null 2>&1 &
  ```

  With this script, keep `0` in **Ignored Exit Codes** (or crash detection off), so Crafty doesn't also restart the server.

## Config

See the `config.yml` file of the plugin, more details in the [Wiki](https://github.com/drewburr-labs/HardcoreLife/wiki/Config-files)

`reset_new_seed` controls what `/resetserver` keeps:

- `false` (default): The new world uses the same seed, and keeps its world settings (gamerules, spawn point, difficulty).
- `true`: The new world is generated with a new seed.

Either way, all chunks, player data (inventories, advancements, stats) and lives are reset.

## Dependencies

No active dependencies at this time.

## Building and testing

Build the plugin with Java 25:

```sh
./mvnw package
```

The jar is written to `target/`. To test deaths, game over and `/resetserver` with simulated players, see [test/bots](./test/bots/README.md).

## Issue? Need help or have suggestions?

Please feel free to open an issue [here](https://github.com/drewburr-labs/HardcoreLife/issues)! We welcome new suggestions and always appreciate bug reports.

If you're not sure where to start, or would like to help contribute to the project, check out our [Contributing guidelines](./CONTRIBUTING.md).

**Feel free to suggest & and create pull requests!**

## Licenced under GNU General Public License v3.0

More simple : [https://choosealicense.com/licenses/gpl-3.0/#](https://choosealicense.com/licenses/gpl-3.0/#)

                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
Everyone is permitted to copy and distribute verbatim copies
of this license document, but changing it is not allowed.

![bstats](https://bstats.org/signatures/bukkit/HardcoreLife.svg)
