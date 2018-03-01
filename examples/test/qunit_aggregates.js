window.test_aggregates = function (view) {
	var country = ['Canada', 'China', 'England', 'France', 'Germany', 'Japan', 'Mexico', 'South Korea', 'Switzerland', 'United States'];
	var fruit = ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Kiwi', 'Mango', 'Orange', 'Pineapple', 'Strawberry'];

	var compare = {
		numeral: function (actual, expected) {
			return expected == null ? actual == null : numeral.isNumeral(actual) && actual._value === expected;
		}
	};

	var expected = [{
		fun: 'count',
		agg: [{
			result: [0, 2, 5, 11, 17, 29, 18, 8, 4, 0]
		}]
	}, {
		fun: 'min',
		agg: [{
			fields: ['int1'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined]
		}, {
			fields: ['int2'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.numeral
		}, {
			fields: ['int3'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.numeral
		}]
	}, {
		fun: 'max',
		agg: [{
			fields: ['int1'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined]
		}, {
			fields: ['int2'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.numeral
		}, {
			fields: ['int3'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.numeral
		}]
	}];

	var testData = MIE.Util.iota(9);
	var tests = ['count', 'min', 'max'];

	myEach = function (args, fun, done) {
		function g() {
			if (args.length === 0) {
				return done();
			}
			fun(args.shift(), g);
		};
		g();
	};

	QUnit.test('Aggregate Test', function (assert) {
		var done = assert.async();

		view.reset();
		view.setGroup({fieldNames: ['country']}, {
			updateData: false
		});
		view.setPivot({fieldNames: ['fruit']}, {
			updateData: false
		});

		myEach(expected, function (e, e_next) {
			myEach(e.agg, function (a, a_next) {
				view.setAggregate(MIE.Util.objFromArray(['group', 'pivot', 'cell', 'all'],
					[[{
						fun: e.fun,
						opts: {
							fields: a.fields,
							typeInfo: [{type: a.type}]
						}
					}]]));
				view.getData(function (data) {
					_.each(a.result, function (r, i) {
						var actual = data.agg.results.cell[0][i][i];
						var info = 'fun = ' + e.fun + ' ; fields = ' + JSON.stringify(a.fields) + ' ; country = ' + country[i] + ' ; fruit = ' + fruit[i] + ' ; expected = ' + r;
						if (a.compare) {
							assert.ok(a.compare(actual, r), info);
						}
						else {
							assert.equal(actual, r, info);
						}
					});
					a_next();
				});
			}, e_next);
		}, done);
	});
};



