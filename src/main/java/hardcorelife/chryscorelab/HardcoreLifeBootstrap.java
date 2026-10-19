package hardcorelife.chryscorelab;

import io.papermc.paper.plugin.bootstrap.BootstrapContext;
import io.papermc.paper.plugin.bootstrap.PluginBootstrap;

import hardcorelife.chryscorelab.helpers.WorldReset;

public class HardcoreLifeBootstrap implements PluginBootstrap {

    @Override
    public void bootstrap(BootstrapContext context) {
        // Runs before the server reads any world data, so a reset can also replace the world's seed
        WorldReset.deletePending(context.getDataDirectory(), context.getLogger());
    }
}
