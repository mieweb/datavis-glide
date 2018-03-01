window.test_sort = function (view) {
	var sortInfo = [
		['string1', '-a', 'zonetime', 'random dictionary word'],
		['int1', 11, 9980, 'integer (number → number)'],
		['int2', '1', '9995', 'integer (string → number)'],
		['int3', '4', '9,996', 'integer (string → numeral)'],
		['float1', 13.9823790892304, 9976.691192005153, 'float (number → number)'],
		['float2', '23.57328962881953', '9997.815710735613', 'float (string → number)'],
		['float3', '14.95', '9,977.657', 'float (string → numeral)'],
		['currency1', 1.34, 9998.03, 'currency (number : currency → number)'],
		['currency2', '15.24', '9,959.51', 'currency (string : currency → number)'],
		['currency3', '$11.43', '$9,997.63', 'currency (string : currency → numeral)'],
		['currency4', '', '', 'currency (string : string → numeral)'],
		['date1', '1900-06-10', '2099-05-13', 'date (string → string)'],
		['date2', 'Aug 13, 1900', 'Dec 13, 2098', 'date (string → moment)'],
		['date3', '01/07/70', '11/14/09', 'date (string → moment)']
	];

	QUnit.test('Sort Test', function (assert) {
		var done = assert.async();
		(function (args, fun, done) {
			function g() {
				if (args.length === 0) {
					return done();
				}
				fun(args.shift(), g);
			};
			g();
		})(sortInfo, function (si, next) {
			var field = si[0];
			var min = si[1];
			var max = si[2];
			var info = si[3];
			view.reset();
			view.setSort({ vertical: { field: field, dir: 'ASC' }}, {
				updateData: false
			});
			view.getData(function (data) {
				var cell = data.data[0].rowData[field];
				assert.equal(cell.orig || cell.value, min, info);
				view.reset();
				view.setSort({ vertical: { field: field, dir: 'DESC' }});
				view.getData(function (data) {
					var cell = data.data[0].rowData[field];
					assert.equal(cell.orig || cell.value, max, info);
					return next();
				});
			});
		}, done);
	});
};
