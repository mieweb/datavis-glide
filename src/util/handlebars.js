// Imports {{{1

import _ from 'underscore';
import Handlebars from 'handlebars';

import {
	debug,
	format,
	getPropDef,
	objFromArray,
} from './misc.js';

// makeEnv {{{1

function makeEnv() {
	return Handlebars.create();
}

// addHelpers {{{1

function addHelpers(env, data) {
	var ai = objFromArray(['cell', 'group', 'pivot', 'all'], [[]]);
	ai = _.mapObject(ai, function (val, key) {
		return _.filter(
			getPropDef([], data, 'agg', 'info', key),
			function (aggInfo) {
				return !aggInfo.isHidden;
			}
		);
	});

	// rowval {{{2

	env.registerHelper('rowval', function (groupField) {
		if (['number', 'string'].indexOf(typeof groupField) < 0) {
			throw new Error('In Handlebars "rowval" helper, `groupField` must be a number or string');
		}

		var groupFieldIndex;

		if (typeof groupField === 'number') {
			groupFieldIndex = groupField;

			if (groupFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, group field index "' + groupField + '" out of range');
			}
		}
		else {
			groupFieldIndex = data.groupFields.indexOf(groupField);

			if (groupFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, specified field "' + groupField + '" is not part of group');
			}
		}

		return data.rowVals[this.rowValIndex][groupFieldIndex];
	});

	// colval {{{2

	env.registerHelper('colval', function (pivotField) {
		if (['number', 'string'].indexOf(typeof pivotField) < 0) {
			throw new Error('In Handlebars "rowval" helper, `pivotField` must be a number or string');
		}

		var pivotFieldIndex;

		if (typeof pivotField === 'number') {
			pivotFieldIndex = pivotField;

			if (pivotFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, pivot field index "' + pivotField + '" out of range');
			}
		}
		else {
			pivotFieldIndex = data.pivotFields.indexOf(pivotField);

			if (pivotFieldIndex < 0) {
				throw new Error('In Handlebars "rowval" helper, specified field "' + pivotField + '" is not part of pivot');
			}
		}

		return data.colVals[this.colValIndex][pivotFieldIndex];
	});

	// aggregate {{{2

	env.registerHelper('aggregate', function (type, aggNum) {
		var ctx = this;

		if (data.isGroup && ['group', 'all'].indexOf(type) < 0) {
			throw new Error('In Handlebars "aggregate" helper, `type` must be one of: { group, all }');
		}
		else if (data.isPivot && ['cell', 'group', 'pivot', 'all'].indexOf(type) < 0) {
			throw new Error('In Handlebars "aggregate" helper, `type` must be one of: { cell, group, pivot, all }');
		}

		if (typeof aggNum !== 'number') {
			throw new Error('In Handlebars "aggregate" helper, `aggNum` must be a number');
		}

		if (ai[type].length <= aggNum) {
			// throw new Error('In Handlebars "aggregate" helper, `aggNum` must be in range: 0 to ' + (ai[type].length - 1));
			return '[HELPER/AGGREGATE: AGGNUM OUT OF RANGE]';
		}

		var aggInfo = data.agg.info[type][aggNum];
		var aggResult = data.agg.results[type][aggNum][ctx.rowValIdx][ctx.colValIdx];
		var text;

		if (aggResult instanceof jQuery) {
			aggResult = aggResult.get(0);
		}

		if (aggResult instanceof Element) {
			//td.appendChild(aggResult);
			return aggResult;
		}
		else {
			if (aggInfo.instance.inheritFormatting) {
				text = format(aggInfo.colConfig[0], aggInfo.typeInfo[0], aggResult, {
					overrideType: aggInfo.instance.getType()
				});
				//setTableCell(td, text, {
				//	field: aggInfo.fields[0],
				//	colConfig: aggInfo.colConfig[0],
				//	typeInfo: aggInfo.typeInfo[0]
				//});
				return text;
			}
			else {
				text = format(null, null, aggResult, {
					overrideType: aggInfo.instance.getType(),
					convert: false
				});
				//setTableCell(td, text);
				return text;
			}
		}
	});
}

export default {
	makeEnv: makeEnv,
	addHelpers: addHelpers,
};
