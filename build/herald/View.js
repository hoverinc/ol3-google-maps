/**
 * @module olgm/herald/View
 */
import {transform} from 'ol/proj.js';
import {getZoomFromResolution} from '../util.js';
import {listen, unlistenByKey} from '../events.js';
import Herald from './Herald.js';
import PropertyListener from '../listener/PropertyListener.js';
import Listener from '../listener/Listener.js';

var ViewHerald = (function (Herald) {
  function ViewHerald(ol3map, gmap) {
    Herald.call(this, ol3map, gmap);

    /**
     * On window resize, the GoogleMaps map gets recentered. To avoid doing this
     * too often, a timeout is set.
     * @type {?number}
     * @private
     */
    this.windowResizeTimerId_ = null;

    /**
     * @type {?module:ol/events~EventsKey}
     * @private
     */
    this.windowListenerKey_ = null;
  }

  if ( Herald ) ViewHerald.__proto__ = Herald;
  ViewHerald.prototype = Object.create( Herald && Herald.prototype );
  ViewHerald.prototype.constructor = ViewHerald;


  /**
   * @inheritDoc
   */
  ViewHerald.prototype.activate = function activate () {
    var this$1 = this;

    Herald.prototype.activate.call(this);

    this.listener = new PropertyListener(this.ol3map, null, 'view', function (view, oldView) {
      if (oldView) {
        this$1.setRotation();
        this$1.setCenter();
        this$1.setZoom();
      }

      return new Listener([
        // listen to center change
        view.on('change:center', function () { return this$1.setCenter(); }),
        // listen to resolution change
        view.on('change:resolution', function () { return this$1.setZoom(); }),
        // listen to rotation change
        view.on('change:rotation', function () { return this$1.setRotation(); })
      ]);
    });

    // listen to browser window resize
    this.windowListenerKey_ = listen(
      window,
      'resize',
      this.handleWindowResize_,
      this,
      false);

    // Rotate and recenter the map after it's ready
    google.maps.event.addListenerOnce(this.gmap, 'idle', function () {
      this$1.setRotation();
      this$1.setCenter();
      this$1.setZoom();
    });
  };


  ViewHerald.prototype.deactivate = function deactivate () {
    Herald.prototype.deactivate.call(this);

    unlistenByKey(this.windowListenerKey_);
  };


  /**
   * Recenter the gmap map at the ol3 map center location.
   */
  ViewHerald.prototype.setCenter = function setCenter () {
    var view = this.ol3map.getView();
    var projection = view.getProjection();
    var center = view.getCenter();
    if (Array.isArray(center)) {
      var ref = transform(center, projection, 'EPSG:4326');
      var lng = ref[0];
      var lat = ref[1];
      this.gmap.setCenter(new google.maps.LatLng(lat, lng));
    }
  };


  /**
   * Rotate the gmap map like the ol3 map. The first time it is ran, the map
   * will be resized to be a square.
   */
  ViewHerald.prototype.setRotation = function setRotation () {
    var view = this.ol3map.getView();
    var rotation = view.getRotation();

    var mapDiv = this.gmap.getDiv();
    var childDiv;
    for (var i = 0; i < mapDiv.childNodes.length; i++) {
      var child = mapDiv.childNodes[i];
      if (child.nodeName === 'DIV') {
        childDiv = child;
        break;
      }
    }
    var tilesDiv = childDiv.childNodes[0];

    // If googlemaps is fully loaded
    if (tilesDiv) {

      // Rotate the div containing the map tiles
      var tilesDivStyle = tilesDiv.style;
      tilesDivStyle.transform = 'rotate(' + rotation + 'rad)';

      var width = this.ol3map.getSize()[0];
      var height = this.ol3map.getSize()[1];

      // Change the size of the rendering area to a square
      if (width != height && rotation != 0) {
        var sideSize = Math.max(width, height);
        var mapDivStyle = mapDiv.style;
        mapDivStyle.width = sideSize + 'px';
        mapDivStyle.height = sideSize + 'px';

        // Hide the overflow
        this.ol3map.getTargetElement().style.overflow = 'hidden';

        // Adjust the map's center to offset with the new size
        var diffX = width - sideSize;
        var diffY = height - sideSize;

        tilesDivStyle.top = (diffY / 2) + 'px';
        tilesDivStyle.left = (diffX / 2) + 'px';

        // Trigger a resize event
        google.maps.event.trigger(this.gmap, 'resize');

        // Replace the map
        this.setCenter();
        this.setZoom();

        // Move up the elements at the bottom of the map
        var childNodes = childDiv.childNodes;
        for (var i$1 = 0; i$1 < childNodes.length; i$1++) {
          // Set the bottom to where the overflow starts being hidden
          var style = childNodes[i$1].style;
          if (style.bottom == '0px') {
            style.bottom = Math.abs(diffY) + 'px';
          }
        }

        // Set the ol3map's viewport size to px instead of 100%
        var viewportStyle = this.ol3map.getViewport().style;
        if (viewportStyle.height == '100%') {
          viewportStyle.height = height + 'px';
        }
      }
    }
  };


  /**
   * Set the gmap map zoom level at the ol3 map view zoom level.
   */
  ViewHerald.prototype.setZoom = function setZoom () {
    var resolution = this.ol3map.getView().getResolution();
    if (typeof resolution === 'number') {
      var zoom = getZoomFromResolution(resolution);
      this.gmap.setZoom(zoom);
    }
  };


  /**
   * Called when the browser window is resized. Set the center of the GoogleMaps
   * map after a slight delay.
   * @private
   */
  ViewHerald.prototype.handleWindowResize_ = function handleWindowResize_ () {
    if (this.windowResizeTimerId_) {
      window.clearTimeout(this.windowResizeTimerId_);
    }
    this.windowResizeTimerId_ = window.setTimeout(
      this.setCenterAfterResize_.bind(this),
      100);
  };


  /**
   * Called after the browser window got resized, after a small delay.
   * Set the center of the GoogleMaps map and reset the timeout.
   * @private
   */
  ViewHerald.prototype.setCenterAfterResize_ = function setCenterAfterResize_ () {
    this.setCenter();
    this.windowResizeTimerId_ = null;
  };

  return ViewHerald;
}(Herald));
export default ViewHerald;

//# sourceMappingURL=View.js.map