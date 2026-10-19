package hardcorelife.chryscorelab.helpers;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.slf4j.Logger;

public class WorldReset {

    // Lists the world folders to delete on the next startup, one "<action> <path>" per line
    private static final String MARKER_FILE = "pending-reset.txt";
    private static final String DELETE = "delete";
    private static final String KEEP = "keep";

    public static void schedule(Path dataDir, List<Path> deletePaths, List<Path> keepPaths) throws IOException {
        // Worlds are saved again after plugins are disabled, so they can't be deleted during shutdown.
        // Record their paths instead, to be deleted on the next startup.
        List<String> lines = new ArrayList<>();
        for (Path path : deletePaths) {
            lines.add(DELETE + " " + path.toAbsolutePath().normalize());
        }
        for (Path path : keepPaths) {
            lines.add(KEEP + " " + path.toAbsolutePath().normalize());
        }
        Files.createDirectories(dataDir);
        Files.write(dataDir.resolve(MARKER_FILE), lines);
    }

    public static void deletePending(Path dataDir, Logger logger) {
        // Must run before the server reads any world data, so this is called from the bootstrapper
        Path marker = dataDir.resolve(MARKER_FILE);
        if (!Files.exists(marker)) {
            return;
        }

        List<Path> deletePaths = new ArrayList<>();
        List<Path> keepPaths = new ArrayList<>();
        try {
            for (String line : Files.readAllLines(marker)) {
                String[] parts = line.split(" ", 2);
                if (parts.length < 2) {
                    continue;
                }
                if (parts[0].equals(DELETE)) {
                    deletePaths.add(Path.of(parts[1]));
                } else if (parts[0].equals(KEEP)) {
                    keepPaths.add(Path.of(parts[1]));
                }
            }
        } catch (IOException e) {
            logger.error("Failed to read {}", marker, e);
            return;
        }

        logger.info("Deleting all world data");
        for (Path path : deletePaths) {
            logger.info("Deleting: {}", path);
            try {
                deleteDirectory(path, keepPaths);
            } catch (IOException e) {
                logger.error("Failed to delete world: {}", path, e);
            }
        }
        for (Path path : keepPaths) {
            if (Files.exists(path)) {
                logger.info("Kept: {}", path);
            }
        }

        try {
            Files.delete(marker);
        } catch (IOException e) {
            logger.error("Failed to delete {}", marker, e);
        }
    }

    private static void deleteDirectory(Path dir, List<Path> keepPaths) throws IOException {
        if (!Files.exists(dir)) {
            return;
        }
        try (var paths = Files.walk(dir)) {
            // Delete children before their parent directories
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                // Skip kept files, and the directories that still contain them
                if (keepPaths.stream().anyMatch(keep -> keep.startsWith(path))) {
                    continue;
                }
                Files.delete(path);
            }
        }
    }
}
