import * as Util from './src/util.js';
import { OrdMap } from './src/ordmap.js';
import { Aggregate, AGGREGATE_REGISTRY } from './src/aggregates.js';
import { ParamInput } from './src/source_param.js';
import { Source } from './src/source.js';
import { View } from './src/view.js';
import { Grid } from './src/grid.js';
import { Graph } from './src/graph.js';
import { Perspective, Prefs, PrefsBackend, PrefsModule, PrefsModuleGrid, PREFS_BACKEND_REGISTRY, PREFS_MODULE_REGISTRY } from './src/prefs.js';
import { trans } from './src/trans.js';

	// Contains information on all the filters that the user has access to.
	var filters = [];
	var gensymSeed = 0;

	window.MIE              = window.MIE || {};
	window.MIE.log          = Util.log;
	window.MIE.debug        = Util.debug;
	window.MIE.OrdMap       = OrdMap;
	window.MIE.Lock         = Util.Lock;
	window.MIE.trans        = trans;
	window.MIE.makeSubclass = Util.makeSubclass;

	window.MIE.WC_DataVis                        = window.MIE.WC_DataVis || {};
	window.MIE.WC_DataVis.Aggregate              = Aggregate;
	window.MIE.WC_DataVis.AGGREGATE_REGISTRY     = AGGREGATE_REGISTRY;
	window.MIE.WC_DataVis.ParamInput             = ParamInput;
	window.MIE.WC_DataVis.Source                 = Source;
	window.MIE.WC_DataVis.View                   = View;
	window.MIE.WC_DataVis.Grid                   = Grid;
	window.MIE.WC_DataVis.grids                  = {};
	window.MIE.WC_DataVis.Graph                  = Graph;
	window.MIE.WC_DataVis.graphs                 = {};
	window.MIE.WC_DataVis.Perspective            = Perspective;
	window.MIE.WC_DataVis.Prefs                  = Prefs;
	window.MIE.WC_DataVis.PrefsBackend           = PrefsBackend;
	window.MIE.WC_DataVis.PrefsModule            = PrefsModule;
	window.MIE.WC_DataVis.PrefsModuleGrid        = PrefsModuleGrid;
	window.MIE.WC_DataVis.PREFS_BACKEND_REGISTRY = PREFS_BACKEND_REGISTRY;
	window.MIE.WC_DataVis.PREFS_MODULE_REGISTRY  = PREFS_MODULE_REGISTRY;
	window.MIE.WC_DataVis.EXPORT_URL             = 'export.php';

	window.MIE.WC_DataVis.Util                    = Util;

// vim:set ft=javascript:
