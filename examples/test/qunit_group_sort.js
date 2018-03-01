window.test_group_sort = function (view) {
	var sortInfo = [
		['string1', '-a', 'zonetime', 'random dictionary word'],
		['int1', 1, 9996, 'integer (number → number)'],
		['int2', '1', '9996', 'integer (string → number)'],
		['int3', '1', '9,996', 'integer (string → numeral)'],
		['float1', 2.4067245551437795, 9995.851570643537, 'float (number → number)'],
		['float2', '2.4067245551437795', '9995.851570643537', 'float (string → number)'],
		['float3', '2.407', '9,995.852', 'float (string → numeral)'],
		['currency1', 2.41, 9995.85, 'currency (number : currency → number)'],
		['currency2', '2.41', '9,995.85', 'currency (string : currency → number)'],
		['currency3', '$2.41', '$9,995.85', 'currency (string : currency → numeral)'],
		['currency4', '$2.41', '$9,995.85', 'currency (string : string → numeral)'],
		['date1', '1900-07-12', '2099-09-08', 'date (string → string)'],
		['date2', 'Jul 12, 1900', 'Sep 8, 2099', 'date (string → moment)'],
		['date3', '07/12/1900', '09/08/2099', 'date (string → moment)']
	];

	QUnit.test('Group Sort Test', function (assert) {
		var done = assert.async();
		MIE.Util.asyncEach(sortInfo, function (si, next) {
			var field = si[0];
			var min = si[1];
			var max = si[2];
			var info = si[3];
			view.reset();
			view.setGroup({fieldNames: [field]}, {
				updateData: false
			});
			view.setSort({ vertical: { groupFieldIndex: 0, dir: 'ASC' }}, {
				updateData: false
			});
			view.getData(function (data) {
				var cell = data.rowVals[0][0];
				assert.equal(cell, min, info + ' min');
				view.reset();
				view.setGroup({fieldNames: [field]}, {
					updateData: false
				});
				view.setSort({ vertical: { groupFieldIndex: 0, dir: 'DESC' }}, {
					updateData: false
				});
				view.getData(function (data) {
					var cell = data.rowVals[0][0];
					assert.equal(cell, max, info + ' max');
					return next();
				});
			});
		}, done);
	});
};
