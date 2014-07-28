/*global define*/
define([
        '../Core/Credit',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/Event',
        '../Core/Rectangle',
        '../Core/WebMercatorTilingScheme',
        './ImageryProvider'
    ], function(
        Credit,
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        Event,
        Rectangle,
        WebMercatorTilingScheme,
        ImageryProvider) {
    "use strict";

    var trailingQMarkRegex = /\?$/;
    var defaultCredit = new Credit("OGC, http://portal.opengeospatial.org/files/?artifact_id=35326");

    /**
     * Provides tiled imagery Served by {@link http://www.opengeospatial.org/standards/wmts|WMTS 1.0.0} compliant servers
     *
     * @alias WMTSImageryProvider
     * @constructor
     *
     * @param {Object} [options] Object with the following properties:
     * @param {String} [options.url] The WMTS server url.
     * @param {String} [options.format='image/png'] The type mime for images on the server.
     * @param {String} [options.layer] The layer name for WMTS requests
     * @param {String} [options.style] The style name for WMTS requests
     * @param {String} [options.tms] The TileMatrixSetId
     * @param {TilingScheme} [options.tilingScheme] The tilingScheme corresponding to TMS definition
     * @param {Object} [options.proxy] A proxy to use for requests. This object is expected to have a getURL function which returns the proxied URL.
     * @param {Rectangle} [options.rectangle=Rectangle.MAX_VALUE] The rectangle of the layer.
     * @param {Number} [options.minimumLevel=0] The minimum level-of-detail supported by the imagery provider.
     * @param {Number} [options.maximumLevel=18] The maximum level-of-detail supported by the imagery provider.
     * @param {Credit|String} [options.credit='MapQuest, Open Street Map and contributors, CC-BY-SA'] A credit for the data source, which is displayed on the canvas.
     *
     * @see ArcGisMapServerImageryProvider
     * @see BingMapsImageryProvider
     * @see SingleTileImageryProvider
     * @see TileMapServiceImageryProvider
     * @see WebMapServiceImageryProvider
     *
     * @see {@link http://wiki.openstreetmap.org/wiki/Main_Page|OpenStreetMap Wiki}
     *
     * @example
     * // IGN French Geoportal tile provider
     * var frenchMaps= new Cesium.WMTSImageryProvider({
     *                 url : 'http://wxs.ign.fr/YOUR_KEY/geoportail/wmts',
     *                 layer : 'GEOGRAPHICALGRIDSYSTEMS.MAPS',
     *                 style : 'normal',
     *                 format : 'image/jpeg',
     *                 tms : 'PM',
     *                 credit : new Cesium.Credit("IGN", 
     *                                            "http://wxs.ign.fr/static/logos/IGN/IGN.gif", 
     *                                            "http://www.ign.fr/")
     *             }) ;
     */
    var WMTSImageryProvider = function WMTSImageryProvider(options) {
        options = defaultValue(options, {});

        if (!defined(options.url)) {
            throw new DeveloperError('options.url is required.');
        }
        if (!defined(options.layer)) {
            throw new DeveloperError('options.layer is required.');
        }
        if (!defined(options.style)) {
            throw new DeveloperError('options.style is required.');
        }
        if (!defined(options.tms)) {
            throw new DeveloperError('options.tms is required.');
        }


        this._url = options.url;
        if (!trailingQMarkRegex.test(this._url)) {
            this._url = this._url + '?';
        }

        this._layer = options.layer;
        this._style = options.style;
        this._tms = options.tms;
        this._format = defaultValue(options.format, 'image/jpg');
        this._proxy = options.proxy;
        this._tileDiscardPolicy = options.tileDiscardPolicy;

        this._tilingScheme = defaultValue(options.tilingScheme,new WebMercatorTilingScheme()) ;
        this._tileWidth = 256;
        this._tileHeight = 256;

        this._minimumLevel = defaultValue(options.minimumLevel, 0);
        this._maximumLevel = defaultValue(options.maximumLevel, 18);

        this._rectangle = defaultValue(options.rectangle, this._tilingScheme.rectangle);

        // Check the number of tiles at the minimum level.  If it's more than four,
        // throw an exception, because starting at the higher minimum
        // level will cause too many tiles to be downloaded and rendered.
        var swTile = this._tilingScheme.positionToTileXY(Rectangle.southwest(this._rectangle), this._minimumLevel);
console.log(swTile) ;
        var neTile = this._tilingScheme.positionToTileXY(Rectangle.northeast(this._rectangle), this._minimumLevel);
console.log(neTile) ;
        var tileCount = (Math.abs(neTile.x - swTile.x) + 1) * (Math.abs(neTile.y - swTile.y) + 1);
console.log(tileCount) ;
        if (tileCount > 4) {
            throw new DeveloperError('The imagery provider\'s rectangle and minimumLevel indicate that there are ' + tileCount + ' tiles at the minimum level. Imagery providers with more than four tiles at the minimum level are not supported.');
        }

        this._errorEvent = new Event();

        this._ready = true;

        var credit = defaultValue(options.credit, defaultCredit);
        if (typeof credit === 'string') {
            credit = new Credit(credit);
        }
        this._credit = credit;
    };

    function buildImageUrl(imageryProvider, col, row, level) {
        var url = imageryProvider._url + 
                  "service=WMTS&VERSION=1.0.0&request=GetTile" + 
                  "&TILEMATRIX="+ level + 
                  "&LAYER="+ imageryProvider._layer + 
                  "&STYLE="+ imageryProvider._style +
                  "&TILEROW="+ row + 
                  '&TILECOL=' + col + 
                  '&TILEMATRIXSET=' + imageryProvider._tms +
                  "&FORMAT=" + imageryProvider._format ;

        var proxy = imageryProvider._proxy;
        if (defined(proxy)) {
            url = proxy.getURL(url);
        }

        return url;
    }

    defineProperties(WMTSImageryProvider.prototype, {
        /**
         * Gets the URL of the service hosting the imagery.
         * @memberof WMTSImageryProvider.prototype
         * @type {String}
         */
        url : {
            get : function() {
                return this._url;
            }
        },

        /**
         * Gets the proxy used by this provider.
         * @memberof WMTSImageryProvider.prototype
         * @type {Proxy}
         */
        proxy : {
            get : function() {
                return this._proxy;
            }
        },

        /**
         * Gets the width of each tile, in pixels. This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {Number}
         */
        tileWidth : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('tileWidth must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._tileWidth;
            }
        },

        /**
         * Gets the height of each tile, in pixels.  This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {Number}
         */
        tileHeight: {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('tileHeight must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._tileHeight;
            }
        },

        /**
         * Gets the maximum level-of-detail that can be requested.  This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {Number}
         */
        maximumLevel : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('maximumLevel must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._maximumLevel;
            }
        },

        /**
         * Gets the minimum level-of-detail that can be requested.  This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {Number}
         */
        minimumLevel : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('minimumLevel must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._minimumLevel;
            }
        },

        /**
         * Gets the tiling scheme used by this provider.  This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {TilingScheme}
         */
        tilingScheme : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('tilingScheme must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._tilingScheme;
            }
        },

        /**
         * Gets the rectangle, in radians, of the imagery provided by this instance.  This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {Rectangle}
         */
        rectangle : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('rectangle must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._rectangle;
            }
        },

        /**
         * Gets the tile discard policy.  If not undefined, the discard policy is responsible
         * for filtering out "missing" tiles via its shouldDiscardImage function.  If this function
         * returns undefined, no tiles are filtered.  This function should
         * not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {TileDiscardPolicy}
         */
        tileDiscardPolicy : {
            get : function() {
                //>>includeStart('debug', pragmas.debug);
                if (!this._ready) {
                    throw new DeveloperError('tileDiscardPolicy must not be called before the imagery provider is ready.');
                }
                //>>includeEnd('debug');

                return this._tileDiscardPolicy;
            }
        },

        /**
         * Gets an event that is raised when the imagery provider encounters an asynchronous error.  By subscribing
         * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
         * are passed an instance of {@link TileProviderError}.
         * @memberof WMTSImageryProvider.prototype
         * @type {Event}
         */
        errorEvent : {
            get : function() {
                return this._errorEvent;
            }
        },

        /**
         * Gets a value indicating whether or not the provider is ready for use.
         * @memberof WMTSImageryProvider.prototype
         * @type {Boolean}
         */
        ready : {
            get : function() {
                return this._ready;
            }
        },

        /**
         * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
         * the source of the imagery.  This function should not be called before {@link WMTSImageryProvider#ready} returns true.
         * @memberof WMTSImageryProvider.prototype
         * @type {Credit}
         */
        credit : {
            get : function() {
                return this._credit;
            }
        },

        /**
         * Gets a value indicating whether or not the images provided by this imagery provider
         * include an alpha channel.  If this property is false, an alpha channel, if present, will
         * be ignored.  If this property is true, any images without an alpha channel will be treated
         * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
         * and texture upload time are reduced.
         * @memberof WMTSImageryProvider.prototype
         * @type {Boolean}
         */
        hasAlphaChannel : {
            get : function() {
                return true;
            }
        }
    });

    /**
     * Gets the credits to be displayed when a given tile is displayed.
     *
     * @param {Number} x The tile X coordinate.
     * @param {Number} y The tile Y coordinate.
     * @param {Number} level The tile level;
     * @returns {Credit[]} The credits to be displayed when the tile is displayed.
     *
     * @exception {DeveloperError} <code>getTileCredits</code> must not be called before the imagery provider is ready.
     */
    WMTSImageryProvider.prototype.getTileCredits = function(x, y, level) {
        return undefined;
    };

    /**
     * Requests the image for a given tile.  This function should
     * not be called before {@link WMTSImageryProvider#ready} returns true.
     *
     * @param {Number} x The tile X coordinate.
     * @param {Number} y The tile Y coordinate.
     * @param {Number} level The tile level.
     * @returns {Promise} A promise for the image that will resolve when the image is available, or
     *          undefined if there are too many active requests to the server, and the request
     *          should be retried later.  The resolved image may be either an
     *          Image or a Canvas DOM object.
     *
     * @exception {DeveloperError} <code>requestImage</code> must not be called before the imagery provider is ready.
     */
    WMTSImageryProvider.prototype.requestImage = function(x, y, level) {
        //>>includeStart('debug', pragmas.debug);
        if (!this._ready) {
            throw new DeveloperError('requestImage must not be called before the imagery provider is ready.');
        }
        //>>includeEnd('debug');

        var url = buildImageUrl(this, x, y, level);
        return ImageryProvider.loadImage(this, url);
    };

    return WMTSImageryProvider;
});
