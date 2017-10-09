// Preferences {{{1

// Constructor {{{2

/**
 * Encapsulate the preference system, which provides all the configuration for a view.
 */

var Prefs = function () {
	throw new Error('Attempt to instantiate an abstract base class');
};

// #init {{{2

Prefs.prototype.init = function (view) {
	var self = this;

	self.view = view;

	self.getInitialPerspective(function (initial) {
		self.setCurrentPerspective(initial);
	});
};

// #setCurrentPerspective {{{2

/**
 * Set the current view.
 */

Prefs.prototype.setCurrentPerspective = function (perspective) {
	var self = this;

	self.perspective = perspective;
};

// #getCurrentPerspective {{{2

Prefs.prototype.getCurrentPerspective = function () {
	var self = this;

	return self.perspective;
};

// #getPrefsFromView {{{2

Prefs.prototype.getPrefsFromView = function () {
	var self = this;

	var prefs = {};

	var sortSpec = self.view.getSort();
	if (sortSpec) {
		prefs.sort = sortSpec;
	}

	var filterSpec = self.view.getFilter();
	if (filterSpec) {
		prefs.filter = filterSpec;
	}

	var groupSpec = self.view.getGroup();
	if (groupSpec) {
		prefs.group = groupSpec;
	}

	var pivotSpec = self.view.getPivot();
	if (pivotSpec) {
		prefs.pivot = pivotSpec;
	}

	return prefs;
};

// #apply {{{2

/**
 * Apply preferences to the view.
 *
 * @param {object} prefs
 *
 * @param {function} cont
 */

Prefs.prototype.apply = function (prefs, cont) {
	var self = this;

	if (isNothing(prefs.sort)) {
		self.view.clearSort(true);
	}
	else {
		self.view.setSort(prefs.sort.col, prefs.sort.dir, null, true);
	}

	if (isNothing(prefs.filter)) {
		self.view.clearFilter({ notify: true, update: false });
	}
	else {
		self.view.setFilter(prefs.filter, null, { notify: true, update: false });
	}

	if (isNothing(prefs.group)) {
		self.view.clearGroup(true);
	}
	else {
		self.view.setGroup(prefs.group, true);
	}

	if (isNothing(prefs.pivot)) {
		self.view.clearPivot();
	}
	else {
		self.view.setPivot(prefs.pivot);
	}

	if (typeof cont === 'function') {
		return cont();
	}

	return;

	// Now make the view fire the `dataUpdated` event, which will make all the grid tables and graphs
	// using it try to redraw themselves.  This may cause those grid tables to issue `unableToRender`
	// events of their own and forcing grids to create a different (plain, group, or pivot) grid table
	// to handle the view's new configuration.

	self.view.fire(View.events.dataUpdated);
};

// LocalStoragePrefs {{{1

var LocalStoragePrefs = makeSubclass(Prefs, function () {
	var self = this;

	self.localStorageKey = 'WC_DataVis_Prefs';
	self.super.init.apply(self, arguments);
});

// #save {{{2

LocalStoragePrefs.prototype.save = function (opts, cont) {
	var self = this
		, prefs = self.getPrefsFromView();

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Saving preferences: %O', prefs);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	setProp(prefs, storedPrefData, self.view.name, self.perspective);
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	if (typeof cont === 'function') {
		return cont(true);
	}
};

// #load {{{2

LocalStoragePrefs.prototype.load = function (cont) {
	var self = this;

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Loading preferences...');

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var prefs = getPropDef({}, storedPrefData, self.view.name, self.perspective);

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Loaded preferences: %O', prefs);

	self.apply(prefs, cont);
};

// #getPerspectives {{{2

LocalStoragePrefs.prototype.getPerspectives = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	var perspectives = _.keys(getPropDef({}, storedPrefData, self.view.name));

	if (perspectives.length === 0) {
		perspectives = ['Main'];
	}

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Found %d perspectives', perspectives.length);

	return cont(perspectives);
};

// #getInitialPerspective {{{2

LocalStoragePrefs.prototype.getInitialPerspective = function (cont) {
	var self = this;

	if (typeof cont !== 'function') {
		throw new Error('Call Error: `cont` must be a function');
	}

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey + '_Current') || '{}');
	var initial = getPropDef('Main', storedPrefData, self.view.name)

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Initial perspective is "%s"', initial);

	if (self.initialPerspective === undefined) {
		self.initialPerspective = initial;
	}

	return cont(initial);
};

// #setCurrentPerspective {{{2

LocalStoragePrefs.prototype.setCurrentPerspective = function (perspective) {
	var self = this;

	if (typeof perspective !== 'string') {
		throw new Error('Call Error: `perspective` must be a string');
	}

	self.super.setCurrentPerspective(perspective);

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Setting current perspective to "%s"', self.perspective);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey + '_Current') || '{}');
	setProp(self.perspective, storedPrefData, self.view.name);
	localStorage.setItem(self.localStorageKey + '_Current', JSON.stringify(storedPrefData));
};

// #renamePerspective {{{2

LocalStoragePrefs.prototype.renamePerspective = function () {
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
		throw new Error('Usage: LocalStoragePrefs#renamePerspective([oldName], newName)');
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

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Renaming perspective "%s" to "%s"', oldName, newName);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	storedPrefData[self.view.name][newName] = storedPrefData[self.view.name][oldName];
	delete storedPrefData[self.view.name][oldName];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

	if (self.getCurrentPerspective() === oldName) {
		self.setCurrentPerspective(newName);
	}

	return true;
};

// #deletePerspective {{{2

LocalStoragePrefs.prototype.deletePerspective = function (perspective) {
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

	debug.info('PREFS // LOCAL - (' + self.view.name + ' : ' + self.perspective + ')',
						 'Deleting perspective "%s"', perspective);

	var storedPrefData = JSON.parse(localStorage.getItem(self.localStorageKey) || '{}');
	delete storedPrefData[self.view.name][perspective];
	localStorage.setItem(self.localStorageKey, JSON.stringify(storedPrefData));

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
