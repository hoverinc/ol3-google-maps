/**
 * @module olgm/herald/VectorFeature
 */
import FeatureHerald from './Feature.js';
import Herald from './Herald.js';
import Listener from '../listener/Listener.js';

/**
 * @typedef {Object} Cache
 * @property {module:ol/Feature} feature
 * @property {module:olgm/herald/Feature} herald
 */

var VectorFeatureHerald = (function (Herald) {
  function VectorFeatureHerald(ol3map, gmap, source, data, mapIconOptions) {
    Herald.call(this, ol3map, gmap);

    /**
     * @type {Array<module:ol/Feature>}
     * @private
     */
    this.features_ = [];

    /**
     * @type {Array<olgm.herald.VectorFeature.Cache>}
     * @private
     */
    this.cache_ = [];

    /**
     * @type {!google.maps.Data}
     * @private
     */
    this.data_ = data;

    /**
     * @type {ol.source.Vector}
     * @private
     */
    this.source_ = source;

    /**
     * @type {module:olgm/gm/MapIcon~Options}
     * @private
     */
    this.mapIconOptions_ = mapIconOptions;

    /**
     * @type {boolean}
     * @private
     */
    this.visible_ = true;
  }

  if ( Herald ) VectorFeatureHerald.__proto__ = Herald;
  VectorFeatureHerald.prototype = Object.create( Herald && Herald.prototype );
  VectorFeatureHerald.prototype.constructor = VectorFeatureHerald;


  /**
   * @inheritDoc
   */
  VectorFeatureHerald.prototype.activate = function activate () {
    var this$1 = this;

    Herald.prototype.activate.call(this);

    // watch existing features...
    this.source_.getFeatures().forEach(function (feature) { return this$1.watchFeature_(feature); });

    // event listeners
    this.listener = new Listener([
      this.source_.on('addfeature', function (event) { return this$1.handleAddFeature_(event); }),
      this.source_.on('removefeature', function (event) { return this$1.handleRemoveFeature_(event); })
    ]);
  };


  /**
   * @inheritDoc
   */
  VectorFeatureHerald.prototype.deactivate = function deactivate () {
    var this$1 = this;

    // unwatch existing features...
    this.source_.getFeatures().forEach(function (feature) { return this$1.unwatchFeature_(feature); });

    Herald.prototype.deactivate.call(this);
  };


  /**
   * Set each feature visible or invisible
   * @param {boolean} value true for visible, false for invisible
   */
  VectorFeatureHerald.prototype.setVisible = function setVisible (value) {
    var this$1 = this;

    this.visible_ = value;
    for (var i = 0; i < this.cache_.length; i++) {
      this$1.cache_[i].herald.setVisible(value);
    }
  };


  /**
   * @param {ol.source.Vector.Event} event addFeature event
   * @private
   */
  VectorFeatureHerald.prototype.handleAddFeature_ = function handleAddFeature_ (event) {
    var feature = /** @type {module:ol/Feature} */ (event.feature);
    this.watchFeature_(feature);
  };


  /**
   * @param {ol.source.Vector.Event} event removeFeature event
   * @private
   */
  VectorFeatureHerald.prototype.handleRemoveFeature_ = function handleRemoveFeature_ (event) {
    var feature = /** @type {module:ol/Feature} */ (event.feature);
    this.unwatchFeature_(feature);
  };


  /**
   * @param {module:ol/Feature} feature feature to watch
   * @private
   */
  VectorFeatureHerald.prototype.watchFeature_ = function watchFeature_ (feature) {

    var ol3map = this.ol3map;
    var gmap = this.gmap;
    var data = this.data_;

    // push to features (internal)
    this.features_.push(feature);

    var index = this.features_.indexOf(feature);

    // create and activate feature herald
    var options = {
      feature: feature,
      data: data,
      index: index,
      mapIconOptions: this.mapIconOptions_,
      visible: this.visible_
    };
    var herald = new FeatureHerald(ol3map, gmap, options);
    herald.activate();

    // push to cache
    this.cache_.push({
      feature: feature,
      herald: herald
    });
  };


  /**
   * @param {module:ol/Feature} feature feature to unwatch
   * @private
   */
  VectorFeatureHerald.prototype.unwatchFeature_ = function unwatchFeature_ (feature) {
    var index = this.features_.indexOf(feature);
    if (index !== -1) {
      // remove from features (internal)
      this.features_.splice(index, 1);
      // deactivate feature herald
      this.cache_[index].herald.deactivate();
      // remove from cache
      this.cache_.splice(index, 1);
    }
  };

  return VectorFeatureHerald;
}(Herald));


export default VectorFeatureHerald;

//# sourceMappingURL=VectorFeature.js.map