/**
 * @module olgm/listener/PropertyListener
 */
import Listener from './Listener';

var PropertyListener = (function (Listener) {
  function PropertyListener(target, oldTarget, key, listen) {
    var this$1 = this;

    Listener.call(this, target.on('change:' + key, function (e) {
      if (this$1.innerListener) {
        this$1.innerListener.unlisten();
      }
      this$1.innerListener_ = listen(e.target.get(e.key), e.oldValue);
    }));

    /**
     * @type {?module:olgm/AbstractListener~AbstractListener|Array<module:olgm/AbstractListener~AbstractListener>}
     * @private
     */
    this.innerListener_ = listen(target.get(key), oldTarget && oldTarget.get(key));
  }

  if ( Listener ) PropertyListener.__proto__ = Listener;
  PropertyListener.prototype = Object.create( Listener && Listener.prototype );
  PropertyListener.prototype.constructor = PropertyListener;

  /**
   * @inheritdoc
   */
  PropertyListener.prototype.unlisten = function unlisten () {
    if (this.innerListener_) {
      if (Array.isArray(this.innerListener_)) {
        this.innerListener.forEach(function (listener) { return listener.unlisten(); });
      } else {
        this.innerListener_.unlisten();
      }
    }
    Listener.prototype.unlisten.call(this);
  };

  return PropertyListener;
}(Listener));

export default PropertyListener;

//# sourceMappingURL=PropertyListener.js.map