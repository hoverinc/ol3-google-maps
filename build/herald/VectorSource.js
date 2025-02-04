/**
 * @module olgm/herald/VectorSource
 */
import {createStyle} from '../gm.js';
import SourceHerald from './Source.js';
import VectorFeatureHerald from './VectorFeature.js';
import PropertyListener from '../listener/PropertyListener.js';

/**
 * @typedef {Object} LayerCache
 * @property {google.maps.Data} data
 * @property {module:olgm/herald/VectorFeature} herald
 * @property {module:ol/layer/Vector} layer
 * @property {?module:olgm/AbstractListener~AbstractListener} listeners
 * @property {number} opacity
 */

var VectorSourceHerald = (function (SourceHerald) {
  function VectorSourceHerald(ol3map, gmap, mapIconOptions) {
    SourceHerald.call(this, ol3map, gmap);

    /**
    * @type {Array<module:olgm/herald/VectorSource~LayerCache>}
    * @private
    */
    this.cache_ = [];

    /**
    * @type {Array<module:ol/layer/Vector>}
    * @private
    */
    this.layers_ = [];

    /**
     * @type {module:olgm/gm/MapIcon~Options}
     * @private
     */
    this.mapIconOptions_ = mapIconOptions;
  }

  if ( SourceHerald ) VectorSourceHerald.__proto__ = SourceHerald;
  VectorSourceHerald.prototype = Object.create( SourceHerald && SourceHerald.prototype );
  VectorSourceHerald.prototype.constructor = VectorSourceHerald;


  /**
   * @param {module:ol/layer/Base} layer layer to watch
   * @override
   */
  VectorSourceHerald.prototype.watchLayer = function watchLayer (layer) {
    var this$1 = this;

    var vectorLayer = /** @type {module:ol/layer/Vector} */ (layer);

    // Source required
    var source = vectorLayer.getSource();
    if (!source) {
      return;
    }

    this.layers_.push(vectorLayer);

    // Data
    var data = new google.maps.Data({
      'map': this.gmap
    });

    // Style
    var gmStyle = createStyle(vectorLayer, this.mapIconOptions_);
    if (gmStyle) {
      data.setStyle(gmStyle);
    }

    // herald
    var herald = new VectorFeatureHerald(
      this.ol3map, this.gmap, source, data, this.mapIconOptions_);

    // opacity
    var opacity = vectorLayer.getOpacity();

    var cacheItem = /** {@type module:olgm/herald/VectorSource~LayerCache} */ ({
      data: data,
      herald: herald,
      layer: vectorLayer,
      listeners: [],
      opacity: opacity
    });

    cacheItem.listeners.push(
      new PropertyListener(this.ol3map, null, 'view', function (view, oldView) {
        return [
          new PropertyListener(view, oldView, 'resolution', function () { return this$1.handleResolutionChange_(cacheItem); }),
          new PropertyListener(view, oldView, 'visible', function () { return this$1.handleVisibleChange_(cacheItem); })
        ];
      })
    );

    this.activateCacheItem_(cacheItem);

    this.cache_.push(cacheItem);
  };


  /**
   * Unwatch the vector layer
   * @param {module:ol/layer/Base} layer layer to unwatch
   * @override
   */
  VectorSourceHerald.prototype.unwatchLayer = function unwatchLayer (layer) {
    var vectorLayer = /** @type {module:ol/layer/Vector} */ (layer);

    var index = this.layers_.indexOf(vectorLayer);
    if (index !== -1) {
      this.layers_.splice(index, 1);

      var cacheItem = this.cache_[index];
      cacheItem.listeners.forEach(function (listener) { return listener.unlisten(); });

      // data - unset
      cacheItem.data.setMap(null);

      // herald
      cacheItem.herald.deactivate();

      // opacity
      vectorLayer.setOpacity(cacheItem.opacity);

      this.cache_.splice(index, 1);
    }

  };


  /**
   * Activate all cache items
   * @api
   * @override
   */
  VectorSourceHerald.prototype.activate = function activate () {
    SourceHerald.prototype.activate.call(this);
    this.cache_.forEach(this.activateCacheItem_, this);
  };


  /**
   * Activates an image WMS layer cache item.
   * @param {module:olgm/herald/VectorSource~LayerCache} cacheItem cacheItem to activate
   * @private
   */
  VectorSourceHerald.prototype.activateCacheItem_ = function activateCacheItem_ (cacheItem) {
    var layer = cacheItem.layer;
    var visible = layer.getVisible();
    if (visible && this.googleMapsIsActive) {
      cacheItem.herald.activate();
      cacheItem.layer.setOpacity(0);
    }
  };


  /**
   * Deactivate all cache items
   * @api
   * @override
   */
  VectorSourceHerald.prototype.deactivate = function deactivate () {
    SourceHerald.prototype.deactivate.call(this);
    this.cache_.forEach(this.deactivateCacheItem_, this);
  };


  /**
   * Deactivates a Tile WMS layer cache item.
   * @param {module:olgm/herald/VectorSource~LayerCache} cacheItem cacheItem to
   * deactivate
   * @private
   */
  VectorSourceHerald.prototype.deactivateCacheItem_ = function deactivateCacheItem_ (cacheItem) {
    cacheItem.herald.deactivate();
    cacheItem.layer.setOpacity(cacheItem.opacity);
  };


  VectorSourceHerald.prototype.handleResolutionChange_ = function handleResolutionChange_ (cacheItem) {
    var layer = cacheItem.layer;

    var minResolution = layer.getMinResolution();
    var maxResolution = layer.getMaxResolution();
    var currentResolution = this.ol3map.getView().getResolution();
    if (currentResolution < minResolution || currentResolution > maxResolution) {
      cacheItem.herald.setVisible(false);
    } else {
      cacheItem.herald.setVisible(true);
    }
  };


  /**
   * Deal with the google WMS layer when we enable or disable the OL3 WMS layer
   * @param {module:olgm/herald/VectorSource~LayerCache} cacheItem cacheItem for the
   * watched layer
   * @private
   */
  VectorSourceHerald.prototype.handleVisibleChange_ = function handleVisibleChange_ (cacheItem) {
    var layer = cacheItem.layer;
    var visible = layer.getVisible();
    if (visible) {
      this.activateCacheItem_(cacheItem);
    } else {
      this.deactivateCacheItem_(cacheItem);
    }
  };

  return VectorSourceHerald;
}(SourceHerald));


export default VectorSourceHerald;

//# sourceMappingURL=VectorSource.js.map