{
	data: [
		'{{repeat(500)}}',
		{
			first_name: '{{firstName()}}',
			last_name: '{{surname()}}',
			state: '{{state()}}',
			sex: '{{gender()}}',
			random_date: '{{date(null, null, "YYYY-MM-dd")}}',
			random_int: '{{integer(0, 100)}}',
			random_float: '{{floating(0, 100, 3)}}',
			random_money: '{{floating(0, 10000, null, "\'$0,0.0\'")}}',
			date_link: function (tags) {
				var d = new Date(tags.date());
				var m = ['January', 'February', 'March', 'April', 'May', 'June',
					'July', 'August', 'September', 'October', 'November', 'December'];
				var m2 = d.getMonth() + 1;
				var d2 = d.getDate();
				return '[url=https://en.wikipedia.org/wiki/' + m[d.getMonth()] + '_' + d.getDate() + ']' + (d2 < 10 ? '0' + d2 : d2) + '.' + (m2 < 10 ? '0' + m2 : m2) + '.' + (d.getYear() + 1900) + '[/url]';
			}
		}
	],
	typeInfo: [
		{
			field: 'first_name',
			type: 'string'
		}, {
			field: 'last_name',
			type: 'string'
		}, {
			field: 'state',
			type: 'string'
		}, {
			field: 'sex',
			type: 'string'
		}, {
			field: 'random_date',
			type: 'date'
		}, {
			field: 'random_int',
			type: 'number'
		}, {
			field: 'random_float',
			type: 'number'
		}, {
			field: 'random_money',
			type: 'currency'
		}, {
			field: 'date_link',
			type: 'date',
			format: 'DD.MM.YYYY'
		}
	]
}
