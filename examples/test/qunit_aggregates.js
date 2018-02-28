window.test_aggregates = function (view) {
	var expected = {
		country: ['Canada', 'China', 'England', 'France', 'Germany', 'Japan', 'Mexico', 'South Korea', 'Switzerland', 'United States'],
		fruit: ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Kiwi', 'Mango', 'Orange', 'Pineapple', 'Strawberry'],
		count: [0, 1, 3, 5, 6, 14, 9, 5, 1, 0]
	};

	var testData = MIE.Util.iota(9);
	var tests = ['count'];

	QUnit.test('Aggregate Test', function (assert) {
		var done = assert.async();

		view.reset();
		view.setGroup({fieldNames: ['country']}, {
			updateData: false
		});
		view.setPivot({fieldNames: ['fruit']}, {
			updateData: false
		});

		(function (args, fun, done) {
			function g() {
				if (args.length === 0) {
					return done();
				}
				fun(args.shift(), g);
			};
			g();
		})(tests, function (fun, next) {
			view.setAggregate(MIE.Util.objFromArray(['group', 'pivot', 'cell', 'all'], [[{fun: fun}]]));
			view.getData(function (data) {
				console.log(data.agg.results.cell);
				_.each(MIE.Util.iota(9), function (n) {
					var info = fun + '[' + expected.country[n] + '][' + expected.fruit[n] + ']';
					assert.equal(data.agg.results.cell[0][n][n], expected[fun][n], info);
				});
				return next();
			});
		}, done);
	});
};



