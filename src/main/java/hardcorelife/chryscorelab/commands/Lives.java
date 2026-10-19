package hardcorelife.chryscorelab.commands;

import org.bukkit.Server;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import io.papermc.paper.command.brigadier.BasicCommand;
import io.papermc.paper.command.brigadier.CommandSourceStack;

import java.util.Collection;
import java.util.List;

import hardcorelife.chryscorelab.Touchy;
import hardcorelife.chryscorelab.helpers.PlayerLife;

public class Lives implements BasicCommand {

    private static Touchy touchy = Touchy.get();
    private static Server server = touchy.getServer();

    private static final String USAGE = "Usage: /lives [player]";

    @Override
    public void execute(CommandSourceStack source, String[] args) {
        CommandSender sender = source.getSender();
        if (!onCommand(sender, args)) {
            sender.sendMessage(USAGE);
        }
    }

    @Override
    public Collection<String> suggest(CommandSourceStack source, String[] args) {
        // Suggest online players for the first argument
        if (args.length > 1) {
            return List.of();
        }
        String prefix = args.length == 0 ? "" : args[0].toLowerCase();
        return server.getOnlinePlayers().stream()
                .map(Player::getName)
                .filter(name -> name.toLowerCase().startsWith(prefix))
                .toList();
    }

    private boolean onCommand(CommandSender sender, String[] args) {

        if (touchy.globalLivesEnabled()) {
            sender.sendMessage("The server has " + PlayerLife.getServerLives() + " live(s) left.");
        } else {
            if (args.length > 0) {
                Player player = server.getPlayer(args[0]);

                if (player instanceof Player) {
                    sender.sendMessage(player.getName() + " has " + PlayerLife.getLives(player) + " live(s) left.");
                } else {
                    sender.sendMessage("ERROR: Unknown player '" + args[0] + "'");
                    return false;
                }

            } else if (sender instanceof Player) {
                Player player = (Player) sender;
                sender.sendMessage("You have " + PlayerLife.getLives(player) + " live(s) left.");
            } else {
                return false;
            }
        }
        return true;
    }
}
