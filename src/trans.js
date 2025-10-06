import {sprintf} from 'sprintf-js';
import OrdMap from './util/ordmap.js';

import trans_enUs from './lang/en-US.js';
import trans_esMx from './lang/es-MX.js';
import trans_frFr from './lang/fr-FR.js';
import trans_idId from './lang/id-ID.js';
import trans_nlNl from './lang/nl-NL.js';
import trans_ptBr from './lang/pt-BR.js';
import trans_ruRu from './lang/ru-RU.js';
import trans_thTh from './lang/th-TH.js';
import trans_viVn from './lang/vi-VN.js';
import trans_zhHansCn from './lang/zh-Hans-CN.js';

var TRANSLATION_REGISTRY = new OrdMap();

TRANSLATION_REGISTRY.set('EN', trans_enUs);
TRANSLATION_REGISTRY.set('EN-US', trans_enUs);

TRANSLATION_REGISTRY.set('ES', trans_esMx);
TRANSLATION_REGISTRY.set('ES-MX', trans_esMx);

TRANSLATION_REGISTRY.set('FR', trans_frFr);
TRANSLATION_REGISTRY.set('FR-FR', trans_frFr);

TRANSLATION_REGISTRY.set('ID', trans_idId);
TRANSLATION_REGISTRY.set('ID-ID', trans_idId);

TRANSLATION_REGISTRY.set('NL', trans_nlNl);
TRANSLATION_REGISTRY.set('NL-NL', trans_nlNl);

TRANSLATION_REGISTRY.set('PT', trans_ptBr);
TRANSLATION_REGISTRY.set('PT-BR', trans_ptBr);

TRANSLATION_REGISTRY.set('RU', trans_ruRu);
TRANSLATION_REGISTRY.set('RU-RU', trans_ruRu);

TRANSLATION_REGISTRY.set('TH', trans_thTh);
TRANSLATION_REGISTRY.set('TH-TH', trans_thTh);

TRANSLATION_REGISTRY.set('VI', trans_viVn);
TRANSLATION_REGISTRY.set('VI-VN', trans_viVn);

TRANSLATION_REGISTRY.set('ZH', trans_zhHansCn);
TRANSLATION_REGISTRY.set('ZH-HANS', trans_zhHansCn);
TRANSLATION_REGISTRY.set('ZH-HANS-CN', trans_zhHansCn);

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
			if (TRANSLATION_REGISTRY.isSet(navigator.language.toUpperCase())) {
				lang = navigator.language;
			}
			else {
				lang = navigator.language.split('-')[0];
			}
		}

		if (!TRANSLATION_REGISTRY.isSet(lang.toUpperCase())) {
			if (!alreadyWarnedAboutLang[lang]) {
				console.error('Missing DataVis translation info for language "' + lang + '"');
				alreadyWarnedAboutLang[lang] = true;
			}
		}
		else if (TRANSLATION_REGISTRY.get(lang.toUpperCase())[k] == null) {
			console.error('Missing DataVis translation for key "' + k + '" in locale "' + lang + '"');
		}

		var s = (TRANSLATION_REGISTRY.get(lang.toUpperCase()) || {})[k]
			|| (TRANSLATION_REGISTRY.get('EN') || {})[k]
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
