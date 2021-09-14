/**
 * @module olgm/listener/Listener
 */
import AbstractListener from './AbstractListener';
import {unByKey} from 'ol/Observable';

var Listener = (function (AbstractListener) {
  function Listener(listenerKey) {
    AbstractListener.call(this);

    /**
     * @type {module:ol/events~EventsKey|Array<module:ol/events~EventsKey>}
     * @private
     */
    this.listenerKey_ = listenerKey;
  }

  if ( AbstractListener ) Listener.__proto__ = AbstractListener;
  Listener.prototype = Object.create( AbstractListener && AbstractListener.prototype );
  Listener.prototype.constructor = Listener;

  /**
   * @inheritdoc
   */
  Listener.prototype.unlisten = function unlisten () {
    unByKey(this.listenerKey_);
  };

  return Listener;
}(AbstractListener));

export default Listener;

//# sourceMappingURL=Listener.js.map