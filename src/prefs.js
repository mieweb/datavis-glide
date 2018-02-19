// Prefs {{{1

// Constructor {{{2

/**
 * Represents the single entry point to the preferences system.  Preferences consist of:
 *
 *   - One backend, which stores preference data for retrieval in another session.
 *   - Multiple perspectives, which represent different ways of looking at the same data.
 *
 * @class
 *
 * @param {string} id
 *
 * @param {object} moduleBindings
 * Maps module names to the target instances those modules control.
 *
 * @param {object} backendConfig
 *
 * @param {string} backendConfig.type
 * The type of the backend to use when saving prefs.  Must be a key in the `PREFS_BACKEND_REGISTRY`
 * object, which maps the type to a constructor.
 *
 *
 *
 * @property {string} id
 * Unique identifier for this Prefs instance; used as the primary key by the backend.
 *
 * @property {object} moduleBindings
 * How perspectives know how to load/save their configurations to/from real things.  Keys are module
 * names, values are targets that are bound to the module.  The actual load/save functionality is
 * contained within PrefsModule subclasses.
 *
 * @property {Object.<string,Perspective>} perspectives
 *
 * @property {PrefsBackend} backend
 *
 * @property {string[]} availablePerspectives
 * List of all the perspective names that we know about.
 *
 * @property {boolean} initialized
 * If true, this Prefs instance has already been initialized.
 */

var Prefs = makeSubclass(Object, function (id, moduleBindings, backendConfig) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (moduleBindings != null && typeof moduleBindings !== 'object') {
		throw new Error('Call Error: `moduleBindings` must be null or an object');
	}
	if (backendConfig != null && typeof backendConfig !== 'object') {
		throw new Error('Call Error: `backendConfig` must be null or an object');
	}

	self.id = id;
	self.modules = {};

	backendConfig = deepDefaults(backendConfig, {
		type: 'localStorage',
		localStorage: {
			key: 'WCDATAVIS_PREFS'
		}
	});

	// Create the backend for saving preferences.

	if (PREFS_BACKEND_REGISTRY[backendConfig.type] == null) {
		throw new Error('PREFS BACKEND IS NOT REGISTERED'); // XXX
	}

	var backendCtor = PREFS_BACKEND_REGISTRY[backendConfig.type];
	var backendCtorOpts = backendConfig[backendConfig.type];

	self.debug('Creating new preferences backend: id = "%s" ; type = %s ; opts = %O',
		self.id, backendConfig.type, backendCtorOpts);

	// If creating the backend fails for any reason (e.g. unable to access localStorage) then fall
	// back to a "temporary" prefs backend that doesn't actually save or load anything.

	//try {
		self.backend = new backendCtor(self.id, backendCtorOpts);
	//}
	//catch (e) {
	//	self.bakend = new PrefsBackendTemporary();
	//}

	if (moduleBindings != null) {
		_.each(moduleBindings, function (target, moduleName) {
			self.bind(moduleName, target);
		});
	}
});

mixinEventHandling(Prefs, function (self) {
	return 'PREFS (' + self.id + ')';
}, [
	  'perspectiveAdded'   // Fired when a perspective is added.
	, 'perspectiveDeleted' // Fired when a perspective is deleted.
	, 'perspectiveRenamed' // Fired when a perspective is renamed.
	, 'perspectiveChanged' // Fired when the current perspective has changed.
	, 'prefsHistoryStatus'
]);
mixinDebugging(Prefs, function () {
	return 'PREFS (' + this.id + ')';
});
delegate(Prefs, 'backend', ['getPerspectives', 'getCurrent']);

// #init {{{2

/**
 * Initialize the prefs by loading the "current" perspective from the backend.
 *
 * @param {function} [cont]
 */

Prefs.prototype.init = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	if (self.initialized) {
		// Already done, don't need to do it again.
		return typeof cont === 'function' ? cont(false) : false;
	}

	self.initialized = true;
	self.history = [];
	self.historyIndex = 0;

	return self.backend.getPerspectives(function (names) {
		self.availablePerspectives = names;
		self.perspectives = {};

		return self.backend.getCurrent(function (currentName) {
			if (currentName == null) {
				currentName = 'Main';
			}

			return self.backend.load(currentName, function (currentConfig) {
				if (currentConfig == null) {
					currentConfig = {};
				}

				return self.addPerspective(currentName, currentConfig, null, cont);
			});
		});
	});
};

// #_firePrefsHistoryStatus {{{2

Prefs.prototype._firePrefsHistoryStatus = function () {
	var self = this;

	self.fire('prefsHistoryStatus', null, self.historyIndex < self.history.length - 1, self.historyIndex > 0);
};

// #back {{{2

Prefs.prototype.back = function () {
	var self = this;

	if (self.historyIndex === self.history.length - 1) {
		// Already at beginning of history, can't go back anymore.
		return;
	}

	self.historyIndex += 1;
	self._historyDebug();
	self._firePrefsHistoryStatus();
	self.setCurrentPerspective(self.history[self.historyIndex].getName(), null, {
		resetHistory: false
	});
};

// #forward {{{2

Prefs.prototype.forward = function () {
	var self = this;

	if (self.historyIndex === 0) {
		// Already at end of history, can't go back anymore.
		return;
	}

	self.historyIndex -= 1;
	self._historyDebug();
	self._firePrefsHistoryStatus();
	self.setCurrentPerspective(self.history[self.historyIndex].getName(), null, {
		resetHistory: false
	});
};

// #_resetHistory {{{2

Prefs.prototype._resetHistory = function (p) {
	var self = this;

	// Example: self._resetHistory(x)
	//
	// BEFORE ----------------------------
	//   [ A B C D E ]
	//         ^ (history index)
	//
	// AFTER -----------------------------
	//   [ X C D E ]
	//     ^ (history index)

	self.history.splice(0, self.historyIndex);
	if (p != null) {
		self.history.unshift(p);
	}
	self.historyIndex = 0;
	self._historyDebug();
	self._firePrefsHistoryStatus();
};

// #_historyDebug {{{2

Prefs.prototype._historyDebug = function () {
	var self = this;

	console.log('### HISTORY ### [%d] %O', self.historyIndex, self.history.map((x) => x.getName()));
};

// #bind {{{2

Prefs.prototype.bind = function (moduleName, target) {
	var self = this;

	if (typeof moduleName !== 'string') {
		throw new Error('Call Error: `moduleName` must be a string');
	}
	if (target == null) {
		throw new Error('Call Error: `target` is required');
	}

	// Make sure that the module is registered with a class, otherwise we obviously have no idea what
	// to do with it.

	if (PREFS_MODULE_REGISTRY[moduleName] == null) {
		throw new Error('Module is not registered: ' + moduleName);
	}

	self.modules[moduleName] = new PREFS_MODULE_REGISTRY[moduleName](target);
};

// #addPerspective {{{2

/**
 * Add a new perspective.
 *
 * @param {string} name
 *
 * @param {object} [config]
 * If missing, the configuration of the current perspective is used.
 *
 * @param {function} [cont]
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.switch=true]
 * If true, automatically switch to the new perspective after creating it.
 *
 * @param {boolean} [opts.sendEvent=true]
 *
 * @param {boolean} [opts.dontSendEventTo]
 */

Prefs.prototype.addPerspective = function (name, config, perspectiveOpts, cont, opts) {
	var self = this;
	var needToLoad = true; // Will need to load perspective after we add it.

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (config != null && typeof config !== 'object') {
		throw new Error('Call Error: `config` must be null or an object');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}
	if (opts != null && typeof opts !== 'object') {
		throw new Error('Call Error: `opts` must be null or an object');
	}

	opts = deepDefaults(opts, {
		switch: true,
		sendEvent: true
	});

	if (self.currentPerspective) {
		self.save(); // Save the current perspective first.
		if (config == null) {
			config = deepCopy(self.currentPerspective.getConfig());
			needToLoad = false; // Don't need to load, because this is the current config.
		}
	}

	self.debug('Adding new perspective: name = "%s" ; config = %O', name, config);
	self.perspectives[name] = new Perspective(name, config, self.modules, perspectiveOpts);

	// TODO Should we save right away?

	if (opts.sendEvent) {
		self.fire('perspectiveAdded', {
			notTo: opts.dontSendEventTo
		}, name);
	}

	if (opts.switch) {
		return self.setCurrentPerspective(name, cont, {
			loadPerspective: needToLoad
		});
	}

	return typeof cont === 'function' ? cont(true) : true;
};

// #deletePerspective {{{2

/**
 * Delete a perspective.  The "Main" perspective cannot be deleted.
 *
 * @param {string} [name]
 * The name of the perspective to delete.  If missing, the current perspective is deleted, if it's
 * not the "Main" perspective.
 *
 * @param {function} [cont]
 * Continuation callback.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 */

Prefs.prototype.deletePerspective = function (name, cont, opts) {
	var self = this;

	opts = deepDefaults(opts, {
		sendEvent: true
	});

	// When the name wasn't provided, use the current perspective.

	if (name == null) {
		name = self.currentPerspective.getName();
	}

	// Make sure that we're not trying to delete "Main."

	if (name == 'Main') {
		log.error('Not allowed to delete "Main" perspective');
		return typeof cont === 'function' ? cont(false) : false;
	}

	// Delete the perspective in the backend.

	self.backend.delete(name, function (ok) {
		var newCurrent;
		var i;

		if (!ok) {
			return typeof cont === 'function' ? cont(false) : false;
		}

		delete self.perspectives[name];

		if (opts.sendEvent) {
			self.fire('perspectiveDeleted', {
				notTo: opts.dontSendEventTo
			}, name, newCurrent);
		}

		if (self.currentPerspective.getName() === name) {
			// Go back in history until we've found a different perspective.

			while (self.historyIndex < self.history.length && self.history[self.historyIndex].getName() === name) {
				self.historyIndex += 1;
			};

			// Reset history until that point, erasing everything after it.

			self._resetHistory();

			if (self.history.length > 0) {

				// We've stripped the future and all matching perspectives from history, so use the first
				// element of the new history stack as the current perspective.  Don't reset history because
				// we've already done that manually above.
				//
				// BEFORE -------------------------
				//   [ A B B B C D ]
				//       ^ (history index)
				//
				// AFTER --------------------------
				//   [ C D ]
				//     ^ (history index)

				self.setCurrentPerspective(self.history[0].getName(), null, {
					resetHistory: false
				});
			}
			else {

				// We've removed all items from history, so put "Main" back on the stack.  In this example,
				// even though there are different things in the future, everything in the past is the same
				// as what we're deleting, so you end up with empty history.
				//
				// BEFORE -------------------------
				//   [ A B B B ]
				//       ^ (history index)
				//
				// AFTER --------------------------
				//   [ Main ]
				//     ^ (history index)

				self.setCurrentPerspective('Main');
			}

			//var currentIndex;
			//var historyOffset = 0;
			//for (i = 0; i < self.history.length; i += 1) {
			//	if (self.history[i].getName() === name) {
			//		if (i < self.historyIndex) {
			//			historyOffset += 1;
			//		}
			//	}
			//	else {
			//		// Update the old current index if:
			//		//   #1. There is no old one.
			//		//   #2. The new index is closer than the old one.
			//		//   #3. The new index is "back" and the old is "forward."
			//		if (currentIndex == null
			//				|| (self.historyIndex - i < self.historyIndex - currentIndex)
			//				|| (currentIndex < self.historyIndex && i >= self.historyIndex)) {
			//			currentIndex = i;
			//		}
			//	}
			//}
			//newCurrent = self.history[currentIndex].getName();
			//self.history = _.reject(self.history, function (p) {
			//	return p.getName() === name;
			//});
			//self.historyIndex -= historyOffset;
			//self._historyDebug();
			//self.setCurrentPerspective(newCurrent, null, {
			//	resetHistory: false
			//});
		}
	});
};

// #renamePerspective {{{2

/**
 * @param {string} [oldName]
 * When null or undefined, uses the current perspective.
 *
 * @param {string} newName
 *
 * @param {function} [cont]
 *
 * @param {object} [opts]
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 */

Prefs.prototype.renamePerspective = function (oldName, newName, cont, opts) {
	var self = this;

	opts = deepDefaults(opts, {
		sendEvent: true
	});

	if (oldName != null && typeof oldName !== 'string') {
		throw new Error('Call Error: `oldName` must be null or a string');
	}
	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	// When the `oldName` is missing, use the current perspective's name.

	if (oldName == null) {
		oldName = self.currentPerspective.getName();
	}

	// Make sure a perspective with the old name exists.

	if (self.perspectives[oldName] == null) {
		throw new Error('Perspective does not exist: ' + oldName);
	}

	// Make sure a perspective with the new name doesn't already exist.

	if (self.perspectives[newName] != null) {
		throw new Error('Perspective already exists: ' + newName);
	}

	// Rename the perspective in the backend.

	self.backend.rename(oldName, newName, function (ok) {
		if (!ok) {
			// Error renaming the perspective in the backend.
			return typeof cont === 'function' ? cont(false) : false;
		}

		// Change the name in the perspective itself.
		self.perspectives[oldName].setName(newName);

		// Rename the perspective in our lookup table.
		self.perspectives[newName] = self.perspectives[oldName];
		delete self.perspectives[oldName];

		if (opts.sendEvent) {
			self.fire('perspectiveRenamed', {
				notTo: opts.dontSendEventTo
			}, oldName, newName);
		}

		return typeof cont === 'function' ? cont(true) : true;
	});
};

// #setCurrentPerspective {{{2

/**
 * Switch to a different perspective.
 *
 * @param {string} name
 * Name of the perspective to switch to.
 *
 * @param {function} [cont]
 * Continuation callback.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.loadPerspective=true]
 * If true, automatically load the perspective after we've switched to it.
 *
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 */

Prefs.prototype.setCurrentPerspective = function (name, cont, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	opts = deepDefaults(opts, {
		loadPerspective: true,
		sendEvent: true,
		resetHistory: true
	});

	if (self.perspectives[name] == null) {
		if (self.availablePerspectives.indexOf(name) < 0) {
			throw new Error('Perspective does not exist: ' + name);
		}

		// Try to load the perspective config from the backend, and create a new Perspective from it.
		// Adding in this way will cause it to be switched to immediately, so there's no need for us to
		// do it again here.

		return self.backend.load(name, function (config) {
			return self.addPerspective(name, config);
		});
	}

	self.debug('Switching to perspective: name = "%s"', name);

	self.currentPerspective = self.perspectives[name];

	if (opts.resetHistory) {
		self._resetHistory(self.currentPerspective);
	}

	if (opts.loadPerspective) {
		return self.currentPerspective.load(function () {
			if (opts.sendEvent) {
				self.fire('perspectiveChanged', {
					notTo: opts.dontSendEventTo
				}, name);
			}

			return typeof cont === 'function' ? cont(true) : true;
		});
	}

	if (opts.sendEvent) {
		self.fire('perspectiveChanged', {
			notTo: opts.dontSendEventTo
		}, name);
	}

	return typeof cont === 'function' ? cont(true) : true;
};

// #getCurrentPerspective {{{2

Prefs.prototype.getCurrentPerspective = function () {
	var self = this;

	return self.currentPerspective.getName();
};

// #save {{{2

/**
 * Saves the current perspective using the backend.
 */

Prefs.prototype.save = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	if (self.currentPerspective.isTemporary()) {
		return typeof cont === 'function' ? cont(false) : false;
	}

	self.currentPerspective.save(function (config) {
		self.backend.save(self.currentPerspective.getName(), config, cont);
	});
};

// #reset {{{2

Prefs.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	self.backend.reset(function () {
		self.initialized = false;
		self.init(function () {
			_.each(self.modules, function (module, moduleName) {
				if (typeof module.reset === 'function') {
					self.debug('Resetting module: moduleName = %s', moduleName);
					module.reset();
				}
			});
			return typeof cont === 'function' ? cont(true) : true;
		});
	});
};

// PrefsBackend {{{1

// Constructor {{{2

/**
 * Base class for all preference backends.  Almost all methods of this class are abstract, so you
 * will need to instantiate a subclass like PrefsBackendLocalStorage.
 *
 * Generally speaking, methods that gets data is asynchronous and therefore require a callback;
 * methods that set data support callbacks but don't require them.  In that case, omitting the
 * callback means you don't want to know if the operation succeeded or not.
 *
 * @class
 *
 * @param {string} id
 * @param {object} [opts]
 */

var PrefsBackend = makeSubclass(Object, function (id, opts) {
	var self = this;

	self.id = id;
	self.opts = opts;
});

// #load {{{2

/**
 * Loads the configuration for the specified perspective.
 *
 * @param {string} name
 * @param {function} cont
 */

PrefsBackend.prototype.load = function (name, cont) {
	throw new Error('ABSTRACT');
};

// #save {{{2

/**
 * Saves the configuration for the specified perspective.
 *
 * @param {string} name
 * @param {object} config
 * @param {function} [cont]
 */

PrefsBackend.prototype.save = function (name, config, cont) {
	throw new Error('ABSTRACT');
};

// #getPerspectives {{{2

/**
 * Get the names of all the available perspectives.
 *
 * @param {function} cont
 */

PrefsBackend.prototype.getPerspectives = function (cont) {
	throw new Error('ABSTRACT');
};

// #getCurrent {{{2

/**
 * Get the name of the current perspective.
 *
 * @param {function} cont
 */

PrefsBackend.prototype.getCurrent = function (cont) {
	throw new Error('ABSTRACT');
};

// #setCurrent {{{2

/**
 * Set the name of the current perspective.
 *
 * @param {string} name
 * @param {function} [cont]
 */

PrefsBackend.prototype.setCurrent = function (name, cont) {
	throw new Error('ABSTRACT');
};

// #rename {{{2

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {function} [cont]
 */

PrefsBackend.prototype.rename = function (oldName, newName, cont) {
	throw new Error('ABSTRACT');
};

// #delete {{{2

/**
 * @param {string} name
 * @param {function} [cont]
 */

PrefsBackend.prototype.delete = function (name, cont) {
	throw new Error('ABSTRACT');
};

// #reset {{{2

/**
 * @param {function} [cont]
 */

PrefsBackend.prototype.reset = function (cont) {
	throw new Error('ABSTRACT');
};

// PrefsBackendLocalStorage {{{1

// Constructor {{{2

/**
 * @class
 * @extends PrefsBackend
 *
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.key="WCDATAVIS_PREFS"]
 */

var PrefsBackendLocalStorage = makeSubclass(PrefsBackend, function () {
	var self = this;

	try {
		var storage = window.localStorage;
	}
	catch (e) {
		log.error('Access to localStorage is denied; prefs disabled');
		throw e;
	}

	self.super.ctor.apply(self, arguments);

	self.localStorageKey = self.opts.key || 'WCDATAVIS_PREFS';
});

mixinDebugging(PrefsBackendLocalStorage, function () {
	return 'PREFS (' + this.id + ') // BACKEND - LOCAL';
});

// #load {{{2

PrefsBackendLocalStorage.prototype.load = function (name, cont) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var config = getPropDef({}, storedPrefData, self.id, 'perspectives', name);

	self.debug('Loaded preferences: name = "%s" ; config = %O', name, config);
	
	return cont(config);
};

// #save {{{2

PrefsBackendLocalStorage.prototype.save = function (name, config, cont) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (typeof config !== 'object') {
		throw new Error('Call Error: `config` must be an object');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	self.debug('Saving preferences: name = "%s" ; config = %O', name, config);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(config, storedPrefData, self.id, 'perspectives', name);
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	if (typeof cont === 'function') {
		return cont(true);
	}
};

// #getPerspectives {{{2

PrefsBackendLocalStorage.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var perspectives = _.keys(getPropDef({}, storedPrefData, self.id, 'perspectives'));

	if (perspectives.length === 0) {
		perspectives = ['Main'];
	}

	self.debug('Found %d perspectives: %s', perspectives.length, JSON.stringify(perspectives));

	return cont(perspectives);
};

// #getCurrent {{{2

PrefsBackendLocalStorage.prototype.getCurrent = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var current = getPropDef('Main', storedPrefData, self.id, 'current')

	self.debug('Current perspective is "%s"', current);

	return cont(current);
};

// #setCurrent {{{2

PrefsBackendLocalStorage.prototype.setCurrent = function (name, cont) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	self.debug('Setting current perspective to "%s"', name);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(self.perspective, storedPrefData, self.id, 'current');
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return typeof cont === 'function' ? cont(true) : true;
};

// #rename {{{2

PrefsBackendLocalStorage.prototype.rename = function (oldName, newName, cont) {
	var self = this;

	if (typeof oldName !== 'string') {
		throw new Error('Call Error: `oldName` must be a string');
	}
	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	if (oldName === 'Main') {
		log.error('Not allowed to rename "Main" perspective');
		return typeof cont === 'function' ? cont(false) : false;
	}

	self.debug('Renaming perspective: "%s" -> "%s"', oldName, newName);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	storedPrefData[self.id]['perspectives'][newName] = storedPrefData[self.id]['perspectives'][oldName];
	delete storedPrefData[self.id]['perspectives'][oldName];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return typeof cont === 'function' ? cont(true) : true;
};

// #delete {{{2

PrefsBackendLocalStorage.prototype.delete = function (name, cont) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	if (name === 'Main') {
		log.error('Not allowed to delete "Main" perspective');
		return typeof cont === 'function' ? cont(false) : false;
	}

	self.debug('Deleting perspective: "%s"', name);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.id]['perspectives'][name];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return typeof cont === 'function' ? cont(true) : true;
};

// #reset {{{2

PrefsBackendLocalStorage.prototype.reset = function (cont) {
	var self = this;

	self.debug('Resetting perspectives');

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.id];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return typeof cont === 'function' ? cont(true) : true;
};

// PrefsBackendTemporary {{{1

// Constructor {{{2

/**
 * @class
 * @extends PrefsBackend
 *
 * @param {string} id
 * @param {object} [opts]
 */

var PrefsBackendTemporary = makeSubclass(PrefsBackend, function () {
	var self = this;

	self.storage = {};
	self.current = 'Main';

	self.super.ctor.apply(self, arguments);
});

// #save {{{2

PrefsBackendTemporary.prototype.save = function (opts, cont) {
	var self = this
		, prefs = self.getPrefsFromView();

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Saving preferences: %O', prefs);

	setProp(prefs, self.storage, self.view.name, self.perspective);

	if (typeof cont === 'function') {
		return cont(true);
	}
};

// #load {{{2

PrefsBackendTemporary.prototype.load = function (cont) {
	var self = this;

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Loading preferences...');

	var prefs = getPropDef({}, self.storage, self.view.name, self.perspective);

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Loaded preferences: %O', prefs);

	self.apply(prefs, cont);
};

// #getPerspectives {{{2

PrefsBackendTemporary.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspectives = _.keys(getPropDef({}, self.storage, self.view.name));

	if (perspectives.length === 0) {
		perspectives = ['Main'];
	}

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Found %d perspectives', perspectives.length);

	return cont(perspectives);
};

// #getInitialPerspective {{{2

PrefsBackendTemporary.prototype.getInitialPerspective = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var initial = self.current || 'Main';

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Initial perspective is "%s"', initial);

	if (self.initialPerspective === undefined) {
		self.initialPerspective = initial;
	}

	return cont(initial);
};

// #setCurrentPerspective {{{2

PrefsBackendTemporary.prototype.setCurrentPerspective = function (perspective) {
	var self = this;

	if (typeof perspective !== 'string') {
		throw new Error('Call Error: `perspective` must be a string');
	}

	self.super.setCurrentPerspective(perspective);

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Setting current perspective to "%s"', self.perspective);

	self.current = perspective;
};

// #rename {{{2

PrefsBackendTemporary.prototype.rename = function () {
	var self = this
		, args = Array.prototype.slice.call(arguments)
		, oldName
		, newName;

	if (args.length === 1) {
		oldName = self.getCurrentPerspective();
		newName = args[0];
	}
	else if (args.length === 2) {
		oldName = args[0];
		newName = args[1];
	}
	else {
		throw new Error('Usage: PrefsBackendTemporary#rename([oldName], newName)');
	}

	if (typeof oldName !== 'string') {
		throw new Error('Call Error: `oldName` must be a string');
	}

	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}

	if (oldName === 'Main') {
		log.error('Not allowed to rename perspective "Main" for view "%s"', self.view.name);
		return false;
	}

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Renaming perspective "%s" to "%s"', oldName, newName);

	self.storage[self.view.name][newName] = self.storage[self.view.name][oldName];
	delete self.storage[self.view.name][oldName];

	if (self.getCurrentPerspective() === oldName) {
		self.setCurrentPerspective(newName);
	}

	return true;
};

// #delete {{{2

PrefsBackendTemporary.prototype.delete = function (perspective) {
	var self = this;

	if (perspective === undefined) {
		perspective = self.getCurrentPerspective();
	}

	if (typeof perspective !== 'string') {
		throw new Error('Call Error: `perspective` must be a string');
	}

	if (perspective === 'Main') {
		log.error('Not allowed to delete perspective "Main" for view "%s"', self.view.name);
		return;
	}

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Deleting perspective "%s"', perspective);

	delete self.storage[self.view.name][perspective];

	// When we've deleted the current perspective, we have to fall back to some other perspective.
	// We'd prefer to use the one that we started with, but if that's not available we use Main.

	if (self.getCurrentPerspective() === perspective) {
		if (self.initialPerspective && self.initialPerspective !== perspective) {
			self.setCurrentPerspective(self.initialPerspective);
		}
		else {
			self.setCurrentPerspective('Main');
		}
		self.load();
	}
};

// #reset {{{2

PrefsBackendTemporary.prototype.reset = function () {
	var self = this;

	debug.info('PREFS // TEMPORARY - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Resetting perspectives');

	delete self.storage[self.view.name];

	self.setCurrentPerspective('Main');
	self.super.reset();
};
// PrefsModule {{{1

/**
 * @class
 */

var PrefsModule = makeSubclass(Object, function (target) {
	var self = this;

	self.target = target;
});

// #load {{{2

/**
 * Applies the provided configuration to the target.
 */

PrefsModule.prototype.load = function (config) {
};

// #save {{{2

/**
 * Pulls configuration from the target and returns it as an object that can be stored by the
 * preferences backend.
 */

PrefsModule.prototype.save = function () {
};

// PrefsModuleView {{{1

/**
 * @class
 */

var PrefsModuleView = makeSubclass(PrefsModule);

// #load {{{2

PrefsModuleView.prototype.load = function (config) {
	var self = this;

	if (config == null) {
		return;
	}

	if (config.sort == null) {
		self.target.clearSort(true);
	}
	else {
		self.target.setSort(config.sort, null, true);
	}

	if (config.filter == null) {
		self.target.clearFilter({
			updateData: false
		});
	}
	else {
		self.target.setFilter(config.filter, null, {
			updateData: false
		});
	}

	if (config.group == null) {
		self.target.clearGroup({
			updateData: false
		});
	}
	else {
		self.target.setGroup(config.group, {
			updateData: false
		});
	}

	if (config.pivot == null) {
		self.target.clearPivot({
			updateData: false
		});
	}
	else {
		self.target.setPivot(config.pivot, {
			updateData: false
		});
	}

	if (config.aggregate == null) {
		self.target.clearAggregate();
	}
	else {
		self.target.setAggregate(config.aggregate);
	}
};

// #save {{{2

PrefsModuleView.prototype.save = function () {
	var self = this;

	var prefs = {};

	var sortSpec = self.target.getSort();
	if (sortSpec) {
		prefs.sort = sortSpec;
	}

	var filterSpec = self.target.getFilter();
	if (filterSpec) {
		prefs.filter = filterSpec;
	}

	var groupSpec = self.target.getGroup();
	if (groupSpec) {
		prefs.group = groupSpec;
	}

	var pivotSpec = self.target.getPivot();
	if (pivotSpec) {
		prefs.pivot = pivotSpec;
	}

	var aggregateSpec = self.target.getAggregate();
	if (aggregateSpec) {
		prefs.aggregate = aggregateSpec;
	}

	return prefs;
};

// #reset {{{2

PrefsModuleView.prototype.reset = function () {
	var self = this;

	self.target.reset();
};

// PrefsModuleGrid {{{1

/**
 * @class
 */

var PrefsModuleGrid = makeSubclass(PrefsModule);

// #load {{{2

PrefsModuleGrid.prototype.load = function (config) {
	var self = this;
};

// #save {{{2

PrefsModuleGrid.prototype.save = function () {
	var self = this;

	var prefs = {};

	return prefs;
};

// #reset {{{2

PrefsModuleGrid.prototype.reset = function () {
	var self = this;
};

// Perspective {{{1

// Constructor {{{2

/**
 * @class
 *
 * @property {string} name
 * @property {object} config
 * @property {Object.<string,PrefsModule>} modules
 */

var Perspective = makeSubclass(Object, function (name, config, modules, opts) {
	var self = this;

	self.name = name;
	self.config = config;
	self.modules = modules;
	self.opts = deepDefaults(opts, {
		isTemporary: false
	});
});

mixinDebugging(Perspective, function () {
	return 'PREFS // PERSPECTIVE (' + this.name + ')';
});

// #getName {{{2

Perspective.prototype.getName = function () {
	var self = this;

	return self.name;
};

// #setName {{{2

Perspective.prototype.setName = function (name) {
	var self = this;

	self.name = name;
};

// #getConfig {{{2

Perspective.prototype.getConfig = function () {
	var self = this;

	return self.config;
};

// #load {{{2

/**
 * Push the configuration of this perspective to all bound modules.
 *
 * @param {function} [cont]
 */

Perspective.prototype.load = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	self.debug('Loading perspective');

	// Go through every module that we have preferences for and load them into the bound components.

	_.each(self.modules, function (module, moduleName) {
		self.debug('Loading module: moduleName = %s ; config = %O', moduleName, self.config[moduleName]);
		module.load(self.config[moduleName]);
	});

	return typeof cont === 'function' ? cont(true) : true;
};

// #save {{{2

/**
 * Receive configuration from all bound modules and update this perspective's configuration.
 *
 * @param {function} [cont]
 */

Perspective.prototype.save = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	self.debug('Saving perspective');

	// Go through every module that we have preferences for and save them from the bound components.

	_.each(self.modules, function (module, moduleName) {
		self.config[moduleName] = module.save();
		self.debug('Saving module: moduleName = %s ; config = %O', moduleName, self.config[moduleName]);
	});

	return typeof cont === 'function' ? cont(self.config) : self.config;
};

// #isTemporary {{{2

Perspective.prototype.isTemporary = function () {
	var self = this;

	return self.opts.isTemporary;
};

// #makePermanent {{{2

Perspective.prototype.makePermanent = function () {
	var self = this;

	self.opts.isTemporary = false;
};

// Registries {{{1

var PREFS_BACKEND_REGISTRY = {
	localStorage: PrefsBackendLocalStorage,
	temporary: PrefsBackendTemporary
};

var PREFS_MODULE_REGISTRY = {
	view: PrefsModuleView,
	grid: PrefsModuleGrid
};
