window.test_group = function (view) {
	var groupInfo = [
		[
			['fruit'], 10,
			[
				['Apple'], 9,
				['Banana'], 24,
				['Blueberry'], 79,
				['Cherry'], 135,
				['Grape'], 233,
				['Kiwi'], 248,
				['Mango'], 146,
				['Orange'], 85,
				['Pineapple'], 32,
				['Strawberry'], 9
			]
		], [
			['fruit', 'country'], null,
			[
				['Apple', 'China'], 2,
				['Apple', 'England'], 2,
				['Apple', 'France'], 2,
				['Apple', 'Mexico'], 1,
				['Apple', 'United States'], 2,
			], [
				['Kiwi', 'Canada'], 30,
				['Kiwi', 'China'], 25,
				['Kiwi', 'England'], 25,
				['Kiwi', 'France'], 25,
				['Kiwi', 'Germany'], 29,
				['Kiwi', 'Japan'], 29,
				['Kiwi', 'Mexico'], 23,
				['Kiwi', 'South Korea'], 23,
				['Kiwi', 'Switzerland'], 17,
				['Kiwi', 'United States'], 22
			]
		]
	];

	QUnit.test('Group Test', function (assert) {
		var done = assert.async();
		MIE.WC_DataVis.Util.asyncEach(groupInfo, function (gi, i, next) {
			var fields = gi[0];
			var numGroups = gi[1];
			var result = gi[2];
			view.reset();
			view.setGroup({ fieldNames: MIE.WC_DataVis.Util.deepCopy(fields) }, {
				updateData: false
			});
			view.getData(function (ok, data) {
				var tag = JSON.stringify(fields);
				assert.deepEqual(data.groupFields, fields, tag + ': group fields');
				for (var i = 0; i < result.length; i += 2) {
					var rowVal = result[i];
					var len = result[i + 1];
					var tag2 = tag + ' - ' + JSON.stringify(rowVal);
					var rowValIndex = _.findIndex(data.rowVals, function (x) {
						return _.isEqual(x, rowVal);
					});
					assert.notEqual(rowValIndex, -1, tag2 + ': find row val index (' + rowValIndex + ')');
					assert.equal(data.data[rowValIndex].length, len, tag2 + ': group contains right number of rows');
				}
				return next();
			});
		}, done);
	});
};
