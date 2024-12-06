// Original source: https://github.com/hugobarragon/leaflet-drift-marker

import L from "leaflet";

type slideOptions = {
  duration: number;
  keepAtCenter?: boolean;
};

class DriftMarker extends L.Marker {
  private _slideToUntil = 0;
  private _slideToDuration = 1000;
  private _slideToLatLng: L.LatLngExpression = [0, 0];
  private _slideFromLatLng: L.LatLngExpression = [0, 0];
  private _slideKeepAtCenter = false;
  private _slideDraggingWasAllowed = false;
  private _slideFrame = 0;

  addInitHook = () => {
    this.on("move", this.slideCancel, this);
  };

  // 🍂method slideTo(latlng: LatLng, options: Slide Options): this
  // Moves this marker until `latlng`, like `setLatLng()`, but with a smooth
  // sliding animation. Fires `movestart` and `moveend` events.
  slideTo = (latlng: L.LatLngExpression, options: slideOptions) => {
    if (!this._map) return;

    this._slideToDuration = options.duration;
    this._slideToUntil = performance.now() + options.duration;
    this._slideFromLatLng = this.getLatLng();
    this._slideToLatLng = latlng;
    this._slideKeepAtCenter = !!options.keepAtCenter;

    this._slideDraggingWasAllowed =
      this._slideDraggingWasAllowed !== undefined ? this._slideDraggingWasAllowed : this._map.dragging.enabled();

    this.slideCancel();
    this.fire("movestart");
    this._slideTo();

    return this;
  };

  // 🍂method slideCancel(): this
  // Cancels the sliding animation from `slideTo`, if applicable.
  slideCancel() {
    L.Util.cancelAnimFrame(this._slideFrame);
  }

  private _slideTo = () => {
    if (!this._map) return;

    const remaining = this._slideToUntil - performance.now();

    if (remaining < 0) {
      this.setLatLng(this._slideToLatLng);
      this.fire("moveend");
      if (this._slideDraggingWasAllowed) {
        this._map.dragging.enable();
        this._map.doubleClickZoom.enable();
        this._map.options.touchZoom = true;
        this._map.options.scrollWheelZoom = true;
      }
      this._slideDraggingWasAllowed = false;
      return this;
    }

    const startPoint = this._map.latLngToContainerPoint(this._slideFromLatLng);
    const endPoint = this._map.latLngToContainerPoint(this._slideToLatLng);
    const percentDone = (this._slideToDuration - remaining) / this._slideToDuration;

    const currPoint = endPoint.multiplyBy(percentDone).add(startPoint.multiplyBy(1 - percentDone));
    const currLatLng = this._map.containerPointToLatLng(currPoint);
    this.setLatLng(currLatLng);

    if (this._slideKeepAtCenter) {
      this._map.panTo(currLatLng, { animate: false });
    }

    this._slideFrame = L.Util.requestAnimFrame(this._slideTo, this);
  };
}

export default DriftMarker;
