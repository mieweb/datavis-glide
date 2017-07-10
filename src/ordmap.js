/**
 * Create a map (a.k.a. dictionary) where the order of the keys added to the data structure is
 * maintained.
 *
 * @class
 *
 * @property {Array<string>} keys List of all keys, in the order they were inserted.
 * @property {Object<string, number>} keyIndex Associates key with the index it was inserted at.
 * @property {Object} map Contains all the data inserted.
 * @property {number} size Number of elements in the map.
 */

function OrdMap() {
	this._keys = [];
	this._keyIndex = {};
	this._map = {};
	this._size = 0;
}

OrdMap.prototype = Object.create(Object.prototype);
OrdMap.prototype.constructor = OrdMap;

/**
 * Retrieve a key/value association from the map.
 *
 * @method
 *
 * @param {string} k The key to retrieve.
 * @returns {any} The value associated with that key.
 */

OrdMap.prototype.get = function (k) {
	return this._map[k];
};

/**
 * Create a key/value association in the map.
 *
 * @method
 *
 * @param {string} k The key to use.
 * @param {any} v The value to use.
 */

OrdMap.prototype.set = function (k, v) {
	if (this._keyIndex[k] === undefined) {
		this._keys.push(k);
		this._keyIndex[k] = this._keys.length - 1;
		this._size += 1;
	}
	this._map[k] = v;
};

/**
 * Remove a key/value association from the map.
 *
 * @method
 *
 * @param {string} k The key for the association to remove.
 */

OrdMap.prototype.unset = function (k) {
	delete this._keyIndex[k];
	delete this._map[k];
	this._size -= 1;
};

/**
 * Indicate if there is an association set for the specified key.
 *
 * @method
 *
 * @param {string} k The key to check on.
 * @returns {boolean} True if there is an association for this key, false if there is not.
 */

OrdMap.prototype.isSet = function (k) {
	return this._keyIndex[k] !== undefined;
};

/**
 * Iterate over the map in the order of the keys inserted.  This is the principle way in which
 * OrdMap differs from a regular JavaScript object.
 *
 * @method
 *
 * @param {function} f A function called for each existing association.  The function is invoked
 * like this: f(VALUE, KEY, KEY-NUMBER).
 */

OrdMap.prototype.each = function (f) {
	var i, j = 0,
		k, v, keyLen = this._keys.length;
	for (i = 0; i < keyLen; i += 1) {
		k = this._keys[i];
		if (this._keyIndex[k] === i) {
			v = this._map[k];
			f(v, k, j);
			j += 1;
		}
	}
};

/**
 * Get a list of the keys used, in the order they were inserted.
 *
 * @method
 *
 * @returns {array} All the keys in order.
 */

OrdMap.prototype.keys = function () {
	var i, k, result = [], keyLen = this._keys.length;
	for (i = 0; i < keyLen; i += 1) {
		k = this._keys[i];
		if (this._keyIndex[k] === i) {
			result.push(k);
		}
	}
	return result;
};

/**
 * Returns the internal representation of this ordered map as a regular JS object (a map with no
 * way to tell the order).  Changing the return value will change the internal representation of
 * this ordered map, so adding/removing keys will completely screw the `OrdMap` instance up!
 */

OrdMap.prototype.asMap = function () {
	return this._map;
};
