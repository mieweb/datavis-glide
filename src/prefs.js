import _ from 'underscore';
import sprintf from 'sprintf-js';
import numeral from 'numeral';

import {
	asyncEach,
	deepCopy,
	deepDefaults,
	getProp,
	getPropDef,
	I,
	Lock,
	log,
	makeSubclass,
	mixinDebugging,
	mixinEventHandling,
	mixinLogging,
	setProp,
	uuid,
	walkObj,
} from './util.js';

import {OrdMap} from './ordmap.js';
import {View} from './view.js';
import {Grid} from './grid.js';
import {Graph} from './graph.js';

/**
 * @file
 * This file contains the implementation of the prefs system.
 *
 * ### Terminology
 *
 * - **Perspective**:
 *
 * - **Prefs Module**:
 *
 * - **Prefs Backend**:
 *
 * - **Prime**: Prepare the prefs system for interactive use.  See {@link Prefs#prime}.
 *
 * - **Reset**:
 *
 * ### Responsibilities
 *
 * - Take configuration from bound components and store it in a backend.
 * - Retrieve configuration from a backend and load it into bound components.
 * - Allow management of perspectives, e.g. create new, rename, and delete.
 * - Facilitate switching between perspectives, including via history stack.
 */

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
 * @property {boolean} isInitialized
 * If true, this Prefs instance has already been initialized.
 *
 * @property {boolean} isPrimed
 * If true, this Prefs instance has already been primed.
 *
 * @property {PrefsBackend} backend
 *
 * @property {object} moduleBindings
 * How perspectives know how to load/save their configurations to/from real things.  Keys are module
 * names, values are targets that are bound to the module.  The actual load/save functionality is
 * contained within PrefsModule subclasses.
 *
 * @property {string[]} availablePerspectives
 * List of all the perspective names that we know about.
 *
 * @property {Object.<string,Perspective>} perspectives
 *
 * @property {Perspective} currentPerspective
 * The current perspective.
 *
 * @property {Perspective[]} bardo
 * List of perspectives to be preserved when resetting prefs.  Any perspectives which are both
 * temporary and essential are saved here, and restored automatically after removing all other
 * perspectives.
 *
 * @property {Array.<Perspective>} history
 * List of perspectives in the history.
 *
 * @property {number} historyIndex
 * Pointer to where we currently are in the history list.
 */

var Prefs = makeSubclass('Prefs', Object, function (id, moduleBindings, opts) {
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
	self.bardo = {};
	self.primeLock = new Lock('Prefs Prime');

	opts = deepDefaults(opts, {
		saveCurrent: true,
		savePerspectives: true,
		backend: {
			type: Prefs.DEFAULT_BACKEND_TYPE
		}
	});

	self.init();

	// Create the backend for saving preferences.

	if (!PREFS_BACKEND_REGISTRY.isSet(opts.backend.type)) {
		throw new Error('PREFS BACKEND IS NOT REGISTERED'); // XXX
	}

	var backendCtor = PREFS_BACKEND_REGISTRY.get(opts.backend.type);
	var backendCtorOpts = opts.backend[opts.backend.type];

	self.debug('Creating new preferences backend: id = "%s" ; type = %s ; opts = %O',
		self.id, opts.backend.type, backendCtorOpts);

	// If creating the backend fails for any reason (e.g. unable to access localStorage) then fall
	// back to a "temporary" prefs backend that doesn't actually save or load anything.

	//try {
		self.backend = new backendCtor(self.id, self, backendCtorOpts);
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

/**
 * Default name of the "main perspective" which is used when no other perspectives exist.  It's a
 * fallback, to ensure that there's always something present.
 */

Prefs.MAIN_PERSPECTIVE_NAME = 'Main Perspective';

/**
 * Default backend type, for when none is specified.  Must be a valid key of something in {@link
 * PREFS_BACKEND_REGISTRY}.
 */

Prefs.DEFAULT_BACKEND_TYPE = 'localStorage';

// Events {{{2

/**
 * Fired when a new perspective is added.
 *
 * @event Prefs#perspectiveAdded
 *
 * @param {string} id
 * ID of the new perspective.
 */

/**
 * Fired when a perspective is deleted.
 *
 * @event Prefs#perspectiveDeleted
 *
 * @param {string} deletedId
 * ID of the perspective being deleted.
 *
 * @param {string} newCurrentId
 * ID of the new current perspective.
 */

/**
 * Fired when a perspective is renamed.
 *
 * @event Prefs#perspectiveRenamed
 *
 * @param {string} id
 * ID of the perspective being renamed.
 *
 * @param {string} newName
 * New name of the perspective.
 */

/**
 * Fired when the current perspective is changed.
 *
 * @event Prefs#perspectiveChanged
 *
 * @param {string} newCurrentId
 * ID of the new current perspective.
 */

/**
 * Fired when the perspective history stack changes.
 *
 * @event Prefs#prefsHistoryStatus
 *
 * @param {boolean} canGoFoward
 * If true, there are history stack elements "after" this one.
 *
 * @param {boolean} canGoBack
 * If true, there are history stack elements "before" this one.
 */

/**
 * Fired when prefs are completely reset.
 *
 * @event Prefs#prefsReset
 */

/**
 * Fired when the prefs system binds a module.
 *
 * @event Prefs#moduleBound
 *
 * @param {string} moduleName
 * Name of the module being bound, e.g. "grid" or "view."
 *
 * @param {PrefsModule} module
 * The instance configuring the target.
 *
 * @param {object} target
 * The target object, what is configured via the module.
 *
 * @param {object} opts
 * Any additional options passed by the target when it bound itself to a module in the prefs system.
 */

mixinEventHandling(Prefs, function (self) {
	return 'PREFS (' + self.id + ')';
}, [
		'perspectiveAdded'   // Fired when a perspective is added.
	, 'perspectiveDeleted' // Fired when a perspective is deleted.
	, 'perspectiveRenamed' // Fired when a perspective is renamed.
	, 'perspectiveChanged' // Fired when the current perspective has changed.
	, 'prefsHistoryStatus'
	, 'prefsReset'
	, 'moduleBound'
]);

mixinDebugging(Prefs, function () {
	return 'PREFS (' + this.id + ')';
});

mixinLogging(Prefs, function () {
	return 'PREFS (' + this.id + ')';
});

//delegate(Prefs, 'backend', ['getPerspectives', 'getCurrent']);

// #init {{{2

/**
 * Initialize internal data structures.
 */

Prefs.prototype.init = function () {
	var self = this;

	if (self.isInitialized) {
		return;
	}

	self.debug('Initializing prefs system');

	self.isInitialized = true;
	self.perspectives = {};
	self.availablePerspectives = [];
	self.currentPerspective = null;
	self.history = [];
	self.historyIndex = 0;
};

// #prime {{{2

/**
 * Prime the prefs system for first use.  This involves:
 *
 *   1. Retrieving the list of available perspectives from the backend.
 *   2. Determine the current perspective name, possibly from the backend.
 *   3. Load the current perspective from the backend.
 *   4. Switch to the current perspective (which loads it into bound modules).
 *
 * The prefs system is now ready for interactive use.
 *
 * TODO This should lock the prefs system so it can't be interacted with.
 *
 * @param {function} cont
 * What to do after the prefs system is primed.  Receives `false` if the prefs system was already
 * primed before this call.  Receives `true` if this was the first time the prefs system was primed.
 */

Prefs.prototype.prime = function (cont) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	if (self.isPrimed) {
		return cont(false);
	}

	if (self.primeLock.isLocked()) {
		return self.primeLock.onUnlock(function () {
			self.prime.apply(self, args);
		});
	}

	self.primeLock.lock();

	var makeFinishCont = function (status) {
		return function () {
			self.isPrimed = true;
			self.primeLock.unlock();
			return cont(status);
		};
	};

	self.init();

	self.debug('Priming');

	return self.backend.getPerspectives(function (ids) {
		self.availablePerspectives = _.union(self.availablePerspectives, ids);
		self.backend.loadAll(function (perspectives) {
			asyncEach(_.values(perspectives), function (x, next) {
				self.addPerspective(x.id, x.name, x.config, null, next, {
					switch: false
				});
			}, function () {
				// When there's already a current perspective (as would be the case when prefs have been
				// pre-configured), we don't have to do anything else.

				self.debug('Priming: Finished adding all perspectives');

				if (self.currentPerspective != null) {
					return makeFinishCont(true)();
				}
				else if (self.availablePerspectives.length === 0) {
					// There are no perspectives available, so we need to make a basic one.

					self.debug('Priming: No perspectives exist, creating one');

					return self.addMainPerspective(makeFinishCont(true));
				}
				else {
					// Otherwise, we need to figure out what the last current perspective was and load it.

					return self.backend.getCurrent(function (currentId) {
						if (currentId == null) {
							// There's no current perspective, somehow, so again just create one.

							self.debug('Priming: No current perspective set, creating one');

							return self.addMainPerspective(makeFinishCont(true));
						}
						else {
							self.setCurrentPerspective(currentId, makeFinishCont(true));
						}
					}); // self.backend.getCurrent()
				}
			}); // asyncEach()
		}); // self.backend.loadAll()
	}); // self.backend.getPerspectives()
};

// #_firePrefsHistoryStatus {{{2

Prefs.prototype._firePrefsHistoryStatus = function () {
	var self = this;

	self.fire('prefsHistoryStatus', null, self.historyIndex < self.history.length - 1, self.historyIndex > 0);
};

// #back {{{2

/**
 * Navigate back in the perspective history stack.
 *
 * @fires Prefs#prefsHistoryStatus
 */

Prefs.prototype.back = function () {
	var self = this;

	if (self.historyIndex === self.history.length - 1) {
		// Already at beginning of history, can't go back anymore.
		return;
	}

	self.historyIndex += 1;
	//self._historyDebug();
	self._firePrefsHistoryStatus();
	self.setCurrentPerspective(self.history[self.historyIndex].id, null, {
		resetHistory: false
	});
};

// #forward {{{2

/**
 * Navigate forward in the perspective history stack.
 *
 * @fires Prefs#prefsHistoryStatus
 */

Prefs.prototype.forward = function () {
	var self = this;

	if (self.historyIndex === 0) {
		// Already at end of history, can't go back anymore.
		return;
	}

	self.historyIndex -= 1;
	//self._historyDebug();
	self._firePrefsHistoryStatus();
	self.setCurrentPerspective(self.history[self.historyIndex].id, null, {
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

	console.log('### HISTORY ### [%d] %O', self.historyIndex, self.history.map(function (x) { return x.name; }));
};

// #bind {{{2

/**
 * Binds a module and target to the prefs system.
 *
 * @param {string} moduleName
 * Name of the module to bind.  Corresponds to a key in {@link PREFS_MODULE_REGISTRY}.
 *
 * @param {object} target
 * The object that will be controlled by the module.
 *
 * @param {object} moduleBoundUserData
 * Userdata forwarded to the `moduleBound` event handler.
 *
 * @fires Prefs#moduleBound
 */

Prefs.prototype.bind = function (moduleName, target, moduleBoundUserData) {
	var self = this;

	if (typeof moduleName !== 'string') {
		throw new Error('Call Error: `moduleName` must be a string');
	}
	if (target == null) {
		throw new Error('Call Error: `target` is required');
	}

	// Make sure that the module is registered with a class, otherwise we obviously have no idea what
	// to do with it.

	if (!PREFS_MODULE_REGISTRY.isSet(moduleName)) {
		throw new Error('Module is not registered: ' + moduleName);
	}

	var moduleCtor = PREFS_MODULE_REGISTRY.get(moduleName);
	self.modules[moduleName] = new moduleCtor(target);

	self.fire('moduleBound', null, moduleName, self.modules[moduleName], target, moduleBoundUserData);

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

// #getPerspective {{{2

/**
 * Gets the perspective by ID.
 *
 * @param {string} id
 * ID of the perspective to get.
 *
 * @returns {Perspective}
 * The perspective with the requested ID.
 */

Prefs.prototype.getPerspective = function (id) {
	var self = this;

	return self.perspectives[id];
};

// #addPerspective {{{2

/**
 * Add a new perspective.
 *
 * @param {string} [id]
 *
 * @param {string} [name=id]
 *
 * @param {object} [config]
 * If missing, the configuration of the current perspective is used.
 *
 * @param {object} [perspectiveOpts]
 * Additional options to pass to the {@link Perspective} constructor.
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
 *
 * @fires Prefs#perspectiveAdded
 */

Prefs.prototype.addPerspective = function (id, name, config, perspectiveOpts, cont, opts) {
	var self = this;
	var needToLoad = true; // Will need to load perspective after we add it.

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string');
	}
	if (name != null && typeof name !== 'string') {
		throw new Error('Call Error: `name` must be null or a string');
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

	if (name == null) {
		name = id;
	}

	cont = cont || I;

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
			return self.setCurrentPerspective(id, cont, {
				loadPerspective: needToLoad
			});
		}

		return cont(true);
	};

	if (self.perspectives[id] != null) {
		switch (opts.onDuplicate) {
		case 'error':
			throw new Error('Perspective already exists: ' + id);
		case 'nothing':
			return maybeSwitch();
		}
	}

	var addPerspective = function () {
		var p = new Perspective(id, name, config, self.modules, perspectiveOpts);

		if (id == null) {
			id = p.id;
		}

		self.debug('Adding new perspective: id = "%s" ; name = "%s" ; config = %O', id, name, config);

		if (self.availablePerspectives.indexOf(id) < 0) {
			self.availablePerspectives.push(id);
		}

		self.perspectives[id] = p;

		if (opts.sendEvent) {
			self.fire('perspectiveAdded', {
				notTo: opts.dontSendEventTo
			}, id);
		}

		return maybeSwitch();
	};

	if (self.currentPerspective) {
		return self.save(function () {
			if (config == null) {
				config = deepCopy(self.currentPerspective.config);
				needToLoad = false; // Don't need to load, because this is the current config.
			}
			return addPerspective();
		});
	}
	else if (config == null) {
		config = {};
	}

	return addPerspective();
};

// #addMainPerspective {{{2

Prefs.prototype.addMainPerspective = function (cont) {
	var self = this;

	self.addPerspective(null, Prefs.MAIN_PERSPECTIVE_NAME, null, null, cont);
};

// #deletePerspective {{{2

/**
 * Delete a perspective.  Perspectives flagged "essential" cannot be deleted.
 *
 * @param {string} [id]
 * The ID of the perspective to delete.  If missing, the current perspective is deleted.
 *
 * @param {function} [cont]
 * Continuation callback.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 *
 * @fires Prefs#perspectiveDeleted
 * @fires Prefs#prefsHistoryStatus
 */

Prefs.prototype.deletePerspective = function (id, cont, opts) {
	var self = this;

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	opts = deepDefaults(opts, {
		sendEvent: true
	});

	// When the ID wasn't provided, use the current perspective.

	if (id == null) {
		id = self.currentPerspective.id;
	}

	// Make sure that we're not trying to delete an essential perspective.

	if (self.perspectives[id].opts.isEssential) {
		self.logError('DELETE PERSPECTIVE', 'Not allowed to delete essential perspective: id = "%s" ; name = "%s"',
			id, self.perspectives[id].name);
		return cont(false);
	}

	// Delete the perspective in the backend.

	self.backend.deletePerspective(id, function (ok) {
		var newCurrent;
		var i;

		if (!ok) {
			return cont(false);
		}

		// Delete it from our internal data structures.

		delete self.perspectives[id];
		self.availablePerspectives = _.without(self.availablePerspectives, id);

		// Let everybody else know that it's been deleted.

		if (opts.sendEvent) {
			self.fire('perspectiveDeleted', {
				notTo: opts.dontSendEventTo
			}, id, newCurrent);
		}

		// When we've deleted all the perspectives, we need to make a new one.

		if (self.availablePerspectives.length === 0) {
			return self.addMainPerspective(cont);
		}

		if (self.currentPerspective.id === id) {
			// Go back in history until we've found a different perspective.

			while (self.historyIndex < self.history.length && self.history[self.historyIndex].id === id) {
				self.historyIndex += 1;
			}

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

				self.setCurrentPerspective(self.history[0].id, null, {
					resetHistory: false
				});
			}
			else {

				// We've removed all items from history, so put something else back on the stack.  In this
				// example, even though there are different things in the future, everything in the past is
				// the same as what we're deleting, so you end up with empty history.
				//
				// BEFORE -------------------------
				//   [ A B B B ]
				//       ^ (history index)
				//
				// AFTER --------------------------
				//   [ Something ]
				//     ^ (history index)

				self.setCurrentPerspective(self.availablePerspectives[0]);
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
 * Rename a perspective.
 *
 * @param {string} [id]
 * When null or undefined, uses the current perspective.
 *
 * @param {string} newName
 *
 * @param {function} [cont]
 *
 * @param {object} [opts]
 * @param {boolean} [opts.sendEvent=true]
 * @param {boolean} [opts.dontSendEventTo]
 *
 * @fires Prefs#perspectiveRenamed
 */

Prefs.prototype.renamePerspective = function (id, newName, cont, opts) {
	var self = this;

	var isCurrent = false;

	opts = deepDefaults(opts, {
		sendEvent: true
	});

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string');
	}
	if (typeof newName !== 'string') {
		throw new Error('Call Error: `newName` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	// When the `id` is missing, use the current perspective's name.

	if (id == null) {
		id = self.currentPerspective.id;
	}

	cont = cont || I;

	if (id === self.currentPerspective.id) {
		isCurrent = true;
	}

	// Make sure a perspective with the old name exists.

	if (self.perspectives[id] == null) {
		throw new Error(sprintf.sprintf('Perspective does not exist: id = "%s"', id));
	}

	// Check to see if there are any other perspectives with the same name.

	_.each(self.perspectives, function (p) {
		if (p.name === newName) {
			log.warn(sprintf.sprintf('Renaming perspective (id = "%s") now shares the name "%s" with a different perspective (id = "%s")',
				id, newName, p.id));
		}
	});

	self.perspectives[id].name = newName;
	self.perspectives[id].save(function () {
		self.backend.save(self.currentPerspective, function () {
			if (opts.sendEvent) {
				self.fire('perspectiveRenamed', {
					notTo: opts.dontSendEventTo
				}, id, newName);
			}

			return cont(true);
		});
	});

	/*
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

		// Remove the old name from the list of available perspectives.
		self.availablePerspectives = _.without(self.availablePerspectives, oldName);

		if (opts.sendEvent) {
			self.fire('perspectiveRenamed', {
				notTo: opts.dontSendEventTo
			}, oldName, newName);
		}

		return isCurrent
			? self.setCurrentPerspective(newName, cont)
			: typeof cont === 'function'
				? cont(true)
				: true;
	});
	*/
};

// #setCurrentPerspective {{{2

/**
 * Switch to a different perspective.
 *
 * @param {string} id
 * ID of the perspective to switch to.
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
 *
 * @fires Prefs#perspectiveChanged
 */

Prefs.prototype.setCurrentPerspective = function (id, cont, opts) {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	opts = deepDefaults(opts, {
		loadPerspective: true,
		sendEvent: true,
		resetHistory: true
	});

	if (self.perspectives[id] == null) {
		if (self.availablePerspectives.indexOf(id) < 0) {
			self.logError('SET CURRENT PERSPECTIVE', 'Perspective does not exist: id = "%s"', id);
			if (self.availablePerspectives.length === 0) {
				return self.addMainPerspective(cont);
			}
			else {
				id = self.availablePerspectives[0];
			}
		}

		// Try to load the perspective config from the backend, and create a new Perspective from it.
		// Adding in this way will cause it to be switched to immediately, so there's no need for us to
		// do it again here.

		return self.backend.load(id, function (config) {
			return self.addPerspective(id, null, config, null, cont);
		});
	}

	self.debug('Switching to perspective: id = "%s"', id);

	self.currentPerspective = self.perspectives[id];

	if (opts.resetHistory) {
		self._resetHistory(self.currentPerspective);
	}

	if (opts.loadPerspective) {
		return self.currentPerspective.load(null, function () {
			if (opts.sendEvent) {
				self.fire('perspectiveChanged', {
					notTo: opts.dontSendEventTo
				}, id);
			}
			self.backend.setCurrent(id, function (ok) {
				return cont(ok);
			});
		});
	}

};

// #setCurrentPerspectiveByName {{{2

Prefs.prototype.setCurrentPerspectiveByName = function (name, cont, opts) {
	var self = this;
	var p = _.findWhere(self.perspectives, {name: name});

	if (p != null) {
		return self.setCurrentPerspective(p.id, cont, opts);
	}

	throw new Error('No such perspective: "' + name + '"');
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

	cont = cont || I;

	if (self.currentPerspective.opts.isTemporary) {
		return cont(false);
	}

	self.currentPerspective.save(function () {
		self.backend.save(self.currentPerspective, cont);
	});
};

// #reset {{{2

/**
 * Reset the prefs system.  This involves:
 *
 *   1. Reset the backend.
 *   2. Flush internal data structures.
 *   3. Prime the prefs system.
 *
 * TODO This should lock the prefs system so it can't be interacted with.
 *
 * @param {function} cont
 * What to do when the prefs system is ready for use again.
 *
 * @fires Prefs#prefsReset
 */

Prefs.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	// Save some info for all perspectives that are both temporary and essential, so we can restore
	// them after everything else has been cleared.  The main use case for this is for pre-configured
	// perspectives to survive when destroying stuff the user created.

	_.each(self.perspectives, function (p) {
		if (p.opts.isTemporary && p.opts.isEssential) {
			self.debug('Saving temporary essential perspective: %s', p.id);
			self.bardo[p.id] = {
				id: p.id,
				name: p.name,
				config: p.config,
				opts: p.opts
			};
		}
	});

	var current = self.currentPerspective.id;

	self.backend.reset(function () {
		self.isInitialized = false;
		self.init();

		self.fire('prefsReset');

		_.each(self.modules, function (module, moduleName) {
			if (typeof module.reset === 'function') {
				self.debug('Resetting module: moduleName = %s', moduleName);
				module.reset();
			}
		});

		self.debug('Restoring temporary essential perspectives: %s', _.keys(self.bardo).join(', '));

		_.each(self.bardo, function (p) {
			self.addPerspective(p.id, p.name, p.config, p.opts, null, { switch: false });
		});

		if (self.perspectives[current]) {
			self.setCurrentPerspective(current);
		}

		self.isPrimed = false;
		self.prime(function () {
			return cont(true);
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
 * @param {Prefs} prefs
 * @param {object} [opts]
 */

var PrefsBackend = makeSubclass('PrefsBackend', Object, function (id, prefs, opts) {
	var self = this;

	self.id = id;
	self.prefs = prefs;
	self.opts = opts;
});

// #load {{{2

/**
 * Loads the configuration for the specified perspective.  A subclass implementation need not
 * support loading perspectives individually, but that's how this function is called.  (For example,
 * an implementation could retrieve all available perspectives from somewhere and just give `cont`
 * the one that was requested.)
 *
 * @abstract
 *
 * @param {string} id
 * @param {function} cont
 */

PrefsBackend.prototype.load = function (id, cont) {
	throw new Error('Abstract method load() not implemented by subclass ' + this.constructor.name);
};

// #loadAll {{{2

/**
 * Loads all perspectives.
 *
 * @abstract
 *
 * @param {function} cont
 */

PrefsBackend.prototype.loadAll = function (cont) {
	throw new Error('Abstract method loadAll() not implemented by subclass ' + this.constructor.name);
};

// #save {{{2

/**
 * Saves the configuration for the specified perspective.  A subclass implementation need not
 * support saving perspectives individually, but that's how this function is called.  (For example,
 * an implementation could update the `id` perspective in a big object containing all available
 * perspectives, and store the whole thing somewhere.)
 *
 * @abstract
 *
 * @param {Perspective} perspective
 * @param {function} [cont]
 */

PrefsBackend.prototype.save = function (perspective, cont) {
	throw new Error('Abstract method save() not implemented by subclass ' + this.constructor.name);
};

// #getPerspectives {{{2

/**
 * @callback PrefsBackend~getPerspectives_cont
 * @param {string[]} ids
 * List of the IDs of all currently available perspectives.
 */

/**
 * Get the IDs of all the available perspectives.
 *
 * @abstract
 *
 * @param {PrefsBackend~getPerspectives_cont} cont
 * Callback function to receive the perspective IDs.
 */

PrefsBackend.prototype.getPerspectives = function (cont) {
	throw new Error('Abstract method getPerspectives() not implemented by subclass ' + this.constructor.name);
};

// #getCurrent {{{2

/**
 * Get the ID of the current perspective.
 *
 * @abstract
 *
 * @param {function} cont
 */

PrefsBackend.prototype.getCurrent = function (cont) {
	throw new Error('Abstract method getCurrent() not implemented by subclass ' + this.constructor.name);
};

// #setCurrent {{{2

/**
 * Set the ID of the current perspective.
 *
 * @abstract
 *
 * @param {string} id
 * @param {function} [cont]
 */

PrefsBackend.prototype.setCurrent = function (id, cont) {
	throw new Error('Abstract method setCurrent() not implemented by subclass ' + this.constructor.name);
};

// #rename {{{2

/**
 * Rename a perspective in the backend, i.e. store that the perspective previously known as
 * `oldName` is now called `newName`.
 *
 * @abstract
 *
 * @param {string} oldName Perspective's old name.
 * @param {string} newName Perspective's new name.
 * @param {function} [cont]
 */

PrefsBackend.prototype.rename = function (oldName, newName, cont) {
	throw new Error('Abstract method rename() not implemented by subclass ' + this.constructor.name);
};

// #delete {{{2

/**
 * Delete a perspective in the backend.
 *
 * @abstract
 *
 * @param {string} id
 * @param {function} [cont]
 */

PrefsBackend.prototype.deletePerspective = function (id, cont) {
	throw new Error('Abstract method deletePerspective() not implemented by subclass ' + this.constructor.name);
};

// #reset {{{2

/**
 * Reset all preferences.
 *
 * @abstract
 *
 * @param {function} [cont]
 */

PrefsBackend.prototype.reset = function (cont) {
	throw new Error('Abstract method reset() not implemented by subclass ' + this.constructor.name);
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

var PrefsBackendLocalStorage = makeSubclass('PrefsBackendLocalStorage', PrefsBackend, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	try {
		var storage = window.localStorage;
	}
	catch (e) {
		log.error('Access to localStorage is denied; prefs disabled');
		throw e;
	}

	self.super.ctor.apply(self, args);

	self.opts = deepDefaults(self.opts, {
		key: 'WC_DataVis_Prefs'
	});

	self.localStorageKey = self.opts.key;
}, {
	version: 2
});

mixinDebugging(PrefsBackendLocalStorage, function () {
	return 'PREFS (' + this.id + ') // BACKEND - LOCAL';
});

// #load {{{2

PrefsBackendLocalStorage.prototype.load = function (id, cont) {
	var self = this;
	var storedPrefStr, storedPrefObj;
	var version;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	storedPrefStr = localStorage.getItem(self.localStorageKey);

	if (storedPrefStr != null) {
		storedPrefObj = JSON.parse(storedPrefStr);
		version = getPropDef(0, storedPrefObj, self.id, 'version');

		if (version < self.version) {
			return self.migrate(version, function () {
				return self.loadAll(cont);
			});
		}
	}
	else {
		storedPrefObj = {};
	}

	var perspective = getProp(storedPrefObj, self.id, 'perspectives', id);

	if (perspective == null) {
		self.debug('Perspective does not exist: id = "%s"', id);
		return cont(null);
	}

	self.debug('Loaded perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	return cont(perspective);
};

// #loadAll {{{2

PrefsBackendLocalStorage.prototype.loadAll = function (cont) {
	var self = this;
	var storedPrefStr, storedPrefObj;
	var version;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	storedPrefStr = localStorage.getItem(self.localStorageKey);

	if (storedPrefStr != null) {
		storedPrefObj = JSON.parse(storedPrefStr);
		version = getPropDef(0, storedPrefObj, self.id, 'version');

		if (version < self.version) {
			return self.migrate(version, function () {
				return self.loadAll(cont);
			});
		}
	}
	else {
		storedPrefObj = {};
	}

	var perspectives = getPropDef({}, storedPrefObj, self.id, 'perspectives');
	self.debug('Loaded all perspectives: %O', perspectives);
	return cont(perspectives);
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
				perspectives: _.mapObject(oldPrefs[self.id], function (config, id) {
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
		case 1:
			var localStorageStr = localStorage.getItem(self.localStorageKey);

			if (localStorageStr == null) {
				throw new Error('Unable to migrate local storage prefs to version 2: '
					+ 'Found no prefs to migrate');
			}

			try {
				var localStorageObj = JSON.parse(localStorageStr);
			}
			catch (e) {
				throw new Error('Unable to migrate local storage prefs to version 2: '
					+ 'Prefs stored are not valid JSON');
			}

			if (localStorageObj[self.id] == null) {
				throw new Error('Unable to migrate local storage prefs to version 2: '
					+ 'No prefs registered for this system ("' + self.id + '")');
			}

			if (localStorageObj[self.id].perspectives == null) {
				localStorageObj[self.id].perspectives = {};
			}

			_.each(localStorageObj[self.id].perspectives, function (p, id) {
				var config = {};
				_.each(p, function (v, k) {
					config[k] = v;
					p[k] = null;
				});
				p.config = config;
				p.id = id;
				p.name = id;
			});

			localStorageObj[self.id].version = i + 1;
			localStorage.setItem(self.localStorageKey, JSON.stringify(localStorageObj));
			break;
		}
	}

	return typeof cont === 'function' ? cont(true) : true;
};

// #save {{{2

PrefsBackendLocalStorage.prototype.save = function (perspective, cont) {
	var self = this;

	if (!(perspective instanceof Perspective)) {
		throw new Error('Call Error: `perspective` must be a Perspective');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Saving perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(self.version, storedPrefData, self.id, 'version');
	setProp({
		id: perspective.id,
		name: perspective.name,
		config: perspective.config
	}, storedPrefData, self.id, 'perspectives', perspective.id);
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #getPerspectives {{{2

PrefsBackendLocalStorage.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var perspectives = _.keys(getPropDef({}, storedPrefData, self.id, 'perspectives'));

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
	var current = getProp(storedPrefData, self.id, 'current')

	self.debug('Current perspective is "%s"', current);

	return cont(current);
};

// #setCurrent {{{2

PrefsBackendLocalStorage.prototype.setCurrent = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Setting current perspective to "%s"', id);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(self.version, storedPrefData, self.id, 'version');
	setProp(id, storedPrefData, self.id, 'current');
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
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

	cont = cont || I;

	self.debug('Renaming perspective: "%s" -> "%s"', oldName, newName);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	storedPrefData[self.id]['perspectives'][newName] = storedPrefData[self.id]['perspectives'][oldName];
	delete storedPrefData[self.id]['perspectives'][oldName];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #delete {{{2

PrefsBackendLocalStorage.prototype.deletePerspective = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Deleting perspective: "%s"', id);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.id]['perspectives'][id];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// #reset {{{2

PrefsBackendLocalStorage.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Resetting perspectives');

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.id];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	return cont(true);
};

// PrefsBackendTemporary {{{1

// Constructor {{{2

/**
 * @class
 * @extends PrefsBackend
 *
 * @param {string} id
 */

var PrefsBackendTemporary = makeSubclass('PrefsBackendTemporary', PrefsBackend, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super.ctor.apply(self, args);
	self.storage = {
		perspectives: {}
	};
});

mixinDebugging(PrefsBackendTemporary, function () {
	return 'PREFS (' + this.id + ') // BACKEND - TEMPORARY';
});

// #load {{{2

PrefsBackendTemporary.prototype.load = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspective = self.storage.perspectives[id];

	if (perspective == null) {
		self.debug('Perspective does not exist: id = "%s"', id);
		return cont(null);
	}

	self.debug('Loaded perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	return cont(perspective);
};

// #loadAll {{{2

PrefsBackendTemporary.prototype.loadAll = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspectives = self.storage.perspectives;
	self.debug('Loaded all perspectives: %O', perspectives);
	return cont(perspectives);
};

// #save {{{2

PrefsBackendTemporary.prototype.save = function (perspective, cont) {
	var self = this;

	if (!(perspective instanceof Perspective)) {
		throw new Error('Call Error: `perspective` must be a Perspective');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Saving perspective: id = "%s" ; name = "%s" ; config = %O',
		perspective.id, perspective.name, perspective.config);

	self.storage.perspectives[perspective.id] = {
		id: perspective.id,
		name: perspective.name,
		config: perspective.config
	};

	return cont(true);
};

// #getPerspectives {{{2

PrefsBackendTemporary.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var perspectives = _.keys(self.storage.perspectives);

	self.debug('Found %d perspectives: %s', perspectives.length, JSON.stringify(perspectives));

	return cont(perspectives);
};

// #getCurrent {{{2

PrefsBackendTemporary.prototype.getCurrent = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var current = self.storage.current;

	self.debug('Current perspective is "%s"', current);

	return cont(current);
};

// #setCurrent {{{2

PrefsBackendTemporary.prototype.setCurrent = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Setting current perspective to "%s"', id);

	self.storage.current = id;

	return cont(true);
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

	cont = cont || I;

	self.debug('Renaming perspective: "%s" -> "%s"', oldName, newName);

	self.storage.perspectives[newName] = self.storage.perspectives[oldName];
	delete self.storage.perspectives[oldName];

	return cont(true);
};

// #delete {{{2

PrefsBackendTemporary.prototype.deletePerspective = function (id, cont) {
	var self = this;

	if (typeof id !== 'string') {
		throw new Error('Call Error: `id` must be a string');
	}
	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Deleting perspective: "%s"', id);

	delete self.storage.perspectives[id];

	return cont(true);
};

// #reset {{{2

PrefsBackendTemporary.prototype.reset = function (cont) {
	var self = this;

	if (cont != null && typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be null or a function');
	}

	cont = cont || I;

	self.debug('Resetting perspectives');

	self.storage = {
		perspectives: {}
	};

	return cont(true);
};

// PrefsModule {{{1

/**
 * Superclass for prefs modules, which provide a way to:
 *
 *   1. Save the configuration from a bound object to a perspective.
 *   2. Load the configuration from a perspective to a bound object.
 *
 * Each prefs module subclass typically works on a single class for its bound object.
 *
 * @param {object} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {object} target
 * What bound object to interact with.
 */

var PrefsModule = makeSubclass('PrefsModule', Object, function (target) {
	var self = this;

	self.target = target;
});

// #load {{{2

/**
 * Applies the provided configuration to the target.
 */

PrefsModule.prototype.load = function (config) {
	throw new Error('Abstract method load() not implemented by subclass ' + this.constructor.name);
};

// #save {{{2

/**
 * Pulls configuration from the target and returns it as an object that can be stored by the
 * preferences backend.
 */

PrefsModule.prototype.save = function () {
	throw new Error('Abstract method save() not implemented by subclass ' + this.constructor.name);
};

// PrefsModuleView {{{1

/**
 * Manages configuration of a view.
 *
 * @param {View} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {View} target
 * What bound object to interact with.
 */

var PrefsModuleView = makeSubclass('PrefsModuleView', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super.ctor.apply(self, args);

	if (!(self.target instanceof View)) {
		throw new Error('Call Error: `target` must be an instance of View');
	}
});

// #load {{{2

PrefsModuleView.prototype.load = function (config) {
	var self = this;

	if (config == null) {
		return;
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

	if (config.sort == null) {
		self.target.clearSort({
			updateData: false
		});
	}
	else {
		self.target.setSort(config.sort, {
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
		self.target.clearAggregate({
			updateData: false
		});
	}
	else {
		self.target.setAggregate(config.aggregate, {
			updateData: false
		});
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

	self.target.reset({
		updateData: false
	});
};

// PrefsModuleGrid {{{1

/**
 * Manages configuration of a grid.
 *
 * @param {Grid} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Grid} target
 * What bound object to interact with.
 */

var PrefsModuleGrid = makeSubclass('PrefsModuleGrid', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super.ctor.apply(self, args);

	if (!(self.target instanceof Grid)) {
		throw new Error('Call Error: `target` must be an instance of Grid');
	}
});

// #load {{{2

PrefsModuleGrid.prototype.load = function (config) {
	var self = this;

	if (config == null) {
		return;
	}

	if (config.colConfig != null) {
		self.target.setColConfig(OrdMap.deserialize(config.colConfig), {
			from: 'prefs',
			redraw: false,
			savePrefs: false
		});
	}
};

// #save {{{2

PrefsModuleGrid.prototype.save = function () {
	var self = this;

	var prefs = {};

	var colConfig = self.target.getColConfig();
	if (colConfig != null) {
		prefs.colConfig = colConfig.serialize();
	}

	return prefs;
};

// #reset {{{2

PrefsModuleGrid.prototype.reset = function () {
	var self = this;

	self.target.resetColConfig();
};

// PrefsModuleGraph {{{1

/**
 * Manages configuration of a graph.
 *
 * @param {Graph} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Graph} target
 * What bound object to interact with.
 */

var PrefsModuleGraph = makeSubclass('PrefsModuleGraph', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super.ctor.apply(self, args);

	if (!(self.target instanceof Graph)) {
		throw new Error('Call Error: `target` must be an instance of Graph');
	}
});

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

// PrefsModuleMeta {{{1

/**
 * Manages configuration of a perspective.  It sounds really weird, but this is a way to store
 * additional information on the perspective which must be serialized.
 *
 * @param {Perspective} target
 * What bound object to interact with.
 *
 * @class
 *
 * @property {Perspective} target
 * What bound object to interact with.
 */

var PrefsModuleMeta = makeSubclass('PrefsModuleMeta', PrefsModule, function () {
	var self = this
		, args = Array.prototype.slice.call(arguments);

	self.super.ctor.apply(self, args);

	if (!(self.target instanceof Perspective)) {
		throw new Error('Call Error: `target` must be an instance of Perspective');
	}
});

// #load {{{2

PrefsModuleMeta.prototype.load = function (config) {
	var self = this;

	if (config != null) {
		self.target.meta = config;
	}
};

// #save {{{2

PrefsModuleMeta.prototype.save = function () {
	var self = this;

	return self.target.meta;
};

// #reset {{{2

PrefsModuleMeta.prototype.reset = function () {
	var self = this;
};

// Perspective {{{1

// Constructor {{{2

/**
 * Create a perspective.
 *
 * @param {string} [id=uuid()]
 * The ID of the perspective.  If not provided, creates a new UUID for it.
 *
 * @param {string} name
 * The name of the perspective; this is what's shown in the user interface.
 *
 * @param {object} config
 *
 * @param {Object.<string,PrefsModule>} modules
 *
 * @param {object} [opts]
 *
 * @param {boolean} [opts.isTemporary=false]
 * If true, then the perspective will not be saved automatically, but it can be made permanent.
 *
 * @param {boolean} [opts.isEssential=false]
 * If true, then the perspective cannot be renamed or deleted.  A reset will not remove it.
 *
 * @param {boolean} [opts.isConstant=false]
 * If true, then the perspective will not be saved if it has been changed.
 *
 * @class
 *
 * @property {string} id See above.
 * @property {object} config See above.
 * @property {Object.<string,PrefsModule>} modules See above.
 * @property {object} opts See above.
 */

var Perspective = makeSubclass('Perspective', Object, function (id, name, config, modules, opts) {
	var self = this;

	if (id != null && typeof id !== 'string') {
		throw new Error('Call Error: `id` must be null or a string')
	}
	if (name != null && typeof name !== 'string') {
		throw new Error('Call Error: `name` must be null or a string');
	}

	if (id == null) {
		id = uuid();
	}

	if (name == null) {
		name = id;
	}

	self.id = id;
	self.name = name;
	self.config = config;
	self.modules = modules;
	self.opts = deepDefaults(opts, {
		isEssential: false,
		isTemporary: false,
		isConstant: false
	});
});

mixinDebugging(Perspective, function () {
	return sprintf.sprintf('PREFS // PERSPECTIVE (%s)', this.id);
});

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

	cont = cont || I;

	if (modules == null) {
		modules = _.keys(self.modules);
	}

	self.debug('Loading perspective using these modules: %s', JSON.stringify(modules));

	// Go through every module that we have preferences for and load them into the bound components.

	_.each(modules, function (moduleName) {
		self.debug('Loading module: moduleName = %s ; config = %O', moduleName, self.config[moduleName]);
		self.modules[moduleName].load(self.config[moduleName]);
	});

	return cont(true);
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

	cont = cont || I;

	self.debug('Saving perspective');

	// Go through every module that we have preferences for and save them from the bound components.

	_.each(self.modules, function (module, moduleName) {
		self.config[moduleName] = module.save();
		self.debug('Saving module: moduleName = %s ; config = %O', moduleName, self.config[moduleName]);
	});

	return cont(self.config);
};

// Registries {{{1

/**
 * Associates backend names with classes implementing those modules.
 */
var PREFS_BACKEND_REGISTRY = new OrdMap();

/**
 * Associates module names with classes implementing those modules.
 */
var PREFS_MODULE_REGISTRY = new OrdMap();

PREFS_BACKEND_REGISTRY.set('localStorage', PrefsBackendLocalStorage);
PREFS_BACKEND_REGISTRY.set('temporary', PrefsBackendTemporary);

PREFS_MODULE_REGISTRY.set('view', PrefsModuleView);
PREFS_MODULE_REGISTRY.set('grid', PrefsModuleGrid);
PREFS_MODULE_REGISTRY.set('graph', PrefsModuleGraph);
PREFS_MODULE_REGISTRY.set('meta', PrefsModuleMeta);

// Exports {{{1

export {
	Prefs,
	PrefsBackend,
	PrefsBackendTemporary,
	PREFS_BACKEND_REGISTRY,
	PrefsModule,
	PrefsModuleGrid,
	PREFS_MODULE_REGISTRY,
	Perspective
};
