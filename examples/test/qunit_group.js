window.test_group = function (view) {
	var groupInfo = [
		[['country'], 10, [
			['Canada'], 100, ['China'], 100, ['England'], 100, ['France'], 100, ['Germany'], 100, ['Japan'], 100, ['Mexico'], 100, ['South Korea'], 100, ['Switzerland'], 100, ['United States'], 100
		]]
	];

	QUnit.test('Group Test', function (assert) {
		var done = assert.async();
		MIE.Util.asyncEach(groupInfo, function (gi, next) {
			var fields = gi[0];
			var numGroups = gi[1];
			var result = gi[2];
			view.reset();
			view.setGroup({ fieldNames: fields }, {
				updateData: false
			});
			view.getData(function (data) {
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
