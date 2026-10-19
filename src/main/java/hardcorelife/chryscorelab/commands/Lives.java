package hardcorelife.chryscorelab.commands;

import org.bukkit.Server;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import io.papermc.paper.command.brigadier.BasicCommand;
import io.papermc.paper.command.brigadier.CommandSourceStack;

import java.util.Collection;
import java.util.List;

import hardcorelife.chryscorelab.Touchy;
import hardcorelife.chryscorelab.helpers.Lang;
import hardcorelife.chryscorelab.helpers.PlayerLife;

public class Lives implements BasicCommand {

    private static Touchy touchy = Touchy.get();
    private static Server server = touchy.getServer();


    @Override
    public void execute(CommandSourceStack source, String[] args) {
        CommandSender sender = source.getSender();
        if (!onCommand(sender, args)) {
            sender.sendMessage(Lang.get(sender, "usage.lives"));
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
            sender.sendMessage(Lang.get(sender, "lives.server", "lives", PlayerLife.getServerLives()));
        } else {
            if (args.length > 0) {
                Player player = server.getPlayer(args[0]);

                if (player instanceof Player) {
                    sender.sendMessage(
                            Lang.get(sender, "lives.player", "player", player.getName(), "lives", PlayerLife.getLives(player)));
                } else {
                    sender.sendMessage(Lang.get(sender, "error.unknown_player", "player", args[0]));
                    return false;
                }

            } else if (sender instanceof Player) {
                Player player = (Player) sender;
                sender.sendMessage(Lang.get(sender, "lives.self", "lives", PlayerLife.getLives(player)));
            } else {
                return false;
            }
        }
        return true;
    }
}
