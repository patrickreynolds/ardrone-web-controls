/*************************************************************************
 *
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2014 Adobe Systems Incorporated
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 *
 **************************************************************************/

(function(window, document, exportName, undefined) {
    'use strict';

var VENDOR_PREFIXES = ['', 'webkit', 'moz', 'MS', 'ms', 'o'];
var RECOGNIZER_MAP = {};

function inherit(child, base, properties) {
    var basePrototype = base.prototype,
        childPrototype;

    childPrototype = child.prototype = Object.create(basePrototype);
    childPrototype.constructor = child;
    childPrototype._super = base.prototype;

    if (properties) {
        _.extend(childPrototype, properties);
    }
}

function prefixed(obj, property) {
    var prefix, prop;
    var camelProp = property[0].toUpperCase() + property.slice(1);

    var i = 0;
    while (i < VENDOR_PREFIXES.length) {
        prefix = VENDOR_PREFIXES[i];
        prop = (prefix) ? prefix + camelProp : property;

        if (prop in obj) {
            return prop;
        }
        i++;
    }
    return undefined;
}

function splitStr(str) {
    return str.trim().split(/\s+/g);
}

function splitComma(str) {
    return str.trim().split(/,\s+/g);
}

/**
 * Convert a pixel value to metric if the defaults is set to metric units.
 */
function convert(pixelValue) {
    if (Sistine.defaults.units === PIXELS) {
        return pixelValue;
    }

    return pixelValue / Sistine.defaults.ppcm;
}

/**
 * Get the length of a vector [x, y].
 */
function vectorLength(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

/**
 * Create a DOM event.
 */
function createEvent(eventName, props) {
    var e = document.createEvent('Event'),
        p = props || {}; 

    e.initEvent(eventName, p.bubbles ? p.bubbles : true, p.cancelable ? p.cancelable : true);
    return _.extend(e, props);
}

function registerRecognizer(clazz, friendlyName) {
    if (!RECOGNIZER_MAP[friendlyName]) {
        RECOGNIZER_MAP[friendlyName] = clazz;
    }
}

function getRecognizer(friendlyName) {
    return RECOGNIZER_MAP[friendlyName];
}

function ancestorWithSelector(element, selector) {
    while (element.parentElement) {
        if (element.matchesSelector(selector)) {
            return element;
        }

        element = element.parentElement;
    }

    return null;
}

function applyElementPolyfills() {
    applyMatchesSelectorPolyfill(Element.prototype);
}

function applyMatchesSelectorPolyfill(proto) {
    proto.matchesSelector = proto.matches || 
        proto.matchesSelector ||
        proto.mozMatchesSelector ||
        proto.msMatchesSelector ||
        proto.oMatchesSelector ||
        proto.webkitMatchesSelector ||
        function (selector) {
            var el = this,
                els = (el.parentNode || el.document).querySelectorAll(selector),
                i = -1;

            while (els[++i] && els[i] !== el) { }

            return !!els[i];
        };
}

function measurePpcm() {
    var div = document.createElement('div');
    div.style.width = '1cm';

    var body = document.getElementsByTagName('body')[0];
    body.appendChild(div);

    var ppcm = document.defaultView
        .getComputedStyle(div, null)
        .getPropertyValue('width');

    body.removeChild(div);

    return parseFloat(ppcm);
}

function throwAbstract(name) {
    throw 'No definition for abstract method ' + name + '. Must be overridden in subclass.';
}

var POINTER_PROPS = [
    'altKey',
    'bubbles',
    'button',
    'cancelable',
    'ctrlKey',
    'clientX',
    'clientY',
    'detail',
    'fromElement',
    'isPrimary',
    'layerX',
    'layerY',
    'metaKey',
    'offsetX',
    'offsetY',
    'pageX',
    'pageY',
    'pointerId',
    'pointerType',
    'pressure',
    'relatedTarget',
    'screenX',
    'screenY',
    'shiftKey',
    'target',
    'tiltX',
    'tiltY',
    'timeStamp',
    'toElement',
    'type',
    'view',
    'x',
    'y'
];

/**
 * The Pointer tracks the entire lifetime of a given pointer through all events 
 * with the same pointerId. A typical pointer lifetime lasts from the moment the
 * pointer begins until the moment a pointer ends, plus all movement in-between.
 * @param {Number} id
 * @constructor
 */
function Pointer(id) {
    /**
     * @public
     */
    this.id = id;

    /**
     * @public
     */
    this.events = [];
}

Pointer.prototype = {
    /**
     * The number of events in the pointer's history.
     * @return {Number} length of the history
     */
    length: function() {
        return this.events.length;
    },

    /**
     * Adds a pointer event to the Pointer's history. The event is expected to
     * be a standard DOM pointer event as dispatched by the browser. Note:
     * Pointer move events with identical positions as any previous pointer
     * move event are ignored to avoid unnecessary storage of duplicate 
     * information. Pointer move events are also ignored if their pressure value
     * is not greater than 0.
     *
     * @method add
     * @param {Event} e The pointer event to add.
     * @returns {Object} Returns the sanitized event data.
     */
    add: function(e) {
        if (e.type === 'pointermove') {
            var prevEvent = this.events.length > 0 ? this.events[this.events.length - 1] : null;
            if (e.pressure === 0 || (prevEvent && prevEvent.type === 'pointermove' && prevEvent.x === e.x && prevEvent.y === e.y)) {
                return null;
            }
        }

        var eventData = sanitizePointerEvent(e);
        eventData.timeStamp = Date.now();
        this.events.push(eventData);
        return eventData;
    },

    /**
     * Returns the current position of the pointer as a 2-element array
     * consisting of the x and y positions, respectively.
     *
     * @method position
     * @returns {Array} Returns the current position of the pointer.
     */
    position: function() {
        if (this.length() > 0) {
            var p = this.events[this.events.length - 1];
            return [p.x, p.y];
        }

        return [0, 0];
    },

    /**
     * Returns the two-dimensional vector corresponding to the last known
     * movement of the pointer. The vector consists of a 2-element array with
     * the x and y values of the vector, respectively.
     *
     * @method lastMovementVector
     * @returns {Array} Returns the vector corresponding to the last known
     * movement of the pointer.
     */
    lastMovementVector: function() {
        if (this.length() > 1) {
            var p1 = this.events[this.events.length - 1],
                p2 = this.events[this.events.length - 2];

            return [p1.x - p2.x, p1.y - p2.y];
        }

        return [0, 0];
    },

    totalMovementVector: function() {
        if (this.length() > 1) {
            var p1 = this.events[this.events.length - 1],
                p2 = this.events[0];

            return [p1.x - p2.x, p1.y - p2.y];
        }

        return [0, 0];
    },

    totalMovementVectorDirection: function() {
        var delta = this.totalMovementVector(),
            width = delta[0],
            height = delta[1];

        if (Math.abs(width) > Math.abs(height)) {
            return width >= 0 ? DIRECTION_RIGHT : DIRECTION_LEFT;
        }
        else {
            return height >= 0 ? DIRECTION_DOWN : DIRECTION_UP;
        }
    },

    lastMovementDistance: function() {
        return vectorLength(this.lastMovementVector());
    },

    totalMovementDistance: function() {
        return vectorLength(this.totalMovementVector());
    },

    totalCumulativeMovementDistance: function() {
        return cumulativeDistance(this.events, 0, this.events.length);
    },

    duration: function() {
        if (this.length() > 1) {
            var p1 = this.events[0],
                p2 = this.events[this.events.length - 1];

            return Math.abs(p2.timeStamp - p1.timeStamp);
        }

        return 0;
    },

    firstEvent: function() {
        return this.events[0];
    },

    /**
     * Returns the last (latest) event in the Pointer history as a sanitized
     * Object.
     *
     * @returns {Object} Returns the latest event in the Pointer history.
     */
    lastEvent: function() {
        return this.events[this.events.length - 1];
    },

    /**
     * Returns the last known velocity of the pointer as a 2-element array
     * consisting of the x and y components of the velocity, respectively.
     * Velocity speed units are given in pixels per second (px/s).
     *
     * @returns {Array} Returns the last known velocity.
     */
    lastVelocity: function() {
        if (this.length() > 1) {
            var p1 = this.events[this.events.length - 2],
                p2 = this.events[this.events.length - 1],
                timeDiff = (p2.timeStamp - p1.timeStamp) / 1000;

            return [(p2.x - p1.x)/timeDiff, (p2.y - p1.y)/timeDiff];
        }

        return [0, 0];
    },

    /**
     * Returns the last known speed of the pointer (a scalar value).
     *
     * @returns {Number} Returns the last known speed of the pointer.
     */
    lastSpeed: function() {
        return vectorLength(this.lastVelocity());
    },

    clear: function() {
        this.events.length = 0;
    }
};

function sanitizePointerEvent(event) {
    var p, data = {};

    for (var i = 0, len = POINTER_PROPS.length; i < len; i++) {
        p = POINTER_PROPS[i];
        data[p] = event[p];
    }

    // Some browsers (Firefox) do not provide X, Y as part of the event so 
    // default to pageX and pageY
    if (typeof data.x === 'undefined' || typeof data.y === 'undefined') {
        data.x = data.pageX;
        data.y = data.pageY;
    }

    return data;
}

function cumulativeDistance(events, startIndex, length) {
    var totalDistance = 0;

    for (var i = 0; i < length - 1; i++) {
        var p1 = events[i], 
            p2 = events[i+1];

        totalDistance += vectorLength([p1.x - p2.x, p1.y - p2.y]);
    }

    return totalDistance;
}


/**
 * The PointerSet contains a set of Pointer objects, and is used primarily for 
 * tracking clusters of touches in an application. The PointerSet provides 
 * convenience methods for sub-clustering and filtering the set to facilitate 
 * searching for certain gestural conditions.
 *
 * @class PointerSet
 * @param {Array} [pointers] An array of Pointers to use when initializing the
 * set. Omitting this parameter results in an empty set.
 * @constructor
 */
function PointerSet(pointers) {
    this.keys = [];
    this.values = {};

    if (pointers !== undefined && pointers.length > 0) {
        var i = pointers.length;
        while (i--) {
            this.set(pointers[i]);
        }
    }
}

PointerSet.prototype = {
    /**
     * Returns the number of pointers in the set.
     *
     * @method count
     * @returns {Number} Returns the number of Pointers in the set.
     */
    count: function() {
        return this.keys.length;
    },

    /**
     * Returns an array of the IDs of pointers in the set.
     *
     * @method pointerIds
     * @returns {Array} An array of the IDs of pointers in the set.
     */
    pointerIds: function() {
        return this.keys.slice();
    },

    /**
     * A convenience method for adding a pointer event to the correct Pointer 
     * instance in the set. If the Pointer for ID in the event does not exist
     * in the set then this method will automatically add a new Pointer instance
     * to the set with the proper ID.
     *
     * @method add
     * @param {Event} pointerEvent The event to add. Should be a DOM event in
     * its original form as emitted by the browser.
     * @returns {Object} Returns the event data that was added.
     */
    add: function(pointerEvent) {
        var id = pointerEvent.pointerId,
            idx = _.indexOf(this.keys, id);

        if (idx > -1) {
            return this.get(id).add(pointerEvent);
        }
        else {
            var pointer = new Sistine.Pointer(id);
            this.keys.push(id);
            this._sortKeys();
            this.values[id] = pointer;
            return pointer.add(pointerEvent);
        }
    },

    /**
     * Puts a Pointer in the set. If the set does not have a Pointer with ID
     * of the Pointer being set, the Pointer is added to the set, otherwise
     * it will replace the existing Pointer in the set.
     *
     * @method set
     * @param {Pointer} pointer The Pointer instance to add to the set.
     * @returns {Pointer} Returns the set Pointer.
     */
    set: function(pointer) {
        var id = pointer.id;

        if (!this.has(id)) {
            this.keys.push(id);
            this._sortKeys();
        }

        this.values[id] = pointer;
        return pointer;
    },

    /**
     * Removes a Pointer from the set.
     *
     * @method remove
     * @param {Pointer|Number} pointer The Pointer instance or ID to remove.
     * @returns {Pointer} Returns the Pointer that was removed. Returns null
     * otherwise.
     */
    remove: function(pointer) {
        var id = typeof pointer === 'number' ? pointer : pointer.id,
            idx = _.indexOf(this.keys, id),
            cache;

        if (idx > -1) {
            cache = this.values[id];

            this.keys.splice(idx, 1);
            delete this.values[id];
            return cache;
        }
        
        return null;
    },

    /**
     * Clears the set.
     *
     * @method clear
     */
    clear: function() {
        this.keys.length = 0;
        this.values = {};
    },

    /**
     * Gets a Pointer from the set by its ID.
     *
     * @method get
     * @param {Number} id The ID of the Pointer.
     * @returns {Pointer} The Pointer, or null if a Pointer does not exist
     * in the set with the given ID.
     */
    get: function(id) {
        return this.values[id];
    },

    /**
     * Returns true if the PointerSet contains a pointer with the given ID.
     *
     * @method has
     * @param {Number} id The ID of the Pointer to check if it belongs to the
     * set.
     * @returns {Boolean} True if the PointerSet contains the pointer with the
     * given ID.
     */
    has: function(id) {
        return _.indexOf(this.keys, id, true) > -1;
    },

    /**
     * Returns the first Pointer in the set.
     *
     * @method first
     * @returns {Pointer} Returns the first Pointer in the set.
     */
    first: function() {
        return this.values[this.keys[0]];
    },

    /**
     * Returns the last Pointer in the set.
     *
     * @method last
     * @returns {Pointer} Returns the last Pointer in the set.
     */
    last: function() {
        return this.values[this.keys[this.keys.length - 1]];
    },

    /**
     * Returns the Pointer at the given index.
     *
     * @method atIndex
     * @param {Number} index The index.
     * @returns {Pointer} Returns the Pointer at the given index.
     */
    atIndex: function(index) {
        return this.values[this.keys[index]];
    },

    /**
     * Calculates the average position (centroid) of the set using the latest
     * position of all Pointers in the set.
     * @method position
     * @returns {Number} Returns the average position of the set.
     */
    centroid: function() {
        if (this.keys.length === 0) {
            return [0, 0];
        }

        var keys = this.keys;
        var values = this.values;
        var pos = [0, 0];
        var pointerPos = [0, 0];

        var i;
        var len = keys.length;
        for (i = 0; i < len; i++) {
            pointerPos = values[keys[i]].position();
            pos[0] += pointerPos[0];
            pos[1] += pointerPos[1];
        }

        return [pos[0]/keys.length, pos[1]/keys.length];
    },

    averageDistanceFromPoint: function(point) {
        if (this.keys.length === 0) {
            return 0;
        }

        var keys = this.keys;
        var values = this.values;
        var average = 0;
        var pointerPos = [0, 0];

        var i;
        var len = keys.length;
        for (i = 0; i < len; i++) {
            pointerPos = values[keys[i]].position();
            average += vectorLength([pointerPos[0] - point[0], pointerPos[1] - point[1]]);
        }

        return average / keys.length;
    },

    /**
     * Filter the PointerSet with a given predicate. The predicate function
     * should accept a Pointer instance and the PointerSet as arguments, and
     * return true if the Pointer should be included in the new set, or false
     * otherwise.
     *
     * Pointers in the new PointerSet are NOT copied. This means any Pointers
     * manipulated after the filter function is called will be manipulated in
     * all sets in which they are referenced.
     *
     * @param {Function} predicate The predicate function to use for filtering.
     * @returns {PointerSet} Returns a new PointerSet containing the Pointers
     * from the original set that match the filter.
     */
    filter: function(predicate) {
        return new PointerSet(this._filter(predicate, false));
    },

    cluster: function(pointerId, radius) {
        var pointer = this.values[pointerId];

        if (!pointer) {
            return null;
        }

        var predicate = function(otherPointer) {
            var p1 = pointer.position(),
                p2 = otherPointer.position(),
                v = [p1[0] - p2[0], p1[1] - p2[1]];

            return convert(vectorLength(v)) <= radius;
        };

        var candidateIds = [],
            clusterIds = this._filter(predicate, true),
            unvisitedIds = _.clone(this.keys);

        while (unvisitedIds.length > 0) {
            pointer = this.values[unvisitedIds.pop()];
            candidateIds = this._filter(predicate, true);

            if (_.intersection(candidateIds, clusterIds).length > 0) {
                clusterIds = _.union(candidateIds, clusterIds);
            }
        }

        return new PointerSet(this._keysToVals(clusterIds));
    },

    _filter: function(predicate, returnKeys) {
        var keys = this.keys;
        var values = this.values;
        var arr = [];
        var key;
        var val;

        var i;
        var len = keys.length;
        for (i = 0; i < len; i++) {
            key = keys[i];
            val = values[key];

            if (predicate(val, this)) {
                returnKeys ? arr.push(key) : arr.push(val);
            }
        }

        return arr;
    },

    _sortKeys: function() {
        this.keys = this.keys.sort(function(a, b) { return a - b; });
    },

    _keysToVals: function(keys) {
        var vals = [];

        var i;
        var len = keys.length;
        for (i = 0; i < len; i++) {
            vals.push(this.values[keys[i]]);
        }

        return vals;
    }
};

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_POSSIBLE = 1;

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_STARTED = 2;

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_CHANGED = 4;

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_ENDED = 8;

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_CANCELED = 16;

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_RECOGNIZED = 32;

/**
 * @constant
 * @type {Number}
 * @default
 */
var STATE_FAILED = 64;

/**
 * @constant
 * @type {Number}
 * @default
 */
var DIRECTION_LEFT = 1;

/**
 * @constant
 * @type {Number}
 * @default
 */
var DIRECTION_RIGHT = 2;

/**
 * @constant
 * @type {Number}
 * @default 3
 */
var DIRECTION_HORIZONTAL = DIRECTION_LEFT | DIRECTION_RIGHT; // jshint ignore:line

/**
 * @constant
 * @type {Number}
 * @default
 */
var DIRECTION_UP = 4;

/**
 * @constant
 * @type {Number}
 * @default
 */
var DIRECTION_DOWN = 8;

/**
 * @constant
 * @type {Number}
 * @default 12
 */
var DIRECTION_VERTICAL = DIRECTION_UP | DIRECTION_DOWN; // jshint ignore:line

/**
 * @constant
 * @type {Number}
 * @default 15
 */
var DIRECTION_ANY = DIRECTION_HORIZONTAL | DIRECTION_VERTICAL; // jshint ignore:line

/**
 * The Recognizer is the base class for all gesture recognizers in the library.
 * You should not instantiate Recognizer directly, but instead inherit from it
 * for any custom gesture recognizers.
 * 
 * @param {Object} [options] The options.
 *     @param {String} [options.delegate] The delegate that defines simultaneous
 *     recognition behavior for multiple recognizers.
 *     @param {*} [options.delegateScope]
 *     @param {Boolean} [options.capturesPointers]
 */
function Recognizer(options) {
    // Public properties
    this.options = _.defaults(options || {}, this.defaults);
    this.manager = null;
    this.state = STATE_POSSIBLE;
}

Recognizer.prototype = {
    defaults: {
        delegate: null,
        delegateScope: this,
        capturesPointers: false
    },

    recognize: function(eventType, eventData, pointerSet) {
        if (this.state === STATE_ENDED ||
            this.state === STATE_RECOGNIZED ||
            this.state === STATE_CANCELED ||
            this.state === STATE_FAILED) {
            return;
        }

        var prevState = this.state;
        var retVal = this.process(eventType, eventData, pointerSet);
        var emittingData = {};

        if (typeof retVal === 'undefined') {
            return this.state;
        }
        else if (typeof retVal === 'number') {
            this.state = retVal;
        }
        else {
            this.state = retVal.state;
            emittingData = retVal.data || {};
        }

        if (this.state !== prevState || this.state === STATE_CHANGED) {
            if (this.state === STATE_FAILED) {
                this.tryEmitPending();
            }
            else {
                this.emit(_.extend(emittingData, {
                    state: this.state,
                    target: eventData.target
                }));
            }
        }

        return this.state;
    },

    /**
     * @abstract
     */
    process: function(eventType, eventData, pointerSet, emittingData) { 
        return this.state;
    }, 

    /**
     * @abstract
     */
    reset: function() { 
        this.state = STATE_POSSIBLE;
    },

    /**
     * @abstract
     */
    fail: function(pointerIds) {
        _.forEach(pointerIds, function(pointerId) {
            if (this._isTrackingPointer(pointerId)) {
                this.state = STATE_FAILED;
                this.emit({
                    state: this.state
                });
                this.tryEmitPending();
                return false;
            }
        }, this);
    },

    /**
     * @abstract
     */
    getTrackedPointers: function() {
        throwAbstract('getTrackedPointers');
    },

   /**
    * Tells the manager to try to emit any pending events. This is called by the 
    * Recognizer base class automatically when the state changes to 
    * STATE_FAILED. If recognizer subclasses manually set their state to 
    * STATE_FAILED, they should call this explicitly.
    */
    tryEmitPending: function() {
        if (this.manager) {
            this.manager.tryEmitPending();
        }
    },

    /**
     * Emits event data from the recognizer. If the recognizer is not managed
     * by any Manager, then this method will have no effect.
     */
    emit: function(data) { 
        if (this.manager) {
            this.manager.tryEmitRecognizerEvent(this, this.options.eventName, data || {});
        }
    },

    _isTrackingPointer: function(pointerId) {
        var pointerSet = this.getTrackedPointers();

        if (pointerSet && pointerSet.has(pointerId)) {
            return true;
        }

        return false;
    }
};

/**
 * A tap gesture recognizer. This Recognizer supports 1 or more taps consisting
 * of 1 or more fingers within a provided cluster radius.
 *
 * @class Tap
 * @param {Object} [options] The options.
 *     @param {String} [options.eventName] The name of the event to emit when
 *     a tap is detected.
 *     @param {Number} [options.minPointers]
 *     @param {Number} [options.maxPointers]
 *     @param {Number} [options.taps]
 *     @param {Number} [options.interval]
 *     @param {Number} [options.duration]
 *     @param {Number} [options.tolerance]
 *     @param {Number} [options.radius]
 * @constructor
 */
function Tap() {
    Recognizer.apply(this, arguments);
    this.reset();
}

inherit(Tap, Recognizer, {
    defaults: {
        eventName: 'tap',
        minPointers: 1,
        maxPointers: 1,
        taps: 1,
        interval: 300,
        duration: 1000,
        tolerance: 1,
        radius: 7
    },

    process: function(eventType, eventData, pointerSet) {
        switch (eventType) {
            case 'down':
                return this._processDownEvent(eventData, pointerSet);

            case 'up':
                return this._processUpEvent(eventData, pointerSet);
        }
    },

    reset: function() {
        this.state = STATE_POSSIBLE;
        clearInterval(this._interval);

        delete this._interval;
        delete this._masterPointer;
        delete this._currentPointerSet;
        delete this._lastTarget;

        this._tapCount = 0;
        this._firstTapPosition = [];

        return this.state;
    },

    getTrackedPointers: function() {
        return this._currentPointerSet;
    },

    _processDownEvent: function(eventData, pointerSet) {
        if (!this._masterPointer) {
            this._masterPointer = pointerSet.get(eventData.pointerId);
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        if (this._tapCount === 0) {
            this._firstTapPosition = this._currentPointerSet.centroid();
        }
    },

    _processUpEvent: function(eventData, pointerSet) {
        if (!this._currentPointerSet || !this._masterPointer || eventData.pointerId !== this._masterPointer.id) {
            return;
        }

        var pointerCount = this._currentPointerSet.count();
        var tapPosition = this._currentPointerSet.centroid();
        var tapOffset = [this._firstTapPosition[0] - tapPosition[0], this._firstTapPosition[1] - tapPosition[1]];
        var pointerCountInRange = pointerCount >= this.options.minPointers && pointerCount <= this.options.maxPointers;
        var durationInRange = this._masterPointer.duration() <= this.options.duration || this.options.duration === 0;
        var movementInRange = convert(this._masterPointer.totalMovementDistance()) <= this.options.tolerance;
        var multiTapOffsetInRange = this._tapCount === 0 || convert(vectorLength(tapOffset)) <= this.options.tolerance;

        if (pointerCountInRange && durationInRange && movementInRange && multiTapOffsetInRange) {
            return this._handleTap(eventData);
        }
        else {
            return this._returnObject(STATE_FAILED, this._masterPointer, this._currentPointerSet);
        }
    },

    _handleTap: function(eventData) {
        clearInterval(this._interval);
        delete this._interval;

        if (++this._tapCount >= this.options.taps) {
            return this._returnObject(STATE_RECOGNIZED, this._masterPointer, this._currentPointerSet);
        }

        delete this._masterPointer;

        if (this.options.interval > 0) {
            // Trickery to pass the target into the delayed function call
            this._interval = setInterval(_.bind(function() {
                this._handleInterval(eventData.target);
            }, this), this.options.interval);
        }
    },

    _handleInterval: function(target) {
        // Normally, the state is returned to the base class
        // and it calls tryEmitPending automatically, but we
        // do it manually here because the interval finishes
        // asynchronously.
        this.state = STATE_FAILED;
        this.tryEmitPending();

        // Normally, the manager calls reset but in this case
        // we need to manually reset because the interval
        // finishes asynchronously
        this.reset();
    },

    _returnObject: function(state, pointer, pointerSet) {
        return {
            state: state,
            data: {
                pointer: pointer,
                pointerSet: pointerSet
            }
        };
    }

});

registerRecognizer(Tap, 'tap');

/**
 * A simple press gesture recognizer. This Recognizer supports press gestures 
 * of any duration using 1 or more fingers. Events are emitted both on
 * press start and press end.
 *
 * @class Press
 * @param {Object} [options] The options.
 *     @param {String} [options.eventName=press] The name of the event to emit when 
 *     the press is detected.
 *     @param {Number} [options.minPointers] The minimum number of pointers 
 *     for the press.
 *     @param {Number} [options.maxPointers] The maximum number of pointers
 *     for the press.
 *     @param {Number} [options.duration] The minimum duration required for
 *     the press to be recognized. Set to 0 for immediate recognition.
 *     @param {Number} [options.radius] The 
 *     @param {Number} [options.threshold] The maximum allowed movement for the
 *     press while it is being held down (during a long press) for the gesture
 *     to register.
 * @constructor
 */
function Press() {
    Recognizer.apply(this, arguments);
    this.reset();
}

inherit(Press, Recognizer, {
    defaults: {
        eventName: 'press',
        minPointers: 1,
        maxPointers: 1,
        duration: 0,
        threshold: 7,
        radius: 7
    },

    process: function(eventType, eventData, pointerSet) {
        switch(eventType) {
            case 'down':
                return this._processDownEvent(eventData, pointerSet);

            case 'up':
                return this._processUpEvent(eventData, pointerSet);
        }
    },

    reset: function() {
        this.state = STATE_POSSIBLE;

        clearInterval(this._interval);
        delete this._interval;

        delete this._masterPointer;
        delete this._currentPointerSet;

        return this.state;
    },

    getTrackedPointers: function() {
        return this._currentPointerSet;
    },

    // Down events

    _processDownEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processDownEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
                return this._processDownEventStateStarted(eventData, pointerSet);
        }
    },

    _processDownEventStatePossible: function(eventData, pointerSet) {
        if (!this._masterPointer) {
            this._masterPointer = pointerSet.get(eventData.pointerId);
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        var pointerCount = this._currentPointerSet.count(),
            pointerCountInRange = pointerCount >= this.options.minPointers && pointerCount <= this.options.maxPointers;

        if (pointerCountInRange) {
            if (this.options.duration > 0) {
                // Trickery to pass the target into the delayed function call
                this._interval = setInterval(_.bind(function() {
                    this._handleInterval(eventData.target);
                }, this), this.options.duration);
            }
            else {
                return this._returnObject(STATE_STARTED, this._masterPointer, this._currentPointerSet);
            }
        }
    },

    _processDownEventStateStarted: function(eventData, pointerSet) {
        if (this._currentPointerSet.has(eventData.pointerId)) {
            return;
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        if (this._currentPointerSet.count() > this.options.maxPointers) {
            return this._returnObject(STATE_ENDED, this._masterPointer, this._currentPointerSet);
        }
    },

    // Up events
    
    _processUpEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processUpEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
                return this._processUpEventStateStarted(eventData, pointerSet);
        }
    },

    _processUpEventStatePossible: function(eventData, pointerSet) {
        // This function should only happen when there is a long-press timer 
        // running, so return if this is not the case
        if (!this._interval) {
            return;
        }

        if (!this._currentPointerSet || !this._masterPointer || eventData.pointerId !== this._masterPointer.id) {
            return;
        }

        this._currentPointerSet.remove(eventData.pointerId); 

        if (this._currentPointerSet.count() < this.options.minPointers) {
            return this._returnObject(STATE_FAILED, this._masterPointer, this._currentPointerSet);
        }
        else if (eventData.pointerId === this._masterPointer.id) {
            this._masterPointer = this._currentPointerSet.first();
        }
    },

    _processUpEventStateStarted: function(eventData, pointerSet) {
        this._currentPointerSet.remove(eventData.pointerId);

        if (this._currentPointerSet.count() < this.options.minPointers) {
            return this._returnObject(STATE_ENDED, this._masterPointer, this._currentPointerSet);
        }
        else if (eventData.pointerId === this._masterPointer.id) {
            this._masterPointer = this._currentPointerSet.first();
        }

        return this._returnObject(STATE_CHANGED, this._masterPointer, this._currentPointerSet);
    },

    // Helpers

    _handleInterval: function(target) {
        clearInterval(this._interval);
        delete this._interval;

        if (convert(this._masterPointer.totalCumulativeMovementDistance()) < this.options.threshold) {
            // This is a delayed emit, so we do it manually instead of relying
            // on the mechanisms of the base class
            this.state = STATE_STARTED;
            this.emit({
                target: target,
                state: this.state,
                pointer: this._masterPointer,
                pointerSet: this._currentPointerSet
            });
        }
        else {
            // Normally, the state is returned to the base class
            // and it calls tryEmitPending automatically, but we
            // do it manually here because the interval finishes
            // asynchronously.
            this.state = STATE_FAILED;
            this.tryEmitPending();

            // Normally, the manager calls reset but in this case
            // we need to manually reset because the interval
            // finishes asynchronously
            this.reset();
        }
    },

    _returnObject: function(state, pointer, pointerSet) {
        return {
            state: state,
            data: {
                pointer: pointer,
                pointerSet: pointerSet
            }
        };
    }
});

registerRecognizer(Press, 'press');

/**
 * A pinch gesture recognizer. This Recognizer supports pinch gestures
 * using two fingers.
 *
 * @class Pinch
 * @param {Object} [options] The options.
 *     @param {String} [options.eventName] The name of the event to emit when
 *     the pinch is detected.
 *     @param {Number} [options.minScaleThreshold] The minimum scale required for
 *     the pinch to be recognized. Set to 0 for immediate recognition.
 *     @scaleMultiplier {Number} [options.scaleMultiplier] The gesture scale value
       is multiplied by this. Can be used for accelerated and decelerated zooming.
 * @constructor
 */
function Pinch() {
    Recognizer.apply(this, arguments);
    this.reset();

    this._numPointers = 2;
    this._firstAverageDistance = 0;
}

inherit(Pinch, Recognizer, {
    defaults: {
        eventName: 'pinch',
        radius: 7,
        minScaleThreshold: 0.05,
        scaleMultiplier: 1
    },

    process: function(eventType, eventData, pointerSet) {
        switch (eventType) {
            case 'down':
                return this._processDownEvent(eventData, pointerSet);

            case 'move':
                return this._processMoveEvent(eventData, pointerSet);

            case 'up':
                return this._processUpEvent(eventData, pointerSet);
        }
    },

    reset: function() {
        this.state = STATE_POSSIBLE;

        delete this._masterPointer;
        delete this._currentPointerSet;
        this._firstAverageDistance = 0;

        return this.state;
    },

    getTrackedPointers: function() {
        return this._currentPointerSet;
    },

    // Down events

    _processDownEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processDownEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
            case STATE_CHANGED:
                return this._processDownEventStateStarted(eventData, pointerSet);
        }
    },

    _processDownEventStatePossible: function(eventData, pointerSet) {
        if (!this._masterPointer) {
            this._masterPointer = pointerSet.get(eventData.pointerId);
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        var pointerCount = this._currentPointerSet.count();
        if (pointerCount > this._numPointers) {
            return this._returnObject(STATE_FAILED, this._masterPointer, this._currentPointerSet);
        }

        var currentCentroid = this._currentPointerSet.centroid();
        var currentAverageDistance = convert(this._currentPointerSet.averageDistanceFromPoint(currentCentroid));

        if (this._firstAverageDistance === 0) {
            if (currentAverageDistance === 0) {
                return;
            }
            this._firstAverageDistance = currentAverageDistance;
        }

        var scale = currentAverageDistance/this._firstAverageDistance;
        if (Math.abs(1-scale) >= this.options.minScaleThreshold) {
            return this._returnObject(STATE_STARTED, this._masterPointer, this._currentPointerSet);
        }
    },

    _processDownEventStateStarted: function(eventData, pointerSet) {
        if (this._currentPointerSet.has(eventData.pointerId)) {
            return;
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        if (this._currentPointerSet.count() > this._numPointers) {
            return this._returnObject(STATE_ENDED, this._masterPointer, this._currentPointerSet);
        }
    },

    // Move events

    _processMoveEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processMoveEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
            case STATE_CHANGED:
                return this._processMoveEventStateStarted(eventData, pointerSet);
        }
    },

    _processMoveEventStatePossible: function(eventData, pointerSet) {
        return this._processDownEventStatePossible(eventData, pointerSet);
    },

    _processMoveEventStateStarted: function(eventData, pointerSet) {
        if (eventData.pointerId !== this._masterPointer.id) {
            return;
        }

        var currentCentroid = this._currentPointerSet.centroid();
        var currentAverageDistance = convert(this._currentPointerSet.averageDistanceFromPoint(currentCentroid));

        if (this._firstAverageDistance === 0) {
            if (currentAverageDistance === 0) {
                return;
            }
            this._firstAverageDistance = currentAverageDistance;
        }

        var scale = currentAverageDistance/this._firstAverageDistance;
        var multipliedScale = scale * this.options.scaleMultiplier;
        return this._returnObject(STATE_CHANGED, this._masterPointer, this._currentPointerSet, scale);
    },

    // Up events

    _processUpEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processUpEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
            case STATE_CHANGED:
                return this._processUpEventStateStarted(eventData, pointerSet);
        }
    },

    _processUpEventStatePossible: function(eventData, pointerSet) {
        if (!this._currentPointerSet || !this._masterPointer || eventData.pointerId !== this._masterPointer.id) {
            return;
        }

        this._currentPointerSet.remove(eventData.pointerId);

        if (this._currentPointerSet.count() < this._numPointers) {
            return this._returnObject(STATE_FAILED, this._masterPointer, this._currentPointerSet);
        }
        else if (eventData.pointerId === this._masterPointer.id) {
            this._masterPointer = this._currentPointerSet.first();
        }
    },

    _processUpEventStateStarted: function(eventData, pointerSet) {
        this._currentPointerSet.remove(eventData.pointerId);

        if (this._currentPointerSet.count() < this._numPointers) {
            return this._returnObject(STATE_ENDED, this._masterPointer, this._currentPointerSet);
        }
        else if (eventData.pointerId === this._masterPointer.id) {
            this._masterPointer = this._currentPointerSet.first();
        }
    },

    _returnObject: function(state, pointer, pointerSet, scale) {
        return {
            state: state,
            data: {
                pointer: pointer,
                pointerSet: pointerSet,
                scale: scale
            }
        };
    }
});

registerRecognizer(Pinch, 'pinch');

/**
 * A pan gesture recognizer. This Recognizer supports pan gestures
 * using 1 or more fingers.
 *
 * @class Pan
 * @param {Object} [options] The options.
 *     @param {String} [options.eventName] The name of the event to emit when
 *     the pan is detected.
 *     @param {Number} [options.minPointers] The minimum number of pointers
 *     for the pan.
 *     @param {Number} [options.maxPointers] The maximum number of pointers
 *     for the pan.
 *     @param {Number} [options.minLockDistance] The minimum distance required for
 *     the pan to be recognized. Set to 0 for immediate recognition.
 * @constructor
 */
function Pan() {
    Recognizer.apply(this, arguments);

    this.reset();
}

inherit(Pan, Recognizer, {
    defaults: _.extend(Recognizer.prototype.defaults, {
        eventName: 'pan',
        minPointers: 1,
        maxPointers: 1,
        minLockDistance: 1,
        direction: DIRECTION_ANY,
        radius: 7
    }),

    process: function(eventType, eventData, pointerSet) {
        switch(eventType) {
            case 'down':
                return this._processDownEvent(eventData, pointerSet);

            case 'move':
                return this._processMoveEvent(eventData, pointerSet);

            case 'up':
                return this._processUpEvent(eventData, pointerSet);
        }
    },

    reset: function() {
        this.state = STATE_POSSIBLE;

        delete this._masterPointer;
        delete this._currentPointerSet;

        return this.state;
    },

    getTrackedPointers: function() {
        return this._currentPointerSet;
    },

    // Down events

    _processDownEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processDownEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
            case STATE_CHANGED:
                return this._processDownEventStateStarted(eventData, pointerSet);
        }
    },

    _processDownEventStatePossible: function(eventData, pointerSet) {
        if (!this._masterPointer) {
            this._masterPointer = pointerSet.get(eventData.pointerId);
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        var pointerCount = this._currentPointerSet.count();
        var pointerCountInRange = pointerCount >= this.options.minPointers && pointerCount <= this.options.maxPointers;
        var totalDistance = convert(this._masterPointer.totalCumulativeMovementDistance());

        if (pointerCountInRange && totalDistance >= this.options.minLockDistance) {
            var direction = this._masterPointer.totalMovementVectorDirection();
            if (this.options.direction === DIRECTION_ANY ||
                (direction & this.options.direction) === direction) { // jshint ignore:line
                return this._returnObject(STATE_STARTED, this._masterPointer, this._currentPointerSet);
            }
            else {
                return this._returnObject(STATE_FAILED, this._masterPointer, this._currentPointerSet);
            }
        }
    },

    _processDownEventStateStarted: function(eventData, pointerSet) {
        if (this._currentPointerSet.has(eventData.pointerId)) {
            return;
        }

        this._currentPointerSet = pointerSet.cluster(this._masterPointer.id, this.options.radius);

        if (this._currentPointerSet.count() > this.options.maxPointers) {
            return this._returnObject(STATE_ENDED, this._masterPointer, this._currentPointerSet);
        }
    },

    // Move events

    _processMoveEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processMoveEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
            case STATE_CHANGED:
                return this._processMoveEventStateStarted(eventData, pointerSet);
        }
    },

    _processMoveEventStatePossible: function(eventData, pointerSet) {
        return this._processDownEventStatePossible(eventData, pointerSet);
    },

    _processMoveEventStateStarted: function(eventData, pointerSet) {
        if (eventData.pointerId === this._masterPointer.id) {
            var translation = this._masterPointer.totalMovementVector();

            // If the pan is horizontal, ignore y
            if ((this.options.direction | DIRECTION_HORIZONTAL) === DIRECTION_HORIZONTAL) { // jshint ignore:line
                translation[1] = 0;
            }

            // If the pan is vertical, ignore x
            else if ((this.options.direction | DIRECTION_VERTICAL) === DIRECTION_VERTICAL) { // jshint ignore:line
                translation[0] = 0;
            }

            return this._returnObject(STATE_CHANGED, this._masterPointer, this._currentPointerSet, translation);
        }
    },

    // Up events

    _processUpEvent: function(eventData, pointerSet) {
        switch (this.state) {
            case STATE_POSSIBLE:
                return this._processUpEventStatePossible(eventData, pointerSet);

            case STATE_STARTED:
            case STATE_CHANGED:
                return this._processUpEventStateStarted(eventData, pointerSet);
        }
    },

    _processUpEventStatePossible: function(eventData, pointerSet) {
        if (!this._currentPointerSet || !this._masterPointer || eventData.pointerId !== this._masterPointer.id) {
            return;
        }

        this._currentPointerSet.remove(eventData.pointerId);

        if (this._currentPointerSet.count() < this.options.minPointers) {
            return this._returnObject(STATE_FAILED, this._masterPointer, this._currentPointerSet);
        }
        else if (eventData.pointerId === this._masterPointer.id) {
            this._masterPointer = this._currentPointerSet.first();
        }
    },

    _processUpEventStateStarted: function(eventData, pointerSet) {
        this._currentPointerSet.remove(eventData.pointerId);

        if (this._currentPointerSet.count() < this.options.minPointers) {
            return this._returnObject(STATE_ENDED, this._masterPointer, this._currentPointerSet);
        }
        else if (eventData.pointerId === this._masterPointer.id) {
            this._masterPointer = this._currentPointerSet.first();
        }
    },

    _returnObject: function(state, pointer, pointerSet, translation) {
        return {
            state: state,
            data: {
                pointer: pointer,
                pointerSet: pointerSet,
                translation: translation
            }
        };
    },
});

registerRecognizer(Pan, 'pan');

/**
 * The Manager funnels touch input to Recognizer instances and handles the 
 * emitting of gesture events to designated event handlers. Multiple managers
 * may exist in a single application, each manager attached to and listening
 * for events on a single DOM element.
 * 
 * @class Manager
 * @param {HTMLElement} element The DOM element on which to listen for events.
 * @param {Object} [options] The options.
 *     @param {Boolean} [options.domEvents=false] 
 *     @param {Array} [options.recognizers=[]]
 *     @param {Object} [options.cssProps]
 *     @param {Number} [options.ppcm=28]
 *     @param {String} [options.units=cm] One of PIXELS or CENTIMETERS.
 * @see PIXELS
 * @see CENTIMETERS
 * @constructor
 */
function Manager(element, options) {
    this.options = _.defaults(options || {}, Sistine.defaults);
    this.recognizers = [];
    this.pointerSet = new PointerSet();
    this.element = element;
    this.activePointers = [];

    this._handlers = {};
    this._handlePointerEvent = _.bind(this._handlePointerEvent, this);
    this._handleCancelEvent = _.bind(this._handleCancelEvent, this);
    this._pendingEmits = [];

    element.addEventListener('pointerdown', this._handlePointerEvent, false);
    document.addEventListener('pointermove', this._handlePointerEvent, false);
    document.addEventListener('pointerup', this._handlePointerEvent, false);
    document.addEventListener('pointercancel', this._handlePointerEvent, false);
    document.addEventListener('sistine-cancel', this._handleCancelEvent, false);

    // Add all of the default recognizers specified in the options.recognizers
    // Check for strings first, then Recognizer instances
    var i, len, recognizer, clazz;
    for (i = 0, len = this.options.recognizers.length; i < len; i++) {
        recognizer = this.options.recognizers[i];
        if (_.isString(recognizer)) {
            clazz = getRecognizer(recognizer);
            if (_.isFunction(clazz)) {
                this.add(new clazz()); // jshint ignore:line
            }
        }
        else if (recognizer instanceof Recognizer) {
            this.add(recognizer);
        }
        else if (_.isObject(recognizer) && recognizer.name) {
            clazz = getRecognizer(recognizer.name); 
            this.add(new clazz(recognizer.options)); // jshint ignore:line
        }
    }
}

Manager.prototype = {
    /**
     * Returns the number of Recognizers being managed.
     *
     * @returns {Number} Returns the number of recognizers being managed.
     */
    count: function() {
        return this.recognizers.length;
    },

    /**
     * Adds a Recognizer.
     *
     * @param {Recognizer} recognizer The Recognizer instance to add to the
     * manager.
     * @returns {Recognizer} Returns the added recognizer.
     */
    add: function(recognizer) {
        var existing = this.get(recognizer.options.eventName);
        if (existing) {
            this.remove(existing);
        }

        recognizer.manager = this;
        this.recognizers.push(recognizer);

        return this;
    },

    /**
     * Remove a Recognizer.
     *
     * @param {Recognizer} recognizer The recognizer to remove.
     * @returns {Manager} Returns this Manager.
     */
    remove: function(recognizer) {
        var recognizers = this.recognizers;
        recognizer = this.get(recognizer);
        recognizers.splice(_.indexOf(recognizers, recognizer), 1);

        return this;
    },

    /**
     * Remove all Recognizers.
     *
     * @returns {Manager} Returns this Manager instance.
     */
    removeAll: function() {
        this.recognizers.length = 0;

        return this;
    },

    /**
     * Get a recognizer by its event name.
     * 
     * @param {Recognizer|String} eventName Event name or Recognizer instance.
     * @returns {Recognizer|Null} Returns the Recognizer if it was added to the
     * manager. Returns null otherwise.
     */
    get: function(eventName) {
        if (eventName instanceof Recognizer) {
            return eventName;
        }

        var found = null;

        _.forEach(this.recognizers, function(recognizer) {
            if (recognizer.options.eventName === eventName) {
                found = recognizer;
                return false;
            }
        }, this);

        return found;
    },

    /**
     * Recognize an event. Typically, this is called automatically by the Manager
     * when handling pointer events from the browser. Calling this method
     * manually when other events are occurring may interfere with proper
     * gesture recognition, so use wisely.
     *
     * @param {String} eventType One of pointerstart, pointermove, pointerend
     * or pointercancel.
     * @param {Object} The event data as a sanitized, flattened object. This
     * is automatically provided by the ```Pointer.add``` method.
     * @param {PointerSet} The set of all Pointers currently on the element
     * managed by this Manager.
     */
    recognize: function(eventType, eventData, pointerSet) {
        var recognizers = this.recognizers;
        var recognizer, otherRecognizer, previousState, currentState, delegate, delegateScope;
        
        for (var i = 0, len = recognizers.length; i < len; i++) {
            recognizer = recognizers[i];
            previousState = recognizer.state;
            delegate = recognizer.options.delegate;
            delegateScope = recognizer.options.delegateScope;

            // If the recognizer already failed, skip
            if (previousState === STATE_FAILED) {
                continue;
            }

            currentState = recognizer.recognize(eventType, eventData, pointerSet);

            // Set all other recognizers to STATE_FAILED unless they are simultaneous
            // or the other recognizer is a failure dependency
            if (previousState === STATE_POSSIBLE &&
                currentState !== STATE_POSSIBLE &&
                currentState !== STATE_FAILED) {

                if (delegate && _.isFunction(delegate.capturesPointers) && delegate.capturesPointers.call(delegateScope, recognizer)) {
                    Sistine.cancelPointers(recognizer.getTrackedPointers().pointerIds(), recognizer);  
                }

                for (var j = 0; j < len; j++) {
                    otherRecognizer = recognizers[j];
                    if (otherRecognizer !== recognizer) {
                        var setToFail = true;
                        if (delegate) {
                            if (_.isFunction(delegate.areGesturesSimultaneous) &&
                                delegate.areGesturesSimultaneous.call(delegateScope, recognizer, otherRecognizer)) {
                                setToFail = false;
                            }
                            else if (_.isFunction(delegate.gestureRequiredToFail) &&
                                     (delegate.gestureRequiredToFail.call(delegateScope, recognizer) === otherRecognizer)) {
                                setToFail = false;
                            }
                        }

                        if (setToFail) {
                            otherRecognizer.state = STATE_FAILED;
                        }
                    }
                }
            }
        }
    },

   /**
    * Resets and clears the recognizers. This should be called by the Manager
    * when the recognizer has been set to ENDED, RECOGNIZED, CANCELED or FAILED.
    */
    reset: function() {
        var recognizer;
        var recognizers = this.recognizers;

        for (var i = 0, len = recognizers.length; i < len; i++) {
            recognizer = recognizers[i];
            if (recognizer.state === STATE_ENDED ||
                recognizer.state === STATE_RECOGNIZED ||
                recognizer.state === STATE_CANCELED ||
                recognizer.state === STATE_FAILED) {
                recognizer.reset();
            }
        }
    },

    /**
     * Listens for a gesture event on the Manager.
     *
     * @param {String} events A comma-delimited string of event names optionally
     *     suffixed with a selector (by a space).
     * @param {Function} handler The event handler function.
     * @returns {Manager} Returns this Manager instance.
     * @example
     *     manager.on('tap', function() { ... });
     *     manager.on('tap .myclass', function() { ... });
     *     manager.on('tap .myclass, swipe', function() { ... });
     */
    on: function(events, handler) {
        var handlers = this._handlers;
        _.each(_.map(splitComma(events), splitStr), function(eventPair) {
            var eventName = eventPair[0],
                selector = eventPair[1];
            handlers[eventName] = handlers[eventName] || [];
            handlers[eventName].push({
                handler: handler,
                selector: selector
            });
        });

        return this;
    },

    /**
     * Stops listening for a gesture event on the Manager.
     *
     * @param {String} events A comma-delimited string of event names optionally
     *     suffixed with a selector (by a space).
     * @param {Function} handler The event handler function.
     * @returns {Manager} Returns this Manager instance.
     * @example
     *     manager.off('tap');
     *     manager.off('tap .myclass');
     *     manager.off('tap', myFunction);
     *     manager.off('tap .myclass', myFunction);
     */
    off: function(events, handler) {
        var handlers = this._handlers;
        _.each(_.map(splitComma(events), splitStr), function(eventPair) {
            var eventName = eventPair[0],
                selector = eventPair[1];

            if (!handler) {
                if (!selector) {
                    delete handlers[eventName];
                }
                else {
                    handlers[eventName].splice(_.indexOf(_.pluck(handlers[eventName], 'selector'), selector), 1);
                }
            } 
            else {
                if (!selector) {
                    handlers[eventName].splice(_.indexOf(_.pluck(handlers[eventName], 'handler'), handler), 1);
                }
                else {
                    handlers[eventName].splice(_.findIndex(handlers[eventName], function(obj) {
                        return obj.handler === handler && obj.selector === selector;
                    }), 1);
                }
            }
        });

        return this;
    },

    /**
     * Tries to emit a recognizer event. Recognizers should call this method instead
     * of calling emit directly. If an event cannot be emitted due to a dependency, it
     * is added to a queue to try and emit later.
     *
     * @param {Recognizer} recognizer
     * @param {String} eventName
     * @param {Object} props
     */
    tryEmitRecognizerEvent: function(recognizer, eventName, props) {
        var requireFailRecognizer;
        var delegate = recognizer.options.delegate;
        var delegateScope = recognizer.options.delegateScope;

        if (delegate && _.isFunction(delegate.gestureRequiredToFail)) {
            requireFailRecognizer = delegate.gestureRequiredToFail.call(delegateScope, recognizer);
            if (requireFailRecognizer && requireFailRecognizer.state === STATE_FAILED) {
                this.emit(eventName, props);
                return;
            }
            else if (requireFailRecognizer && requireFailRecognizer.state === STATE_POSSIBLE) {
                this._pendingEmits.push({
                    recognizer:recognizer,
                    eventName:eventName,
                    props:props
                });
                return;
            }
        }

        this.emit(eventName, props);
    },

    /**
     * Tries to emit any pending events.
     */
    tryEmitPending: function() {
        var pendingEmit, recognizer, requireFailRecognizer, delegate, delegateScope;

        for (var i = 0, len = this._pendingEmits.length; i < len; i++) {
            pendingEmit = this._pendingEmits[i];
            recognizer = pendingEmit.recognizer;
            delegate = recognizer.options.delegate;
            delegateScope = recognizer.options.delegateScope;

            if (delegate && _.isFunction(delegate.gestureRequiredToFail)) {
                requireFailRecognizer = delegate.gestureRequiredToFail.call(delegateScope, recognizer);
                if (requireFailRecognizer && requireFailRecognizer.state === STATE_FAILED) {
                    this.emit(pendingEmit.eventName, pendingEmit.props);
                    this._pendingEmits.splice(i, 1);
                }
            }
        }
    },

    /**
     * Emits an event.
     *
     * @param {String} eventName
     * @param {Object} [props]
     */
    emit: function(eventName, props) {
        props = _.extend(props || {}, {currentTarget: this.element});

        if (this.options.domEvents && props.target) {
            props.target.dispatchEvent(createEvent(eventName, props));
        }

        var handlers = this._handlers[eventName] && this._handlers[eventName].slice();
        if (!handlers || handlers.length === 0) {
            return;
        }

        for (var i = 0, len = handlers.length; i < len; i++) {
            var handler = handlers[i].handler;
            var selector = handlers[i].selector;
            var currentTarget = selector ? ancestorWithSelector(props.target, selector) : this.element;

            if (!selector || (selector && currentTarget)) {
                handlers[i].handler(_.extend(props || {}, {currentTarget: currentTarget}));
            }
        }
    },

    /**
     * Forces all gesture recognizers tracking the given pointer IDs to fail
     * immediately. The optional ```excluding``` parameter provides the option
     * of allowing one or more recognizers to ignore the fail request.
     *
     * @param {Array} pointerIds The pointer IDs that should be considered
     * cancelled by all Recognizers except those in the exclusion list.
     * @param {Recognizer|Array} [excluding] The Recognizer or Recognizers that
     * should be considered immune to the cancel request.
     */
    cancel: function(pointerIds, excluding) {
        if (!pointerIds) {
            return;
        }

        _.forEach(this.recognizers, function(recognizer) {
            if ((_.isArray(excluding) && _.contains(excluding, recognizer)) ||
                recognizer === excluding) {
                return true;
            }

            recognizer.fail(pointerIds);
        }, this);

        if (_.isNull(excluding)) {
            this._processRemovedPointers(pointerIds);
        }
    },

    _handlePointerEvent: function(e) {
        var eventData;
        var eventType = e.type.substring(7);
        var pointerId = e.pointerId;

        switch (eventType) {
            case 'down':
                eventData = this.pointerSet.add(e);
                this.activePointers.push(pointerId);
                break;

            case 'move':
            case 'up':
            case 'cancel':
                if (_.indexOf(this.activePointers, pointerId) > -1 && this.pointerSet.has(pointerId)) {
                    eventData = this.pointerSet.add(e);
                }
                break;
        }

        var pointer = this.pointerSet.get(pointerId);

        if (eventData && pointer) {
            this.recognize(eventType, eventData, this.pointerSet);
        }

        if (eventType === 'cancel' || eventType === 'up') {
            this._processRemovedPointer(pointerId);
        }
    },

    _handleCancelEvent: function(e) {
        this.cancel(e.pointerIds, e.sender);
    },

    _processRemovedPointers: function(pointerIds) {
        _.forEach(pointerIds, function(id) {
            this._processRemovedPointer(id);
        }, this);
    },

    _processRemovedPointer: function(pointerId) {
        this.pointerSet.remove(pointerId);
        var index = _.indexOf(this.activePointers, pointerId);

        if (index > -1) {
            this.activePointers.splice(index, 1);
        }

        if (this.activePointers.length === 0) {
            this.reset();
        }
    }
};

/**
 * Used for specifying centimeters (cm) as the preferred measurement unit for
 * all gesture recognizer options.
 *
 * @constant
 * @type {String}
 * @default
 */
var CENTIMETERS = 'cm';

/**
 * Used for specifying pixels (px) as the preferred measurement unit for all
 * gesture recognizer options.
 *
 * @constant
 * @type {String}
 * @default
 */
var PIXELS = 'px';

/**
 * A shorthand method of creating a new Manager for a given element.
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @constructor
 */
function Sistine(element, options) {
    return new Sistine.Manager(element, options);
}

/**
 * @namespace
 */
Sistine.defaults = {
    /**
     * The default "points per centimeter" to use for unit conversion. When
     * DOM content is loaded this value will be reset to a calculated value
     * based on values reported by the browser (if it can be calculated).
     *
     * @type {Number}
     * @default 28
     */
    ppcm: 28,

    /**
     * The default units to use for recognizer options that specify distances.
     *
     * @type {String}
     * @default 'cm'
     * @see CENTIMETERS
     */
    units: CENTIMETERS,

    cssProps: {
        userSelect: 'none',
        touchSelect: 'none',
        touchCallout: 'none',
        contentZooming: 'none',
        userDrag: 'none',
        tapHighlightColor: 'rgba(0,0,0,0)'
    },

    /**
     * The default Recognizers to add to a Manager.
     *
     * @type {Array}
     * @default []
     */
    recognizers: [],

    /**
     * Set to true to enable DOM events, in addition to the standard events
     * emitted from the Manager instances.
     *
     * DOM events are slower and can introduce issues when multiple Managers
     * are used in the same application with DOM events turned on. Typically,
     * this means duplicate events for the same gesture across Managers when
     * those Managers are attached to elements that are descendants of each
     * other.
     *
     * @type {Boolean}
     * @default false
     */
    domEvents: false,
};

/**
 * Notifies all gesture recognizers (globally across the application) that
 * the given pointer IDs should be considered as "cancelled." This means
 * that any gesture recognizer currently monitoring these touches (either in
 * the pending or started state) should fail immediately and reset.
 *
 * @param {Array} pointerIds The pointer IDs that should be considered as
 * cancelled.
 *
 * @namespace
 */
Sistine.cancelPointers = function(pointerIds, sender) {
    var ev = createEvent('sistine-cancel', {
        'pointerIds': pointerIds,
        'sender': sender
    });

    document.dispatchEvent(ev);
};

/*
 * Performs default setup that must be initialized after the DOM content
 * is available.
 */
document.addEventListener('DOMContentLoaded', function () {
    Sistine.defaults.ppcm = measurePpcm();
    applyElementPolyfills();

    var body = document.getElementsByTagName('body')[0];
    _.each(Sistine.defaults.cssProps, function(value, name) {
        body.style[prefixed(body.style, name)] = value;
    });
});


_.extend(Sistine, {
    // States
    STATE_POSSIBLE: STATE_POSSIBLE,
    STATE_STARTED: STATE_STARTED,
    STATE_CHANGED: STATE_CHANGED,
    STATE_ENDED: STATE_ENDED,
    STATE_CANCELED: STATE_CANCELED,
    STATE_RECOGNIZED: STATE_RECOGNIZED,
    STATE_FAILED: STATE_FAILED,

    // Directions
    DIRECTION_LEFT: DIRECTION_LEFT,
    DIRECTION_RIGHT: DIRECTION_RIGHT,
    DIRECTION_HORIZONTAL: DIRECTION_HORIZONTAL,
    DIRECTION_UP: DIRECTION_UP,
    DIRECTION_DOWN: DIRECTION_DOWN,
    DIRECTION_VERTICAL: DIRECTION_VERTICAL,
    DIRECTION_ANY: DIRECTION_ANY,

    // Units
    CENTIMETERS: CENTIMETERS,
    PIXELS: PIXELS,

    // Core classes
    Manager: Manager,
    Recognizer: Recognizer,
    PointerSet: PointerSet,
    Pointer: Pointer,

    // Recognizers
    Tap: Tap,
    Press: Press,
    Pinch: Pinch,
    Pan: Pan
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sistine;
}
else {
    window[exportName] = Sistine;
}

})(window, document, 'Sistine');
