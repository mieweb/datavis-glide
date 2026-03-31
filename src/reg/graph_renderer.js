import OrdMap from 'datavis-ace/src/util/ordmap.js';

import GraphRendererChartJs from '../renderers/graph/chartjs.js';
import GraphRendererGoogle from '../renderers/graph/google.js';
import GraphRendererJit from '../renderers/graph/jit.js';

// Registry {{{1

var GRAPH_RENDERER_REGISTRY = new OrdMap();

GRAPH_RENDERER_REGISTRY.set('chartjs', GraphRendererChartJs);
GRAPH_RENDERER_REGISTRY.set('google', GraphRendererGoogle);
GRAPH_RENDERER_REGISTRY.set('jit', GraphRendererJit);

// Exports {{{1

export default GRAPH_RENDERER_REGISTRY;
