import { PrefsModule, PREFS_MODULE_REGISTRY, OrdMap } from 'datavis-ace';
import { makeSubclass, deepDefaults } from './util/misc.js';
import { Grid } from './grid.js';
import { Graph } from './graph.js';

// PrefsModuleGrid {{{1

/**
 * Manages configuration of a grid.
 *
 * @param {Grid} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Grid} target
 * What bound object to interact with.
 */

var PrefsModuleGrid = makeSubclass('PrefsModuleGrid', PrefsModule, function () {
    var self = this
        , args = Array.prototype.slice.call(arguments);

    self.super['PrefsModule'].ctor.apply(self, args);

    if (!(self.target instanceof Grid)) {
        throw new Error('Call Error: `target` must be an instance of Grid');
    }
});

// #load {{{2

PrefsModuleGrid.prototype.load = function (config) {
    var self = this;

    if (config == null) {
        return;
    }

    if (config.colConfig != null) {
        self.target.setColConfig(OrdMap.deserialize(config.colConfig), {
            from: 'prefs',
            redraw: false,
            savePrefs: false
        });
    }
};

// #save {{{2

PrefsModuleGrid.prototype.save = function () {
    var self = this;

    var prefs = {};

    var colConfig = self.target.getColConfig();
    if (colConfig != null) {
        prefs.colConfig = colConfig.serialize();
    }

    return prefs;
};

// #reset {{{2

PrefsModuleGrid.prototype.reset = function () {
    var self = this;

    self.target.resetColConfig();
};

// PrefsModuleGraph {{{1

/**
 * Manages configuration of a graph.
 *
 * @param {Graph} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Graph} target
 * What bound object to interact with.
 */

var PrefsModuleGraph = makeSubclass('PrefsModuleGraph', PrefsModule, function () {
    var self = this
        , args = Array.prototype.slice.call(arguments);

    self.super['PrefsModule'].ctor.apply(self, args);

    if (!(self.target instanceof Graph)) {
        throw new Error('Call Error: `target` must be an instance of Graph');
    }
});

// #load {{{2

PrefsModuleGraph.prototype.load = function (config) {
    var self = this;

    if (config == null) {
        return;
    }

    self.target.setUserConfig(config);
};

// #save {{{2

PrefsModuleGraph.prototype.save = function () {
    var self = this;

    var prefs = deepDefaults(self.target.userConfig, {
        plain: {},
        group: {},
        pivot: {}
    });



    return prefs;
};

// #reset {{{2

PrefsModuleGraph.prototype.reset = function () {
    var self = this;
};

PREFS_MODULE_REGISTRY.set('grid', PrefsModuleGrid);
PREFS_MODULE_REGISTRY.set('graph', PrefsModuleGraph);
