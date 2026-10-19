package hardcorelife.chryscorelab.listeners;

import hardcorelife.chryscorelab.Touchy;
import hardcorelife.chryscorelab.helpers.PlayerLife;

import org.bukkit.Server;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerGameModeChangeEvent;
import java.io.IOException;
import java.util.logging.Logger;

public class HardcorePermadeath implements Listener {

    private static Touchy touchy = Touchy.get();
    private static Server server = touchy.getServer();

    private static Logger logger = server.getLogger();

    @EventHandler
    public void onPlayerGameModeChangeEvent(PlayerGameModeChangeEvent event) throws IOException {
        // Cancel events where Hardcore mode would cause permadeath
        Player player = event.getPlayer();

        // Vanilla puts dead players into spectator in hardcore worlds. Undo that while they still have lives.
        // Spectator mode set for any other reason (commands, permadeath) is left alone.
        if (event.getCause() == PlayerGameModeChangeEvent.Cause.HARDCORE_DEATH && PlayerLife.getLives(player) > 0) {
            event.setCancelled(true);
            logger.info("Cancelled permadeath event for " + player.getName());
        }
    }
}
