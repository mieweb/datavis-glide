import jQuery from 'jquery';

// Don't try to inline this code, it won't work. Imports are lifted,
// and this code needs to run before we import jQuery UI. Yes, this
// is an unhinged workaround.

import original_jQuery from './global-jquery.js';

import 'block-ui';
import 'flatpickr';
import 'jquery-ui/dist/jquery-ui.min.js';
import 'jquery-contextmenu';
import 'sumoselect';

import 'jquery-ui/dist/themes/base/jquery-ui.min.css';
import 'jquery-contextmenu/dist/jquery.contextMenu.min.css';
import 'sumoselect/sumoselect.min.css';
import './wcdatavis.css';

import { ParamInput } from './src/source_param.js';
import { Source } from './src/source.js';
import { ComputedView } from './src/computed_view.js';
import { Grid } from './src/grid.js';
import { Graph } from './src/graph.js';
import { Prefs } from './src/prefs.js';
import { Perspective } from './src/perspective.js';

// We left the global jQuery around long enough for jQuery UI to install itself, and that same
// jQuery object has been used by all other plugins and DataVis code.  Now that we're all done,
// make it so nobody can access our jQuery, to avoid conflicts.

if (original_jQuery != null) {
  window.jQuery = original_jQuery;
}
else {
  delete window.jQuery;
}

export {
  Source,
  ParamInput,
  ComputedView,
  Prefs,
  Perspective,
  Grid,
  Graph,
  jQuery
};
