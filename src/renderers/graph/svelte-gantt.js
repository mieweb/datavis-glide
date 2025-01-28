import _ from 'underscore';
import moment from 'moment';
import numeral from 'numeral';
import jQuery from 'jquery';

// import { mount } from 'svelte'; // Svelte 5
import { SvelteGantt, SvelteGanttTable, SvelteGanttDependencies } from 'svelte-gantt';

import {
	dataURItoBlob,
	debug,
	deepCopy,
	deepDefaults,
	getProp,
	loadScript,
	log,
	makeSubclass,
	setProp,
} from '../../util/misc.js';
import {AggregateInfo} from '../../aggregates';
import {GROUP_FUNCTION_REGISTRY} from '../../group_fun.js';

import { GraphRenderer } from '../../graph_renderer.js';

// GraphRendererSvelteGantt {{{1

var GraphRendererSvelteGantt = makeSubclass('GraphRendererSvelteGantt', GraphRenderer);

// #draw {{{2

GraphRendererSvelteGantt.prototype.draw = function () {
	var self = this;

	self.elt.children().remove();

	self.view.getData(function (ok, data) {
		self.view.getTypeInfo(function () {
			var rows = []
				, rowMap = {} // Used to keep track of rows we've already created.
				, tasks = []
				, deps = []
				, rowId = 0
				, taskId = 0
				, depId = 0
				, minDate = null
				, maxDate = null;

			_.each(data.data, function (row) {
				if (rowMap[row.rowData['Resource'].value] == null) {
					rows.push({
						id: rowId,
						name: row.rowData['Resource'].value
					});
					rowMap[row.rowData['Resource'].value] = rowId;
					rowId += 1;
				}

				var newTask = {
					id: taskId,
					resourceId: rowMap[row.rowData['Resource'].value],
					amountDone: row.rowData['Completion'].value,
					from: row.rowData['Start'].value.valueOf(),
					to: row.rowData['End'].value.valueOf(),
					label: row.rowData['Name'].value,
				};
				tasks.push(newTask);
				taskId += 1;

				if (row.rowData['Dependencies'].value.length > 0) {
					_.each(row.rowData['Dependencies'].value.split(','), function (dep) {
						deps.push({
							id: depId,
							fromId: dep - 1,
							toId: newTask.id
						});
						depId += 1;
					});
				}

				// Track the overall min/max date for the task.

				if (minDate == null || minDate > newTask.from) {
					minDate = newTask.from;
				}
				if (maxDate == null || maxDate < newTask.to) {
					maxDate = newTask.to;
				}
			});

			var target = jQuery('<div>').appendTo(self.elt).get(0);
			var props = {
				rows: rows,
				tasks: tasks,
				from: minDate,
				to: maxDate,
				headers: [{
					unit: 'week',
					format: 'dd/MM/yyyy'
				}],
				tableHeaders: [{title: 'Resource', property: 'name'}],
				ganttTableModules: [SvelteGanttTable],
				highlightedDurations: {
					unit: 'day',
					fractions: [0,6]
				},
				dependencies: deps,
				ganttBodyModules: [SvelteGanttDependencies]
			};

			// Svelte 4
			var gantt = new SvelteGantt({
				target: target,
				props: props
			});

			// Svelte 5
			// mount(SvelteGantt(self.elt, props));
		});
	}, 'Drawing Svelte-Gantte graph');
};

// Exports {{{1

export default GraphRendererSvelteGantt;
