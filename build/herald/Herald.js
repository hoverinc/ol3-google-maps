/**
 * @module olgm/herald/Herald
 */
import Abstract from '../Abstract.js';

/**
 * @typedef {Object} WatchOptions
 * @property {boolean} [image=true] Whether to watch image layers or not
 * @property {boolean} [tile=true] Whether to watch tile layers or not
 * @property {boolean} [vector=true] Whether to watch vector layers or not
 */

var Herald = (function (Abstract) {
  function Herald(ol3map, gmap) {
    Abstract.call(this, ol3map, gmap);

    /**
     * @type {module:olgm/AbstractListener~AbstractListener|null}
     * @protected
     */
    this.listener = null;
  }

  if ( Abstract ) Herald.__proto__ = Abstract;
  Herald.prototype = Object.create( Abstract && Abstract.prototype );
  Herald.prototype.constructor = Herald;


  /**
   * Register all event listeners.
   */
  Herald.prototype.activate = function activate () {};


  /**
   * Unregister all event listeners.
   */
  Herald.prototype.deactivate = function deactivate () {
    if (this.listener) {
      this.listener.unlisten();
    }
  };

  return Herald;
}(Abstract));
export default Herald;

//# sourceMappingURL=Herald.js.map