var transTbl = {
	'en-US': {
		'SHOWHIDE': 'Show/Hide',
		'SHOWHIDEOPTS': 'Show/Hide Options'
	}
};

export var trans = function (k) {
	var lang = navigator.language
		, tbl = transTbl[lang] || transTbl['en-US'];

	return tbl[k] || k;
};
