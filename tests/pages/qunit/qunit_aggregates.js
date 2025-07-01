window.test_aggregates = function (view) {
	var country = ['Canada', 'China', 'England', 'France', 'Germany', 'Japan', 'Mexico', 'South Korea', 'Switzerland', 'United States'];
	var fruit = ['Apple', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Kiwi', 'Mango', 'Orange', 'Pineapple', 'Strawberry'];

	var compare = {
		numeral: function (actual, expected) {
			return expected == null ? actual == null : actual.value() === expected;
		},
		bignumber: function (actual, expected) {
			return expected == null ? actual == null : actual.valueOf() === expected + '';
		},
		moment: function (actual, expected) {
			return expected == null ? actual == null : actual.format('YYYY-MM-DD') == expected;
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
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
		}, {
			fields: ['int2'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
		}, {
			fields: ['int3'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
		}, {
			fields: ['int4'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.numeral,
		}, {
			fields: ['int5'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.numeral,
		}, {
			fields: ['int6'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.numeral,
		}, {
			fields: ['int7'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.bignumber,
		}, {
			fields: ['int8'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.bignumber,
		}, {
			fields: ['int9'],
			type: 'number',
			result: [undefined, 3762, 2038, 2300, 619, 216, 138, 128, 4230, undefined],
			compare: compare.bignumber,
		}, {
			fields: ['float1'],
			type: 'number',
			result: [undefined, 4085.8535856102976, 3563.2227077138227, 623.9952704976507, 420.00331514144483, 126.34235380845713, 1009.1114906484772, 245.6222131805768, 77.75871770920617, undefined],
		}, {
			fields: ['float2'],
			type: 'number',
			result: [undefined, 4085.8535856102976, 3563.2227077138227, 623.9952704976507, 420.00331514144483, 126.34235380845713, 1009.1114906484772, 245.6222131805768, 77.75871770920617, undefined],
		}, {
			fields: ['float3'],
			type: 'number',
			result: [undefined, 4085.854, 3563.223, 623.995, 420.003, 126.342, 1009.111, 245.622, 77.759, undefined],
		}, {
			fields: ['date1'],
			type: 'date',
			result: [undefined, '1927-06-11', '1918-10-13', '1904-03-06', '1904-02-07', '1904-02-07', '1902-12-29', '1926-12-12', '1985-07-17', undefined],
		}, {
			fields: ['date2'],
			type: 'date',
			result: [undefined, '1927-06-11', '1918-10-13', '1904-03-06', '1904-02-07', '1904-02-07', '1902-12-29', '1926-12-12', '1985-07-17', undefined],
			compare: compare.moment,
		}, {
			fields: ['date3'],
			type: 'date',
			result: [undefined, '1927-06-11', '1918-10-13', '1904-03-06', '1904-02-07', '1904-02-07', '1902-12-29', '1926-12-12', '1985-07-17', undefined],
			compare: compare.moment,
		}]
	}, {
		fun: 'max',
		agg: [{
			fields: ['int1'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
		}, {
			fields: ['int2'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
		}, {
			fields: ['int3'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
		}, {
			fields: ['int4'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.numeral,
		}, {
			fields: ['int5'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.numeral,
		}, {
			fields: ['int6'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.numeral,
		}, {
			fields: ['int7'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.bignumber,
		}, {
			fields: ['int8'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.bignumber,
		}, {
			fields: ['int9'],
			type: 'number',
			result: [undefined, 4768, 9559, 9777, 9966, 9934, 9671, 7649, 9921, undefined],
			compare: compare.bignumber,
		}, {
			fields: ['float1'],
			type: 'number',
			result: [undefined, 7497.945848259077, 9761.31834703292, 9744.630654275461, 9168.495238256613, 8710.055326779791, 9873.722758763914, 7342.059137229501, 7892.5880545143655, undefined],
		}, {
			fields: ['float2'],
			type: 'number',
			result: [undefined, 7497.945848259077, 9761.31834703292, 9744.630654275461, 9168.495238256613, 8710.055326779791, 9873.722758763914, 7342.059137229501, 7892.5880545143655, undefined],
		}, {
			fields: ['float3'],
			type: 'number',
			result: [undefined, 7497.946, 9761.318, 9744.631, 9168.495, 8710.055, 9873.723, 7342.059, 7892.588, undefined],
		}, {
			fields: ['date1'],
			type: 'date',
			result: [undefined, '2034-04-17', '2089-02-11', '2077-10-05', '2096-12-23', '2093-03-26', '2099-09-08', '2084-05-31', '2054-11-30', undefined],
		}, {
			fields: ['date2'],
			type: 'date',
			result: [undefined, '2034-04-17', '2089-02-11', '2077-10-05', '2096-12-23', '2093-03-26', '2099-09-08', '2084-05-31', '2054-11-30', undefined],
			compare: compare.moment,
		}, {
			fields: ['date3'],
			type: 'date',
			result: [undefined, '2034-04-17', '2089-02-11', '2077-10-05', '2096-12-23', '2093-03-26', '2099-09-08', '2084-05-31', '2054-11-30', undefined],
			compare: compare.moment,
		}]
	}];

	function toString(x) {
		if (numeral.isNumeral(x)) {
			return 'Numeral(' + x.value() + ')';
		}
		else if (BigNumber.isBigNumber(x)) {
			return 'BigNumber(' + x.valueOf() + ')';
		}
		else if (moment.isMoment(x)) {
			return 'Moment(' + x.toString() + ')';
		}
		else {
			return x;
		}
	}

	QUnit.test('Aggregate Test', function (assert) {
		var done = assert.async();

		view.reset();
		view.setGroup({fieldNames: ['country']}, {
			updateData: false
		});
		view.setPivot({fieldNames: ['fruit']}, {
			updateData: false
		});

		MIE.WC_DataVis.Util.asyncEach(expected, function (e, i1, e_next) {
			MIE.WC_DataVis.Util.asyncEach(e.agg, function (a, i2, a_next) {
				view.setAggregate(MIE.WC_DataVis.Util.objFromArray(['group', 'pivot', 'cell', 'all'],
					[[{
						fun: e.fun,
						fields: a.fields,
						opts: {
							typeInfo: [{type: a.type}]
						}
					}]]));
				view.getData(function (ok, data) {
					_.each(a.result, function (r, i) {
						var actual = data.agg.results.cell[0][i][i];
						var info = 'fun = ' + e.fun + ' ; fields = ' + JSON.stringify(a.fields) + ' ; country = ' + country[i] + ' ; fruit = ' + fruit[i] + ' ; expected = ' + r + ' ; actual = ' + toString(actual);
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
