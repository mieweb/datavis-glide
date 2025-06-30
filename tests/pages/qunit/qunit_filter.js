window.test_filter = function (view) {
	var tests = {
		int: {
			number: [
				{ filter: {'$eq': 7000}, rows: 1 },
				{ filter: {'$ne': 7000}, rows: 999 },
				{ filter: {'$gt': 7000}, rows: 281, min: 7008 },
				{ filter: {'$gte': 7000}, rows: 282, min: 7000 },
				{ filter: {'$lt': 7000}, rows: 718, max: 6994 },
				{ filter: {'$lte': 7000}, rows: 719, max: 7000 },
			],
			numeral: [
				{ filter: {'$eq': numeral('7000')}, rows: 1 },
				{ filter: {'$ne': numeral('7000')}, rows: 999 },
				{ filter: {'$gt': numeral('7000')}, rows: 281, min: 7008 },
				{ filter: {'$gte': numeral('7000')}, rows: 282, min: 7000 },
				{ filter: {'$lt': numeral('7000')}, rows: 718, max: 6994 },
				{ filter: {'$lte': numeral('7000')}, rows: 719, max: 7000 },
			],
		},
		float1: {
			number: [
				{ filter: {'$eq': 8443.374093398956}, rows: 1 },
				{ filter: {'$ne': 8443.374093398956}, rows: 999 },
				{ filter: {'$gt': 8443.374093398956}, rows: 149 },
				{ filter: {'$gte': 8443.374093398956}, rows: 150 },
				{ filter: {'$lt': 8443.374093398956}, rows: 850 },
				{ filter: {'$lte': 8443.374093398956}, rows: 851 },
			],
			numeral: [
				{ filter: {'$eq': numeral('8443.374093398956')}, rows: 1 },
				{ filter: {'$ne': numeral('8443.374093398956')}, rows: 999 },
				{ filter: {'$gt': numeral('8443.374093398956')}, rows: 149 },
				{ filter: {'$gte': numeral('8443.374093398956')}, rows: 150 },
				{ filter: {'$lt': numeral('8443.374093398956')}, rows: 850 },
				{ filter: {'$lte': numeral('8443.374093398956')}, rows: 851 },
			],
		},
		float2: {
			number: [
				{ filter: {'$eq': 8443.374}, rows: 1 },
				{ filter: {'$ne': 8443.374}, rows: 999 },
				{ filter: {'$gt': 8443.374}, rows: 149 },
				{ filter: {'$gte': 8443.374}, rows: 150 },
				{ filter: {'$lt': 8443.374}, rows: 850 },
				{ filter: {'$lte': 8443.374}, rows: 851 },
			],
			numeral: [
				{ filter: {'$eq': numeral('8443.374')}, rows: 1 },
				{ filter: {'$ne': numeral('8443.374')}, rows: 999 },
				{ filter: {'$gt': numeral('8443.374')}, rows: 149 },
				{ filter: {'$gte': numeral('8443.374')}, rows: 150 },
				{ filter: {'$lt': numeral('8443.374')}, rows: 850 },
				{ filter: {'$lte': numeral('8443.374')}, rows: 851 },
			],
		},
	};

	var filterInfo = [
		{ field: 'int1', type: 'int', args: [ 'number', /*'numeral'*/ ] },
		{ field: 'int2', type: 'int', args: [ 'number', /*'numeral'*/ ] },
		{ field: 'int3', type: 'int', args: [ 'number', /*'numeral'*/ ] },
		{ field: 'float1', type: 'float1', args: [ 'number', /*'numeral'*/ ] },
		{ field: 'float2', type: 'float1', args: [ 'number', /*'numeral'*/ ] },
		{ field: 'float3', type: 'float2', args: [ 'number', /*'numeral'*/ ] },
	];

	QUnit.test('Filter Test', function (assert) {
		var done = assert.async();
		MIE.WC_DataVis.Util.asyncEach(filterInfo, function (fi, i1, next_fi) {
			MIE.WC_DataVis.Util.asyncEach(fi.args, function (arg, i2, next_arg) {
				MIE.WC_DataVis.Util.asyncEach(tests[fi.type][arg], function (test, i3, next_test) {
					var info = sprintf('Field = "%s" ; Arg Type = "%s" ; Filter = "%s"',
						fi.field, arg, JSON.stringify(test.filter));
					view.reset();
					var spec = {};
					spec[fi.field] = test.filter;
					view.setFilter(spec);
					view.getData(function (ok, data) {
						assert.equal(data.data.length, test.rows, info);
						return next_test();
					});
				}, next_arg);
			}, next_fi);
		}, done);
	});
};
