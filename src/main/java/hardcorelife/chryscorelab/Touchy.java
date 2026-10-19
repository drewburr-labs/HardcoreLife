package hardcorelife.chryscorelab;

import org.bukkit.GameMode;
import org.bukkit.World;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.permissions.PermissionDefault;

import io.papermc.paper.command.brigadier.Commands;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import org.bstats.bukkit.Metrics;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.java.JavaPlugin;

import hardcorelife.chryscorelab.commands.Lives;
import hardcorelife.chryscorelab.commands.ResetServer;
import hardcorelife.chryscorelab.commands.SetLives;
import hardcorelife.chryscorelab.helpers.Lang;
import hardcorelife.chryscorelab.helpers.PlayerLife;
import hardcorelife.chryscorelab.helpers.WorldReset;
import hardcorelife.chryscorelab.listeners.HardcorePermadeath;
import hardcorelife.chryscorelab.listeners.PlayerDeath;
import hardcorelife.chryscorelab.listeners.PlayerJoinServer;
import hardcorelife.chryscorelab.listeners.WorldLoad;
import net.kyori.adventure.text.Component;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;

public final class Touchy extends JavaPlugin {

    private static Touchy instance;
    private static FileConfiguration config;
    private static FileConfiguration livesConfig;

    @Override
    public void onEnable() {
        instance = this;

        // Plugin startup logic
        saveDefaultConfig();
        getConfig().options().copyDefaults(true);

        // Initialize config files
        livesConfig = getLivesConfig();
        config = getConfig();
        Lang.load(this, config.getString("language", Lang.DEFAULT_LANGUAGE),
                config.getBoolean("use_client_language", true));

        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> {
            Commands commands = event.registrar();
            commands.register("lives", "Show a player's current life count", new Lives());
            commands.register("setlives", "Set the life count of a player", new SetLives());
            commands.register("resetserver", "Reset all worlds and life values", new ResetServer());
        });

        PluginManager pm = getServer().getPluginManager();

        pm.registerEvents(new PlayerDeath(), this);
        pm.registerEvents(new PlayerJoinServer(), this);
        pm.registerEvents(new WorldLoad(), this);
        pm.registerEvents(new HardcorePermadeath(), this);

        // Game over survives restarts, so let everyone use /resetserver again
        if (globalLivesEnabled() && PlayerLife.getServerLives() == 0) {
            pm.getPermission("hardcorelife.resetserver").setDefault(PermissionDefault.TRUE);
        }

        // Setup bStats
        new Metrics(this, 12723);
    }

    @Override
    public void onDisable() {
        // Plugin shutdown logic
        PlayerLife.saveLivesData();
        instance = null;
    }

    public static Touchy get() {
        return instance;
    }

    public void resetServer() {
        // Deletes all worlds on the server and resets life counts
        Logger logger = getServer().getLogger();

        // Kick all online players
        for (Player p : getServer().getOnlinePlayers()) {
            p.kick(Component.text(Lang.get(p, "reset.kick")));
        }

        // Delete existing lives.yml, and drop the in-memory copy so it isn't saved again on shutdown
        getLivesConfigFile().delete();
        livesConfig = new YamlConfiguration();
        // Clear playerlife cache
        PlayerLife.clearLivesData();

        // Delete all worlds on the next startup. The level directory contains the default world's
        // dimensions and all player data
        Path levelDirectory = getServer().getLevelDirectory();
        List<Path> deletePaths = new ArrayList<>();
        deletePaths.add(levelDirectory);
        for (World world : getServer().getWorlds()) {
            deletePaths.add(world.getWorldPath());
        }
        List<Path> keepPaths = new ArrayList<>();
        if (!resetNewSeedEnabled()) {
            // Keep the seed and world settings. Each dimension stores its own seed and gamerules
            keepPaths.add(levelDirectory.resolve("level.dat"));
            keepPaths.add(levelDirectory.resolve("level.dat_old"));
            for (World world : getServer().getWorlds()) {
                Path worldData = world.getWorldPath().resolve("data");
                keepPaths.add(worldData.resolve("minecraft").resolve("world_gen_settings.dat"));
                keepPaths.add(worldData.resolve("minecraft").resolve("game_rules.dat"));
                // Without these, Paper treats the dimension as an old world and runs its storage migration
                keepPaths.add(worldData.resolve("paper").resolve("metadata.dat"));
                keepPaths.add(worldData.resolve("paper").resolve("level_overrides.dat"));
            }
        }
        try {
            WorldReset.schedule(getDataFolder().toPath(), deletePaths, keepPaths);
        } catch (IOException e) {
            logger.severe("Failed to schedule world deletion: " + e.getMessage());
        }

        logger.info("Restarting the server..");
        getServer().restart();
    }

    private FileConfiguration getLivesConfig() {
        File LivesConfigFile = getLivesConfigFile();
        FileConfiguration LivesConfig = new YamlConfiguration();
        try {
            LivesConfig.load(LivesConfigFile);
        } catch (IOException | InvalidConfigurationException e) {
            e.printStackTrace();
        }
        return LivesConfig;
    }

    private void setLivesConfig(FileConfiguration LivesConfig) {
        File LivesConfigFile = getLivesConfigFile();
        try {
            LivesConfig.save(LivesConfigFile);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private File getLivesConfigFile() {
        // Ensures lives.yml exists, and returns the file object
        File LivesConfigFile = new File(getDataFolder(), "lives.yml");
        if (!LivesConfigFile.exists()) {
            LivesConfigFile.getParentFile().mkdirs();
            saveResource("lives.yml", false);
        }
        return LivesConfigFile;
    }

    public int getDefaultLives() {
        // Returns the starting_lives value from config.yml
        return config.getInt("starting_lives");
    }

    public boolean globalLivesEnabled() {
        // Returns the global_lives value from config.yml
        return config.getBoolean("global_lives");
    }

    public boolean deathMovementEnabled() {
        // Returns the death_movement value from config.yml
        if (globalLivesEnabled()) {
            return false;
        } else {
            return config.getBoolean("death_movement");
        }

    }

    public double getLifeScalingValue() {
        // Returns the server_life_scaling value from config.yml
        return config.getDouble("server_life_scaling");
    }

    public int getPlayerLivesConfig(UUID uuid) {
        // Gets the number of lives a player has from config.yml
        // If no data is set, the default is returned
        return livesConfig.getInt(uuid + ".lives", getDefaultLives());
    }

    public void savePlayerLifeConfig(UUID uuid, int lives) {
        // Update the life value for a single player, in lives.yml
        livesConfig.set(uuid + ".lives", lives);
        setLivesConfig(livesConfig);
    }

    public void saveHashmapData(HashMap<UUID, Integer> lives) {
        // Invoked during plugin shutdown, saves in-memory config to disk
        for (Map.Entry<UUID, Integer> entry : lives.entrySet()) {
            livesConfig.set(entry.getKey() + ".lives", entry.getValue());
        }
        setLivesConfig(livesConfig);
    }

    public boolean naturalRegEnabled() {
        // Returns the value of natural_regeneration from config.yml
        return getConfig().getBoolean("natural_regeneration", false);
    }

    public boolean resetNewSeedEnabled() {
        // Returns the value of reset_new_seed from config.yml
        return config.getBoolean("reset_new_seed", false);
    }

    public boolean killGainLivesEnabled() {
        // Returns the value of kill_gain_lives from config.yml
        if (globalLivesEnabled()) {
            return false;
        } else {
            return config.getBoolean("kill_gain_lives");
        }
    }

    public GameMode getGameModePermaDeath() {
        // Returns the value of gamemode_on_death from config.yml
        return GameMode.valueOf(config.getString("gamemode_on_permadeath"));
    }
}
