window.test_group_sort = function (view) {
	var extract = {
		numeral: function (x) {
			return x._input;
		},
		moment: function (x) {
			return x.creationData().input;
		}
	};

	var sortInfo = [{
		field: 'string1',
		min: '-a',
		max: 'zonetime',
		info: 'random dictionary word'
	}, {
		field: 'int1',
		min: 1,
		max: 9996,
		info: 'integer (number → number)'
	}, {
		field: 'int2',
		min: 1,
		max: 9996,
		info: 'integer (string → number)'
	}, {
		field: 'int3',
		min: 1,
		max: 9996,
		info: 'integer (string w/ comma → number)'
	}, {
		field: 'float1',
		min: 2.4067245551437795,
		max: 9995.851570643537,
		info: 'float (number → number)'
	}, {
		field: 'float2',
		min: 2.4067245551437795,
		max: 9995.851570643537,
		info: 'float (string → number)'
	}, {
		field: 'float3',
		min: 2.407,
		max: 9995.852,
		info: 'float (string w/ comma → number)'
	}, {
		field: 'currency1',
		min: 2.41,
		max: 9995.85,
		info: 'currency (number : currency → number)'
	}, {
		field: 'currency2',
		min: 2.41,
		max: 9995.85,
		info: 'currency (string w/ comma : currency → number)'
	}, {
		field: 'currency3',
		min: 2.41,
		max: 9995.85,
		info: 'currency (string w/ comma & dollar : currency → number)'
	}, {
		field: 'currency4',
		min: 2.41,
		max: 9995.85,
		info: 'currency (string : string → number)'
	}, {
		field: 'date1',
		min: '1900-07-12',
		max: '2099-09-08',
		info: 'date (string → string)'
	}, {
		field: 'date2',
		min: 'Jul 12, 1900',
		max: 'Sep 8, 2099',
		extract: extract.moment,
		info: 'date (string → moment)'
	}, {
		field: 'date3',
		min: '07/12/1900',
		max: '09/08/2099',
		extract: extract.moment,
		info: 'date (string → moment)'
	}];

	QUnit.test('Group Sort Test', function (assert) {
		var done = assert.async();
		MIE.WC_DataVis.Util.asyncEach(sortInfo, function (si, next) {
			view.reset();
			view.setGroup({fieldNames: [si.field]}, {
				updateData: false
			});
			view.setSort({ vertical: { groupFieldIndex: 0, dir: 'ASC' }}, {
				updateData: false
			});
			view.getData(function (ok, data) {
				var actual = data.rowVals[0][0];
				if (si.extract) {
					actual = si.extract(actual);
				}
				console.log('QUNIT : GROUP SORT << %s // %s // min >> Expected = %O, Actual = %O', si.field, si.info, si.min, actual);
				assert.equal(actual, si.min, si.field + ' // ' + si.info + ' // min');
				view.reset();
				view.setGroup({fieldNames: [si.field]}, {
					updateData: false
				});
				view.setSort({ vertical: { groupFieldIndex: 0, dir: 'DESC' }}, {
					updateData: false
				});
				view.getData(function (ok, data) {
					var actual = data.rowVals[0][0];
					if (si.extract) {
						actual = si.extract(actual);
					}
					console.log('QUNIT : GROUP SORT << %s // %s // max >> Expected = %O, Actual = %O', si.field, si.info, si.max, actual);
					assert.equal(actual, si.max, si.field + ' // ' + si.info + ' // max');
					return next();
				});
			});
		}, done);
	});
};
