import 'block-ui';
import 'flatpickr';
import 'jquery-ui/dist/jquery-ui.min.js';
import 'jquery-contextmenu';
import 'sumoselect';

import * as Util from './src/util/misc.js';
import OrdMap from './src/util/ordmap.js';
import Lock from './src/util/lock.js';
import { Aggregate, AGGREGATE_REGISTRY } from './src/aggregates.js';
import { ParamInput } from './src/source_param.js';
import { Source } from './src/source.js';
import { ComputedView } from './src/computed_view.js';
import { MirageView } from './src/mirage_view.js';
import { GroupFunction, GROUP_FUNCTION_REGISTRY } from './src/group_fun.js';
import { Grid } from './src/grid.js';
import { Graph } from './src/graph.js';
import { Prefs } from './src/prefs.js';
import { Perspective } from './src/perspective.js';
import { PrefsBackend, PREFS_BACKEND_REGISTRY } from './src/prefs_backend.js';
import { PrefsModule, PrefsModuleGrid, PREFS_MODULE_REGISTRY } from './src/prefs_module.js';
import { trans } from './src/trans.js';

window.MIE              = window.MIE || {};
window.MIE.log          = Util.log;
window.MIE.debug        = Util.debug;
window.MIE.OrdMap       = OrdMap;
window.MIE.Lock         = Lock;
window.MIE.trans        = trans;
window.MIE.makeSubclass = Util.makeSubclass;

window.MIE.WC_DataVis                 = window.MIE.WC_DataVis || {};
window.MIE.WC_DataVis.Aggregate       = Aggregate;
window.MIE.WC_DataVis.ParamInput      = ParamInput;
window.MIE.WC_DataVis.Source          = Source;
window.MIE.WC_DataVis.GroupFunction   = GroupFunction;
window.MIE.WC_DataVis.ComputedView    = ComputedView;
window.MIE.WC_DataVis.MirageView      = MirageView;
window.MIE.WC_DataVis.Grid            = Grid;
window.MIE.WC_DataVis.grids           = {};
window.MIE.WC_DataVis.Graph           = Graph;
window.MIE.WC_DataVis.graphs          = {};
window.MIE.WC_DataVis.Perspective     = Perspective;
window.MIE.WC_DataVis.Prefs           = Prefs;
window.MIE.WC_DataVis.PrefsBackend    = PrefsBackend;
window.MIE.WC_DataVis.PrefsModule     = PrefsModule;
window.MIE.WC_DataVis.PrefsModuleGrid = PrefsModuleGrid;
window.MIE.WC_DataVis.EXPORT_URL      = 'export.php';

// Expose "registry" extension points

window.MIE.WC_DataVis.AGGREGATE_REGISTRY      = AGGREGATE_REGISTRY;
window.MIE.WC_DataVis.GROUP_FUNCTION_REGISTRY = GROUP_FUNCTION_REGISTRY;
window.MIE.WC_DataVis.PREFS_BACKEND_REGISTRY  = PREFS_BACKEND_REGISTRY;
window.MIE.WC_DataVis.PREFS_MODULE_REGISTRY   = PREFS_MODULE_REGISTRY;

window.MIE.WC_DataVis.Util                    = Util;
