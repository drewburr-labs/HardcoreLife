package hardcorelife.chryscorelab.commands;

import org.bukkit.command.CommandSender;
import org.jetbrains.annotations.Nullable;

import io.papermc.paper.command.brigadier.BasicCommand;
import io.papermc.paper.command.brigadier.CommandSourceStack;

import hardcorelife.chryscorelab.Touchy;
import hardcorelife.chryscorelab.helpers.Lang;

public class ResetServer implements BasicCommand {

    private static Touchy touchy = Touchy.get();


    @Override
    public void execute(CommandSourceStack source, String[] args) {
        CommandSender sender = source.getSender();
        if (!onCommand(sender, args)) {
            sender.sendMessage(Lang.get(sender, "usage.resetserver"));
        }
    }

    @Override
    public @Nullable String permission() {
        return "hardcorelife.resetserver";
    }

    private boolean onCommand(CommandSender sender, String[] args) {

        Boolean confirm = false;
        try {
            confirm = Boolean.parseBoolean(args[0]);
        } catch (Exception e) {
            return false;
        }

        if (confirm) {
            touchy.resetServer();
        } else {
            return false;
        }

        return true;
    }
}
