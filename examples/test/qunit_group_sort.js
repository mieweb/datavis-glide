window.test_group_sort = function (view) {
	var compare = {
		numeral: function (actual, expected) {
			return expected == null ? actual == null : numeral.isNumeral(actual) && actual._input === expected;
		},
		moment: function (actual, expected) {
			return expected == null ? actual == null : moment.isMoment(actual) && moment.creationData().input === actual;
		}
	};

	var extract = {
		numeral: function (x) {
			return numeral.isNumeral(x) && x._input;
		},
		moment: function (x) {
			return moment.isMoment(x) && x.creationData().input;
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
		min: '1',
		max: '9996',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'integer (string → number)'
	}, {
		field: 'int3',
		min: '1',
		max: '9,996',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'integer (string → numeral)'
	}, {
		field: 'float1',
		min: 2.4067245551437795,
		max: 9995.851570643537,
		info: 'float (number → number)'
	}, {
		field: 'float2',
		min: '2.4067245551437795',
		max: '9995.851570643537',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'float (string → number)'
	}, {
		field: 'float3',
		min: '2.407',
		max: '9,995.852',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'float (string → numeral)'
	}, {
		field: 'currency1',
		min: 2.41,
		max: 9995.85,
		info: 'currency (number : currency → number)'
	}, {
		field: 'currency2',
		min: '2.41',
		max: '9,995.85',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'currency (string : currency → number)'
	}, {
		field: 'currency3',
		min: '$2.41',
		max: '$9,995.85',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'currency (string : currency → numeral)'
	}, {
		field: 'currency4',
		min: '$2.41',
		max: '$9,995.85',
		compare: compare.numeral,
		extract: extract.numeral,
		info: 'currency (string : string → numeral)'
	}, {
		field: 'date1',
		min: '1900-07-12',
		max: '2099-09-08',
		info: 'date (string → string)'
	}, {
		field: 'date2',
		min: 'Jul 12, 1900',
		max: 'Sep 8, 2099',
		compare: compare.moment,
		extract: extract.moment,
		info: 'date (string → moment)'
	}, {
		field: 'date3',
		min: '07/12/1900',
		max: '09/08/2099',
		compare: compare.moment,
		extract: extract.moment,
		info: 'date (string → moment)'
	}];

	QUnit.test('Group Sort Test', function (assert) {
		var done = assert.async();
		MIE.Util.asyncEach(sortInfo, function (si, next) {
			view.reset();
			view.setGroup({fieldNames: [si.field]}, {
				updateData: false
			});
			view.setSort({ vertical: { groupFieldIndex: 0, dir: 'ASC' }}, {
				updateData: false
			});
			view.getData(function (data) {
				var actual = data.rowVals[0][0];
				/*
				if (si.compare) {
					assert.ok(si.compare(actual, si.min), si.info + ' min');
				}
				else {
					assert.equal(actual, si.min, si.info + ' min');
				}
				*/
				if (si.extract) {
					actual = si.extract(actual);
				}
				assert.equal(actual, si.min, si.info + ' min');
				view.reset();
				view.setGroup({fieldNames: [si.field]}, {
					updateData: false
				});
				view.setSort({ vertical: { groupFieldIndex: 0, dir: 'DESC' }}, {
					updateData: false
				});
				view.getData(function (data) {
					var actual = data.rowVals[0][0];
					/*
					if (si.compare) {
						assert.ok(si.compare(actual, si.max), si.info + ' max');
					}
					else {
						assert.equal(actual, si.max, si.info + ' max');
					}
					*/
					if (si.extract) {
						actual = si.extract(actual);
					}
					assert.equal(actual, si.max, si.info + ' max');
					return next();
				});
			});
		}, done);
	});
};
