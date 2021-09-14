/**
 * @module olgm/listener/AbstractListener
 */
/**
 * Interface for things that have listened to something that can be unlistened to.
 */
var AbstractListener = function AbstractListener () {};

AbstractListener.prototype.unlisten = function unlisten () {
  throw new TypeError('not implemented');
};

export default AbstractListener;

//# sourceMappingURL=AbstractListener.js.map