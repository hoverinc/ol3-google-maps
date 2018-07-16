/**
 * @module olgm/herald/ImageWMSSource
 */
import {inherits} from 'ol/index.js';
import {getTopLeft} from 'ol/extent.js';
import {transform} from 'ol/proj.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import {unlistenAllByKey} from '../util.js';
import {assert} from '../asserts.js';
import ImageOverlay from '../gm/ImageOverlay.js';
import Source from './Source.js';
import {assign} from '../obj.js';
import {appendParams} from '../uri.js';

/**
 * Listen to a Image WMS layer
 * @param {!ol.Map} ol3map openlayers map
 * @param {!google.maps.Map} gmap google maps map
 * @constructor
 * @extends {olgm.herald.Source}
 */
const ImageWMSSource = function(ol3map, gmap) {
  /**
  * @type {Array.<olgm.herald.ImageWMSSource.LayerCache>}
  * @private
  */
  this.cache_ = [];

  /**
  * @type {Array.<ol.layer.Image>}
  * @private
  */
  this.layers_ = [];

  Source.call(this, ol3map, gmap);
};

inherits(ImageWMSSource, Source);


/**
 * @param {ol.layer.Base} layer layer to watch
 * @override
 */
ImageWMSSource.prototype.watchLayer = function(layer) {
  const imageLayer = /** @type {ol.layer.Image} */ (layer);

  // Source must be ImageWMS
  const source = imageLayer.getSource();
  if (!(source instanceof ImageWMS)) {
    return;
  }

  this.layers_.push(imageLayer);

  // opacity
  const opacity = imageLayer.getOpacity();

  const cacheItem = /** {@type olgm.herald.ImageWMSSource.LayerCache} */ ({
    imageOverlay: null,
    lastUrl: null,
    layer: imageLayer,
    listenerKeys: [],
    opacity: opacity,
    zIndex: 0
  });

  // Hide the google layer when the ol3 layer is invisible
  cacheItem.listenerKeys.push(imageLayer.on('change:visible',
    () => this.handleVisibleChange_(cacheItem)));

  cacheItem.listenerKeys.push(this.ol3map.on('moveend',
    () => this.handleMoveEnd_(cacheItem)));

  cacheItem.listenerKeys.push(this.ol3map.getView().on('change:resolution',
    () => this.handleMoveEnd_(cacheItem)));

  // Make sure that any change to the layer source itself also updates the
  // google maps layer
  cacheItem.listenerKeys.push(imageLayer.getSource().on('change',
    () => this.handleMoveEnd_(cacheItem)));

  // Activate the cache item
  this.activateCacheItem_(cacheItem);
  this.cache_.push(cacheItem);
};


/**
 * Unwatch the WMS Image layer
 * @param {ol.layer.Base} layer layer to unwatch
 * @override
 */
ImageWMSSource.prototype.unwatchLayer = function(layer) {
  const imageLayer = /** @type {ol.layer.Image} */ (layer);

  const index = this.layers_.indexOf(imageLayer);
  if (index !== -1) {
    this.layers_.splice(index, 1);

    const cacheItem = this.cache_[index];
    unlistenAllByKey(cacheItem.listenerKeys);

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
ImageWMSSource.prototype.activate = function() {
  Source.prototype.activate.call(this);
  this.cache_.forEach(this.activateCacheItem_, this);
};


/**
 * Activates an image WMS layer cache item.
 * @param {olgm.herald.ImageWMSSource.LayerCache} cacheItem cacheItem to
 * activate
 * @private
 */
ImageWMSSource.prototype.activateCacheItem_ = function(
  cacheItem) {
  const layer = cacheItem.layer;
  const visible = layer.getVisible();
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
ImageWMSSource.prototype.deactivate = function() {
  Source.prototype.deactivate.call(this);
  this.cache_.forEach(this.deactivateCacheItem_, this);
};


/**
 * Deactivates an Image WMS layer cache item.
 * @param {olgm.herald.ImageWMSSource.LayerCache} cacheItem cacheItem to
 * deactivate
 * @private
 */
ImageWMSSource.prototype.deactivateCacheItem_ = function(
  cacheItem) {
  if (cacheItem.imageOverlay) {
    cacheItem.imageOverlay.setMap(null);
    cacheItem.imageOverlay = null;
  }
  cacheItem.layer.setOpacity(cacheItem.opacity);
};


/**
 * Generate a wms request url for a single image
 * @param {ol.layer.Image} layer layer to query
 * @return {string} url to the requested tile
 * @private
 */
ImageWMSSource.prototype.generateImageWMSFunction_ = function(
  layer) {
  let key;
  const source = /** @type {ol.source.ImageWMS} */ (layer.getSource());

  const params = source.getParams();
  const ol3map = this.ol3map;

  //base WMS URL
  const baseUrl = /** @type {string} */ (source.getUrl());
  assert(
    baseUrl !== undefined, 'Expected the source to have an url');
  const size = ol3map.getSize();

  assert(
    size !== undefined, 'Expected the map to have a size');

  const view = ol3map.getView();
  const bbox = view.calculateExtent(size);

  // Separate original WMS params and custom ones
  const wmsParamsList = [
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
  const customParams = {};
  const wmsParams = {};
  for (key in params) {
    const upperCaseKey = key.toUpperCase();
    if (wmsParamsList.indexOf(upperCaseKey) === -1) {
      if (params[key] !== undefined && params[key] !== null) {
        customParams[key] = params[key];
      }
    } else {
      wmsParams[upperCaseKey] = params[key];
    }
  }

  // Set WMS params
  const version = wmsParams['VERSION'] ? wmsParams['VERSION'] : '1.3.0';
  const layers = wmsParams['LAYERS'] ? wmsParams['LAYERS'] : '';
  const styles = wmsParams['STYLES'] ? wmsParams['STYLES'] : '';
  const format = wmsParams['FORMAT'] ? wmsParams['FORMAT'] : 'image/png';
  const transparent = wmsParams['TRANSPARENT'] ?
    wmsParams['TRANSPARENT'] : 'TRUE';
  const tiled = wmsParams['TILED'] ? wmsParams['TILED'] : 'FALSE';

  // Check whether or not we're using WMS 1.3.0
  const versionNumbers = version.split('.');
  const wms13 = (
    parseInt(versionNumbers[0], 10) >= 1 &&
    parseInt(versionNumbers[1], 10) >= 3);

  const queryParams = {
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

  const epsg3857 = 'EPSG:3857';
  if (wms13) {
    queryParams['CRS'] = epsg3857;
  } else {
    queryParams['SRS'] = epsg3857;
  }

  assign(queryParams, customParams);

  const url = appendParams(baseUrl, queryParams);

  return url;
};


/**
 * Clean-up the image overlay
 * @param {olgm.herald.ImageWMSSource.LayerCache} cacheItem cacheItem
 * @private
 */
ImageWMSSource.prototype.resetImageOverlay_ = function(cacheItem) {
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
 * @param {olgm.herald.ImageWMSSource.LayerCache} cacheItem cacheItem for the
 * layer to update
 * @param {boolean=} opt_force whether we should refresh even if the
 * url for the request hasn't changed. Defaults to false.
 * @private
 */
ImageWMSSource.prototype.updateImageOverlay_ = function(
  cacheItem, opt_force) {
  const layer = cacheItem.layer;

  if (!layer.getVisible()) {
    return;
  }

  let url = this.generateImageWMSFunction_(layer);
  const forceRefresh = opt_force == true;

  // Force a refresh by setting a new url
  if (forceRefresh) {
    url += '&timestamp=' + new Date().getTime();
  }

  // Check if we're within the accepted resolutions
  const minResolution = layer.getMinResolution();
  const maxResolution = layer.getMaxResolution();
  const currentResolution = this.ol3map.getView().getResolution();
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
  const view = this.ol3map.getView();
  const size = this.ol3map.getSize();

  assert(
    size !== undefined, 'Expected the map to have a size');

  const extent = view.calculateExtent(size);

  // First, get the coordinates of the top left corner
  const topLeft = getTopLeft(extent);

  // Then, convert it to LatLng coordinates for google
  const lngLat = transform(topLeft, 'EPSG:3857', 'EPSG:4326');
  const topLeftLatLng = new google.maps.LatLng(lngLat[1], lngLat[0]);

  const overlay = new ImageOverlay(
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
ImageWMSSource.prototype.orderLayers = function() {
  for (let i = 0; i < this.cache_.length; i++) {
    const cacheItem = this.cache_[i];
    const layer = cacheItem.layer;
    const zIndex = this.findIndex(layer);
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
ImageWMSSource.prototype.refresh = function() {
  for (let i = 0; i < this.cache_.length; i++) {
    this.updateImageOverlay_(this.cache_[i], true);
  }
};


/**
 * Deal with the google WMS layer when we enable or disable the OL3 WMS layer
 * @param {olgm.herald.ImageWMSSource.LayerCache} cacheItem cacheItem for the
 * watched layer
 * @private
 */
ImageWMSSource.prototype.handleVisibleChange_ = function(
  cacheItem) {
  const layer = cacheItem.layer;
  const visible = layer.getVisible();

  if (visible) {
    this.activateCacheItem_(cacheItem);
  } else {
    this.deactivateCacheItem_(cacheItem);
  }
};


/**
 * Handle the map being panned when an ImageWMS layer is present
 * @param {olgm.herald.ImageWMSSource.LayerCache} cacheItem cacheItem for the
 * watched layer
 * @private
 */
ImageWMSSource.prototype.handleMoveEnd_ = function(
  cacheItem) {
  if (cacheItem.layer.getVisible() && this.ol3map.getView().getCenter()) {
    this.updateImageOverlay_(cacheItem);
  }
};


/**
 * @typedef {{
 *   imageOverlay: (olgm.gm.ImageOverlay),
 *   lastUrl: (string|null),
 *   layer: (ol.layer.Image),
 *   listenerKeys: (Array.<ol.EventsKey|Array.<ol.EventsKey>>),
 *   opacity: (number),
 *   zIndex: (number)
 * }}
 */
ImageWMSSource.LayerCache;
export default ImageWMSSource;
