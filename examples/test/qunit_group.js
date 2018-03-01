window.test_group = function (view) {
	var groupInfo = [
		[['country'], 10, [
			['Canada'], 50, ['China'], 50, ['England'], 50, ['France'], 50, ['Germany'], 50, ['Japan'], 50, ['Mexico'], 50, ['South Korea'], 50, ['Switzerland'], 50, ['United States'], 50
		]]
	];

	QUnit.test('Group Test', function (assert) {
		var done = assert.async();
		(function (args, fun, done) {
			function g() {
				if (args.length === 0) {
					return done();
				}
				fun(args.shift(), g);
			};
			g();
		})(groupInfo, function (gi, next) {
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
