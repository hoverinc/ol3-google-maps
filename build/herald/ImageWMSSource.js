/**
 * @module olgm/herald/ImageWMSSource
 */
import {getTopLeft} from 'ol/extent.js';
import {transform} from 'ol/proj.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import {assert} from '../asserts.js';
import ImageOverlay from '../gm/ImageOverlay.js';
import SorceHerald from './Source.js';
import {assign} from '../obj.js';
import {appendParams} from '../uri.js';
import PropertyListener from '../listener/PropertyListener.js';
import Listener from '../listener/Listener.js';

/**
 * @typedef {Object} LayerCache
 * @property {module:olgm/gm/ImageOverlay} imageOverlay
 * @property {string|null} lastUrl
 * @property {module:ol/layer/Image} layer
 * @property {Array<module:olgm/AbstractListener~AbstractListener>} listeners
 * @property {number} opacity
 * @property {number} zIndex
 */

var ImageWMSSourceHerald = (function (SorceHerald) {
  function ImageWMSSourceHerald(ol3map, gmap) {
    SorceHerald.call(this, ol3map, gmap);

    /**
    * @type {Array<module:olgm/herald/ImageWMSSource~LayerCache>}
    * @private
    */
    this.cache_ = [];

    /**
    * @type {Array<module:ol/layer/Image>}
    * @private
    */
    this.layers_ = [];
  }

  if ( SorceHerald ) ImageWMSSourceHerald.__proto__ = SorceHerald;
  ImageWMSSourceHerald.prototype = Object.create( SorceHerald && SorceHerald.prototype );
  ImageWMSSourceHerald.prototype.constructor = ImageWMSSourceHerald;


  /**
   * @param {module:ol/layer/Base} layer layer to watch
   * @override
   */
  ImageWMSSourceHerald.prototype.watchLayer = function watchLayer (layer) {
    var this$1 = this;

    var imageLayer = /** @type {module:ol/layer/Image} */ (layer);

    // Source must be ImageWMS
    var source = imageLayer.getSource();
    if (!(source instanceof ImageWMS)) {
      return;
    }

    this.layers_.push(imageLayer);

    // opacity
    var opacity = imageLayer.getOpacity();

    var cacheItem = /** {@type module:olgm/herald/ImageWMSSource~LayerCache} */ ({
      imageOverlay: null,
      lastUrl: null,
      layer: imageLayer,
      listeners: [],
      opacity: opacity,
      zIndex: 0
    });
    cacheItem.listeners.push(
      // Hide the google layer when the ol3 layer is invisible
      new Listener(imageLayer.on('change:visible', function () { return this$1.handleVisibleChange_(cacheItem); })),
      new Listener(this.ol3map.on('moveend', function () { return this$1.handleMoveEnd_(cacheItem); })),
      new PropertyListener(this.ol3map, null, 'view', function (view, oldView) {
        return new PropertyListener(view, oldView, 'resolution', function () { return this$1.handleMoveEnd_(cacheItem); });
      }),
      // Make sure that any change to the layer source itself also updates the
      // google maps layer
      new PropertyListener(imageLayer, null, 'source', function (source) {
        if (source) {
          this$1.handleMoveEnd_(cacheItem);
        }
        return new Listener(source.on('change', function () { return this$1.handleMoveEnd_(cacheItem); }));
      })
    );

    // Activate the cache item
    this.activateCacheItem_(cacheItem);
    this.cache_.push(cacheItem);
  };


  /**
   * Unwatch the WMS Image layer
   * @param {module:ol/layer/Base} layer layer to unwatch
   * @override
   */
  ImageWMSSourceHerald.prototype.unwatchLayer = function unwatchLayer (layer) {
    var imageLayer = /** @type {module:ol/layer/Image} */ (layer);

    var index = this.layers_.indexOf(imageLayer);
    if (index !== -1) {
      this.layers_.splice(index, 1);

      var cacheItem = this.cache_[index];
      cacheItem.forEach(function (listener) { return listener.unlisten(); });

      // Clean previous overlay
      this.resetImageOverlay_(cacheItem);

      // opacity
      imageLayer.setOpacity(cacheItem.opacity);

      this.cache_.splice(index, 1);
    }
  };


  /**
   * Activate all cache items
   * @override
   */
  ImageWMSSourceHerald.prototype.activate = function activate () {
    SorceHerald.prototype.activate.call(this);
    this.cache_.forEach(this.activateCacheItem_, this);
  };


  /**
   * Activates an image WMS layer cache item.
   * @param {module:olgm/herald/ImageWMSSource~LayerCache} cacheItem cacheItem to
   * activate
   * @private
   */
  ImageWMSSourceHerald.prototype.activateCacheItem_ = function activateCacheItem_ (cacheItem) {
    var layer = cacheItem.layer;
    var visible = layer.getVisible();
    if (visible && this.googleMapsIsActive) {
      cacheItem.lastUrl = null;
      cacheItem.layer.setOpacity(0);
      this.updateImageOverlay_(cacheItem);
    }
  };


  /**
   * Deactivate all cache items
   * @override
   */
  ImageWMSSourceHerald.prototype.deactivate = function deactivate () {
    SorceHerald.prototype.deactivate.call(this);
    this.cache_.forEach(this.deactivateCacheItem_, this);
  };


  /**
   * Deactivates an Image WMS layer cache item.
   * @param {module:olgm/herald/ImageWMSSource~LayerCache} cacheItem cacheItem to
   * deactivate
   * @private
   */
  ImageWMSSourceHerald.prototype.deactivateCacheItem_ = function deactivateCacheItem_ (cacheItem) {
    if (cacheItem.imageOverlay) {
      cacheItem.imageOverlay.setMap(null);
      cacheItem.imageOverlay = null;
    }
    cacheItem.layer.setOpacity(cacheItem.opacity);
  };


  /**
   * Generate a wms request url for a single image
   * @param {module:ol/layer/Image} layer layer to query
   * @return {string} url to the requested tile
   * @private
   */
  ImageWMSSourceHerald.prototype.generateImageWMSFunction_ = function generateImageWMSFunction_ (layer) {
    var key;
    var source = /** @type {ol.source.ImageWMS} */ (layer.getSource());

    var params = source.getParams();
    var ol3map = this.ol3map;

    //base WMS URL
    var baseUrl = /** @type {string} */ (source.getUrl());
    assert(
      baseUrl !== undefined, 'Expected the source to have an url');
    var size = ol3map.getSize();

    assert(
      size !== undefined, 'Expected the map to have a size');

    var view = ol3map.getView();
    var bbox = view.calculateExtent(size);

    // Separate original WMS params and custom ones
    var wmsParamsList = [
      'CRS',
      'BBOX',
      'FORMAT',
      'HEIGHT',
      'LAYERS',
      'REQUEST',
      'SERVICE',
      'SRS',
      'STYLES',
      'TILED',
      'TRANSPARENT',
      'VERSION',
      'WIDTH'
    ];
    var customParams = {};
    var wmsParams = {};
    for (key in params) {
      var upperCaseKey = key.toUpperCase();
      if (wmsParamsList.indexOf(upperCaseKey) === -1) {
        if (params[key] !== undefined && params[key] !== null) {
          customParams[key] = params[key];
        }
      } else {
        wmsParams[upperCaseKey] = params[key];
      }
    }

    // Set WMS params
    var version = wmsParams['VERSION'] ? wmsParams['VERSION'] : '1.3.0';
    var layers = wmsParams['LAYERS'] ? wmsParams['LAYERS'] : '';
    var styles = wmsParams['STYLES'] ? wmsParams['STYLES'] : '';
    var format = wmsParams['FORMAT'] ? wmsParams['FORMAT'] : 'image/png';
    var transparent = wmsParams['TRANSPARENT'] ?
      wmsParams['TRANSPARENT'] : 'TRUE';
    var tiled = wmsParams['TILED'] ? wmsParams['TILED'] : 'FALSE';

    // Check whether or not we're using WMS 1.3.0
    var versionNumbers = version.split('.');
    var wms13 = (
      parseInt(versionNumbers[0], 10) >= 1 &&
      parseInt(versionNumbers[1], 10) >= 3);

    var queryParams = {
      'BBOX': bbox,
      'FORMAT': format,
      'HEIGHT': size[1],
      'LAYERS': layers,
      'REQUEST': 'GetMap',
      'SERVICE': 'WMS',
      'STYLES': styles,
      'TILED': tiled,
      'TRANSPARENT': transparent,
      'VERSION': version,
      'WIDTH': size[0]
    };

    var epsg3857 = 'EPSG:3857';
    if (wms13) {
      queryParams['CRS'] = epsg3857;
    } else {
      queryParams['SRS'] = epsg3857;
    }

    assign(queryParams, customParams);

    var url = appendParams(baseUrl, queryParams);

    return url;
  };


  /**
   * Clean-up the image overlay
   * @param {module:olgm/herald/ImageWMSSource~LayerCache} cacheItem cacheItem
   * @private
   */
  ImageWMSSourceHerald.prototype.resetImageOverlay_ = function resetImageOverlay_ (cacheItem) {
    // Clean previous overlay
    if (cacheItem.imageOverlay) {
      // Remove the overlay from the map
      cacheItem.imageOverlay.setMap(null);

      // Destroy the overlay
      cacheItem.imageOverlay = null;
    }
  };


  /**
   * Refresh the custom image overlay on google maps
   * @param {module:olgm/herald/ImageWMSSource~LayerCache} cacheItem cacheItem for the
   * layer to update
   * @param {boolean=} opt_force whether we should refresh even if the
   * url for the request hasn't changed. Defaults to false.
   * @private
   */
  ImageWMSSourceHerald.prototype.updateImageOverlay_ = function updateImageOverlay_ (cacheItem, opt_force) {
    var layer = cacheItem.layer;

    if (!layer.getVisible()) {
      return;
    }

    var url = this.generateImageWMSFunction_(layer);
    var forceRefresh = opt_force == true;

    // Force a refresh by setting a new url
    if (forceRefresh) {
      url += '&timestamp=' + new Date().getTime();
    }

    // Check if we're within the accepted resolutions
    var minResolution = layer.getMinResolution();
    var maxResolution = layer.getMaxResolution();
    var currentResolution = this.ol3map.getView().getResolution();
    if (currentResolution < minResolution || currentResolution > maxResolution) {
      this.resetImageOverlay_(cacheItem);
      return;
    }

    /* We listen to both change:resolution and moveend events. However, changing
    * resolution eventually sends a moveend event as well. Using only the
    * moveend event makes zooming in/out look bad. To prevent rendering the
    * overlay twice when it happens, we save the request url, and if it's the
    * same as the last time, we don't render it.
    */
    if (url == cacheItem.lastUrl) {
      return;
    }

    cacheItem.lastUrl = url;

    // Create a new overlay
    var view = this.ol3map.getView();
    var size = this.ol3map.getSize();

    assert(
      size !== undefined, 'Expected the map to have a size');

    var extent = view.calculateExtent(size);

    // First, get the coordinates of the top left corner
    var topLeft = getTopLeft(extent);

    // Then, convert it to LatLng coordinates for google
    var lngLat = transform(topLeft, 'EPSG:3857', 'EPSG:4326');
    var topLeftLatLng = new google.maps.LatLng(lngLat[1], lngLat[0]);

    var overlay = new ImageOverlay(
      url,
      /** @type {Array<number>} */ (size),
      topLeftLatLng);
    overlay.setZIndex(cacheItem.zIndex);

    // Set the new overlay right away to give it time to render
    overlay.setMap(this.gmap);

    // Clean previous overlay
    this.resetImageOverlay_(cacheItem);

    // Save new overlay
    cacheItem.imageOverlay = overlay;
  };


  /**
   * Order the layers by index in the ol3 layers array
   * @api
   */
  ImageWMSSourceHerald.prototype.orderLayers = function orderLayers () {
    var this$1 = this;

    for (var i = 0; i < this.cache_.length; i++) {
      var cacheItem = this$1.cache_[i];
      var layer = cacheItem.layer;
      var zIndex = this$1.findIndex(layer);
      cacheItem.zIndex = zIndex;

      // There won't be an imageOverlay while Google Maps isn't visible
      if (cacheItem.imageOverlay) {
        cacheItem.imageOverlay.setZIndex(zIndex);
      }
    }
  };


  /**
   * Refresh the image overlay for each cache item
   * @api
   */
  ImageWMSSourceHerald.prototype.refresh = function refresh () {
    var this$1 = this;

    for (var i = 0; i < this.cache_.length; i++) {
      this$1.updateImageOverlay_(this$1.cache_[i], true);
    }
  };


  /**
   * Deal with the google WMS layer when we enable or disable the OL3 WMS layer
   * @param {module:olgm/herald/ImageWMSSource~LayerCache} cacheItem cacheItem for the
   * watched layer
   * @private
   */
  ImageWMSSourceHerald.prototype.handleVisibleChange_ = function handleVisibleChange_ (cacheItem) {
    var layer = cacheItem.layer;
    var visible = layer.getVisible();

    if (visible) {
      this.activateCacheItem_(cacheItem);
    } else {
      this.deactivateCacheItem_(cacheItem);
    }
  };


  /**
   * Handle the map being panned when an ImageWMS layer is present
   * @param {module:olgm/herald/ImageWMSSource~LayerCache} cacheItem cacheItem for the
   * watched layer
   * @private
   */
  ImageWMSSourceHerald.prototype.handleMoveEnd_ = function handleMoveEnd_ (cacheItem) {
    if (cacheItem.layer.getVisible() && this.ol3map.getView().getCenter()) {
      this.updateImageOverlay_(cacheItem);
    }
  };

  return ImageWMSSourceHerald;
}(SorceHerald));


export default ImageWMSSourceHerald;

//# sourceMappingURL=ImageWMSSource.js.map