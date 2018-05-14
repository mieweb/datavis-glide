// Prefs {{{1

// Constructor {{{2

/**
 * Creates a new Prefs instance.
 *
 * @param {string} id
 *
 * @param {object} moduleBindings
 * Maps module names to the target instances those modules control.
 *
 * @param {object} [opts]
 *
 * @param {object} [opts.backend]
 *
 * @param {string} [opts.backend.type="localStorage"]
 * The type of the backend to use when saving prefs.  Must be a key in the `PREFS_BACKEND_REGISTRY`
 * object, which maps the type to a constructor.
 *
 * @class
 *
 * Represents the single entry point to the preferences system.  Preferences consist of:
 *
 *   - One backend, which stores preference data for retrieval in another session.
 *   - Multiple perspectives, which represent different ways of looking at the same data.
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
 * @property {boolean} isInitialized
 * If true, this Prefs instance has already been initialized.
 *
 * @property {boolean} isPrimed
 * If true, this Prefs instance has already been primed.
 */

var Prefs = makeSubclass(Object, function (id, moduleBindings, opts) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (moduleBindings != null && typeof moduleBindings !== 'object') {
		throw new Error('Call Error: `moduleBindings` must be null or an object');
	}
	if (opts != null && typeof opts !== 'object') {
		throw new Error('Call Error: `opts` must be null or an object');
	}

	self.id = id;
	self.modules = {};

	opts = deepDefaults(opts, {
		saveCurrent: true,
		savePerspectives: true,
		backend: {
			type: 'localStorage'
		}
	});

	self.init();

	// Create the backend for saving preferences.

	if (PREFS_BACKEND_REGISTRY[opts.backend.type] == null) {
		throw new Error('PREFS BACKEND IS NOT REGISTERED'); // XXX
	}

	var backendCtor = PREFS_BACKEND_REGISTRY[opts.backend.type];
	var backendCtorOpts = opts.backend[opts.backend.type];

	self.debug('Creating new preferences backend: id = "%s" ; type = %s ; opts = %O',
		self.id, opts.backend.type, backendCtorOpts);

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
//delegate(Prefs, 'backend', ['getPerspectives', 'getCurrent']);

// #init {{{2

/**
 * Initialize the prefs by loading the "current" perspective from the backend.
 */

Prefs.prototype.init = function () {
	var self = this;

	if (self.isInitialized) {
		return;
	}

	self.isInitialized = true;
	self.perspectives = {};
	self.availablePerspectives = [];
	self.history = [];
	self.historyIndex = 0;
};

// #prime {{{2

Prefs.prototype.prime = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	if (self.isPrimed) {
		return typeof cont === 'function' ? cont(false) : false;
	}

	self.init();

	self.debug('PRIMING!');

	return self.backend.getPerspectives(function (names) {
		self.availablePerspectives = names;

		// When there's already a current perspective (as would be the case when prefs have been
		// pre-configured), we don't have to do anything else.

		if (self.currentPerspective != null) {
			self.isPrimed = true;
			return typeof cont === 'function' ? cont(true) : true;
		}

		// Otherwise, we need to figure out what the last current perspective was and load it.

		return self.backend.getCurrent(function (currentName) {
			if (currentName == null || self.availablePerspectives.indexOf(currentName) < 0) {
				currentName = 'Main';
			}

			return self.backend.load(currentName, function (currentConfig) {
				if (currentConfig == null) {
					currentConfig = {};
				}

				return self.addPerspective(currentName, currentConfig, null, function () {
					self.isPrimed = true;
					return typeof cont === 'function' ? cont(true) : true;
				});
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
	//self._historyDebug();
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
	//self._historyDebug();
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
	//self._historyDebug();
	self._firePrefsHistoryStatus();
};

// #_historyDebug {{{2

Prefs.prototype._historyDebug = function () {
	var self = this;

	console.log('### HISTORY ### [%d] %O', self.historyIndex, self.history.map(function (x) { return x.getName(); }));
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

	// When we're adding a binding with a perspective already loaded, reload it for the new binding.

	if (self.currentPerspective != null) {
		self.currentPerspective.load([moduleName]);
	}
};

// #getPerspectives {{{2

Prefs.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	return cont(self.availablePerspectives);
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
 * @param {object} [perspectiveOpts]
 * Additional options to pass to Perspective().
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
		sendEvent: true,
		onDuplicate: 'nothing'
	});

	if (['error', 'nothing', 'replace'].indexOf(opts.onDuplicate) < 0) {
		throw new Error('Call Error: `opts.onDuplicate` must be one of: error, nothing, replace');
	}

	var maybeSwitch = function () {
		if (opts.switch) {
			return self.setCurrentPerspective(name, cont, {
				loadPerspective: needToLoad
			});
		}

		return typeof cont === 'function' ? cont(true) : true;
	};

	if (self.perspectives[name] != null) {
		switch (opts.onDuplicate) {
		case 'error':
			throw new Error('Perspective already exists: ' + name);
		case 'nothing':
			return maybeSwitch();
		}
	}

	var addPerspective = function () {
		self.debug('Adding new perspective: name = "%s" ; config = %O', name, config);

		if (self.availablePerspectives.indexOf(name) < 0) {
			self.availablePerspectives.push(name);
		}

		self.perspectives[name] = new Perspective(name, config, self.modules, perspectiveOpts);

		if (opts.sendEvent) {
			self.fire('perspectiveAdded', {
				notTo: opts.dontSendEventTo
			}, name);
		}

		return maybeSwitch();
	};

	if (self.currentPerspective) {
		return self.save(function () {
			if (config == null) {
				config = deepCopy(self.currentPerspective.getConfig());
				needToLoad = false; // Don't need to load, because this is the current config.
			}
			return addPerspective();
		});
	}

	return addPerspective();
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

	self.backend.setCurrent(name, function (ok) {
		if (!ok) {
			return typeof cont === 'function' ? cont(false) : false;
		}

		var f = function () {
			if (opts.sendEvent) {
				self.fire('perspectiveChanged', {
					notTo: opts.dontSendEventTo
				}, name);
			}

			return typeof cont === 'function' ? cont(true) : true;
		};

		if (opts.loadPerspective) {
			return self.currentPerspective.load(null, f);
		}

		return f();
	});
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
		self.isInitialized = false;
		self.init();
		self.isPrimed = false;
		self.prime(function () {
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
 * @param {string} [opts.key="WC_DataVis_Prefs"]
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

	self.opts = deepDefaults(self.opts, {
		key: 'WC_DataVis_Prefs'
	});

	self.localStorageKey = self.opts.key;
}, {
	version: 1
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
	var version = getPropDef(0, storedPrefData, self.id, 'version');

	if (storedPrefData[self.id] != null && version < self.version) {
		self.migrate(version, function () {
			self.load(name, cont);
		});
	}

	var config = getPropDef({}, storedPrefData, self.id, 'perspectives', name);

	self.debug('Loaded preferences: name = "%s" ; config = %O', name, config);
	
	return cont(config);
};

// #migrate {{{2

PrefsBackendLocalStorage.prototype.migrate = function (version, cont) {
	var self = this;

	self.debug('Migrating prefs: v%d -> v%d', version, self.version);

	for (var i = version; i < self.version; i += 1) {
		switch (i) {
		case 0:
			var oldPrefs = JSON.parse(localStorage.getItem('WC_DataVis_Prefs') || '{}');
			var oldCurrent = JSON.parse(localStorage.getItem('WC_DataVis_Prefs_Current') || '{}');
			var newPrefs = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');

			newPrefs[self.id] = {
				version: i + 1,
				current: oldCurrent[self.id],
				perspectives: _.mapObject(oldPrefs[self.id], function (config, name) {
					return {
						view: config
					};
				})
			};

			// We can delete the "current" storage item completely if it's not being used anymore.

			delete oldCurrent[self.id];

			if (_.isEmpty(oldCurrent)) {
				localStorage.removeItem('WC_DataVis_Prefs_Current');
			}
			else {
				localStorage.setItem('WC_DataVis_Prefs_Current', JSON.stringify(oldCurrent));
			}

			// We can delete the "prefs" storage item completely if it's not being used anymore.
			// Only bother with this if the storage key is different from the old hard-coded key.
			// If it's the same, there's no point because we're just going to overwrite it.

			delete oldPrefs[self.id];

			if (self.localStorageKey !== 'WC_DataVis_Prefs') {
				if (_.isEmpty(oldPrefs)) {
					localStorage.removeItem('WC_DataVis_Prefs');
				}
				else {
					localStorage.setItem('WC_DataVis_Prefs', JSON.stringify(oldPrefs));
				}
			}

			localStorage.setItem(self.localStorageKey, JSON.stringify(newPrefs));
			break;
		}
	}

	return typeof cont === 'function' ? cont(true) : true;
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
	setProp(self.version, storedPrefData, self.id, 'version');
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
	setProp(self.version, storedPrefData, self.id, 'version');
	setProp(name, storedPrefData, self.id, 'current');
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
 */

var PrefsBackendTemporary = makeSubclass(PrefsBackend, function () {
	var self = this;
	self.super.ctor.apply(self, arguments);
	self.storage = {
		perspectives: {}
	};
});

mixinDebugging(PrefsBackendTemporary, function () {
	return 'PREFS (' + this.id + ') // BACKEND - LOCAL';
});

// #load {{{2

PrefsBackendTemporary.prototype.load = function (name, cont) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	config = self.storage.perspectives[name];

	self.debug('Loaded preferences: name = "%s" ; config = %O', name, config);
	
	return cont(config);
};

// #save {{{2

PrefsBackendTemporary.prototype.save = function (name, config, cont) {
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

	self.storage.perspectives[name] = config;

	if (typeof cont === 'function') {
		return cont(true);
	}
};

// #getPerspectives {{{2

PrefsBackendTemporary.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspectives = _.keys(self.storage.perspectives);

	if (perspectives.length === 0) {
		perspectives = ['Main'];
	}

	self.debug('Found %d perspectives: %s', perspectives.length, JSON.stringify(perspectives));

	return cont(perspectives);
};

// #getCurrent {{{2

PrefsBackendTemporary.prototype.getCurrent = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var current = self.storage.current || 'Main';

	self.debug('Current perspective is "%s"', current);

	return cont(current);
};

// #setCurrent {{{2

PrefsBackendTemporary.prototype.setCurrent = function (name, cont) {
	var self = this;

	if (typeof name !== 'string') {
		throw new Error('Call Error: `name` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	self.debug('Setting current perspective to "%s"', name);

	self.storage.current = name;

	return typeof cont === 'function' ? cont(true) : true;
};

// #rename {{{2

PrefsBackendTemporary.prototype.rename = function (oldName, newName, cont) {
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

	self.storage.perspectives[newName] = self.storage.perspectives[oldName];
	delete self.storage.perspectives[oldName];

	return typeof cont === 'function' ? cont(true) : true;
};

// #delete {{{2

PrefsBackendTemporary.prototype.delete = function (name, cont) {
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

	delete self.storage.perspectives[name];

	return typeof cont === 'function' ? cont(true) : true;
};

// #reset {{{2

PrefsBackendTemporary.prototype.reset = function (cont) {
	var self = this;

	self.debug('Resetting perspectives');

	delete self.storage;

	return typeof cont === 'function' ? cont(true) : true;
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
		prefs.filter = deepCopy(filterSpec);
		walkObj(prefs.filter, function (x) {
			if (window.numeral && numeral.isNumeral(x)) {
				return x._value;
			}
			else {
				return x;
			}
		}, {
			callOnNodes: true,
			replace: true
		});
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

// PrefsModuleGraph {{{1

/**
 * @class
 */

var PrefsModuleGraph = makeSubclass(PrefsModule);

// #load {{{2

PrefsModuleGraph.prototype.load = function (config) {
	var self = this;

	if (config == null) {
		return;
	}

	self.target.setUserConfig(config);
};

// #save {{{2

PrefsModuleGraph.prototype.save = function () {
	var self = this;

	var prefs = deepDefaults(self.target.userConfig, {
		plain: {},
		group: {},
		pivot: {}
	});

	

	return prefs;
};

// #reset {{{2

PrefsModuleGraph.prototype.reset = function () {
	var self = this;
};

// Perspective {{{1

// Constructor {{{2

/**
 * @class
 *
 * @property {string} name
 * @property {object} config
 * @property {object} opts
 *
 * @property {boolean} opts.isTemporary
 * If true, then the perspective will not be saved automatically, but it can be made permanent.
 *
 * @property {boolean} opts.isEssential
 * If true, then the perspective cannot be renamed or deleted.
 *
 * @property {boolean} opts.isConstant
 * If true, then the perspective will not be saved if it has been changed.
 *
 * @property {Object.<string,PrefsModule>} modules
 */

var Perspective = makeSubclass(Object, function (name, config, modules, opts) {
	var self = this;

	self.name = name;
	self.config = config;
	self.modules = modules;
	self.opts = deepDefaults(opts, {
		isTemporary: false,
		isEssential: false,
		isConstant: false
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

Perspective.prototype.load = function (modules, cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	if (modules == null) {
		modules = _.keys(self.modules);
	}

	self.debug('Loading perspective using these modules: %s', JSON.stringify(modules));

	// Go through every module that we have preferences for and load them into the bound components.

	_.each(modules, function (moduleName) {
		self.debug('Loading module: moduleName = %s ; config = %O', moduleName, self.config[moduleName]);
		self.modules[moduleName].load(self.config[moduleName]);
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
	grid: PrefsModuleGrid,
	graph: PrefsModuleGraph
};
