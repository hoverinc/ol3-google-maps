/**
 * @module olgm/obj
 */
/* Based on https://github.com/openlayers/openlayers/blob/master/src/ol/obj.js */


/**
 * Polyfill for Object.assign().  Assigns enumerable and own properties from
 * one or more source objects to a target object.
 * See https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign.
 *
 * @param {!Object} target The target object.
 * @param {...Object} var_sources The source object(s).
 * @return {!Object} The modified target object.
 */
export var assign = (typeof Object.assign === 'function') ? Object.assign : function(target, var_sources) {
  var arguments$1 = arguments;

  if (target === undefined || target === null) {
    throw new TypeError('Cannot convert undefined or null to object');
  }

  var output = Object(target);
  for (var i = 1, ii = arguments.length; i < ii; ++i) {
    var source = arguments$1[i];
    if (source !== undefined && source !== null) {
      for (var key in source) {
        if (source.hasOwnProperty(key)) {
          output[key] = source[key];
        }
      }
    }
  }
  return output;
};


/**
 * Removes all properties from an object.
 * @param {Object} object The object to clear.
 */
export function clear(object) {
  for (var property in object) {
    delete object[property];
  }
}


/**
 * Get an array of property values from an object.
 * @param {Object<K,V>} object The object from which to get the values.
 * @return {!Array<V>} The property values.
 * @template K,V
 */
export function getValues(object) {
  var values = [];
  for (var property in object) {
    values.push(object[property]);
  }
  return values;
}


/**
 * Determine if an object has any properties.
 * @param {Object} object The object to check.
 * @return {boolean} The object is empty.
 */
export function isEmpty(object) {
  var property;
  for (property in object) {
    return false;
  }
  return !property;
}

//# sourceMappingURL=obj.js.map