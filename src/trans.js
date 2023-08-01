import {sprintf} from 'sprintf-js';
import OrdMap from './util/ordmap.js';

import trans_enUs from './lang/en-US.js';
import trans_esMx from './lang/es-MX.js';
import trans_ptBr from './lang/pt-BR.js';

var TRANSLATION_REGISTRY = new OrdMap();

TRANSLATION_REGISTRY.set('en', trans_enUs);
TRANSLATION_REGISTRY.set('en-US', trans_enUs);

TRANSLATION_REGISTRY.set('es', trans_esMx);
TRANSLATION_REGISTRY.set('es-MX', trans_esMx);

TRANSLATION_REGISTRY.set('pt', trans_ptBr);
TRANSLATION_REGISTRY.set('pt-BR', trans_ptBr);

var trans = (function () {
	var alreadyWarnedAboutLang = {};

	return function () {
		var args = Array.prototype.slice.call(arguments);
		var k = args.shift()
			, lang = window.DATAVIS_LANG;

		//if (lang == null && window.Intl && window.Intl.Locale) {
		//	lang = window.Intl.Locale().language;
		//}

		if (lang == null) {
			// Check for the region-specific language first.
			if (TRANSLATION_REGISTRY.isSet(navigator.language)) {
				lang = navigator.language;
			}
			else {
				lang = navigator.language.split('-')[0];
			}
		}

		if (!TRANSLATION_REGISTRY.isSet(lang)) {
			if (!alreadyWarnedAboutLang[lang]) {
				console.error('Missing DataVis translation info for language "' + lang + '"');
				alreadyWarnedAboutLang[lang] = true;
			}
		}
		else if (TRANSLATION_REGISTRY.get(lang)[k] == null) {
			console.error('Missing DataVis translation for key "' + k + '" in locale "' + lang + '"');
		}

		var s = (TRANSLATION_REGISTRY.get(lang) || {})[k]
			|| (TRANSLATION_REGISTRY.get('en') || {})[k]
			|| k;

		if (args.length > 0) {
			args.unshift(s);
			s = sprintf.apply(null, args);
		}

		if (lang === 'xx') {
			// x-ing a paragrab
			s = s.replace(/[A-Za-z]/g, 'x');
		}

		return s;
	};
})();

export {
	trans,
	TRANSLATION_REGISTRY,
}
