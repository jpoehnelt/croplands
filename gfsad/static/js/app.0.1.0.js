/* Blob.js
 * A Blob implementation.
 * 2014-07-24
 *
 * By Eli Grey, http://eligrey.com
 * By Devin Samarin, https://github.com/dsamarin
 * License: X11/MIT
 *   See https://github.com/eligrey/Blob.js/blob/master/LICENSE.md
 */

/*global self, unescape */
/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,
  plusplus: true */

/*! @source http://purl.eligrey.com/github/Blob.js/blob/master/Blob.js */

(function (view) {
	"use strict";

	view.URL = view.URL || view.webkitURL;

	if (view.Blob && view.URL) {
		try {
			new Blob;
			return;
		} catch (e) {}
	}

	// Internally we use a BlobBuilder implementation to base Blob off of
	// in order to support older browsers that only have BlobBuilder
	var BlobBuilder = view.BlobBuilder || view.WebKitBlobBuilder || view.MozBlobBuilder || (function(view) {
		var
			  get_class = function(object) {
				return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
			}
			, FakeBlobBuilder = function BlobBuilder() {
				this.data = [];
			}
			, FakeBlob = function Blob(data, type, encoding) {
				this.data = data;
				this.size = data.length;
				this.type = type;
				this.encoding = encoding;
			}
			, FBB_proto = FakeBlobBuilder.prototype
			, FB_proto = FakeBlob.prototype
			, FileReaderSync = view.FileReaderSync
			, FileException = function(type) {
				this.code = this[this.name = type];
			}
			, file_ex_codes = (
				  "NOT_FOUND_ERR SECURITY_ERR ABORT_ERR NOT_READABLE_ERR ENCODING_ERR "
				+ "NO_MODIFICATION_ALLOWED_ERR INVALID_STATE_ERR SYNTAX_ERR"
			).split(" ")
			, file_ex_code = file_ex_codes.length
			, real_URL = view.URL || view.webkitURL || view
			, real_create_object_URL = real_URL.createObjectURL
			, real_revoke_object_URL = real_URL.revokeObjectURL
			, URL = real_URL
			, btoa = view.btoa
			, atob = view.atob

			, ArrayBuffer = view.ArrayBuffer
			, Uint8Array = view.Uint8Array

			, origin = /^[\w-]+:\/*\[?[\w\.:-]+\]?(?::[0-9]+)?/
		;
		FakeBlob.fake = FB_proto.fake = true;
		while (file_ex_code--) {
			FileException.prototype[file_ex_codes[file_ex_code]] = file_ex_code + 1;
		}
		// Polyfill URL
		if (!real_URL.createObjectURL) {
			URL = view.URL = function(uri) {
				var
					  uri_info = document.createElementNS("http://www.w3.org/1999/xhtml", "a")
					, uri_origin
				;
				uri_info.href = uri;
				if (!("origin" in uri_info)) {
					if (uri_info.protocol.toLowerCase() === "data:") {
						uri_info.origin = null;
					} else {
						uri_origin = uri.match(origin);
						uri_info.origin = uri_origin && uri_origin[1];
					}
				}
				return uri_info;
			};
		}
		URL.createObjectURL = function(blob) {
			var
				  type = blob.type
				, data_URI_header
			;
			if (type === null) {
				type = "application/octet-stream";
			}
			if (blob instanceof FakeBlob) {
				data_URI_header = "data:" + type;
				if (blob.encoding === "base64") {
					return data_URI_header + ";base64," + blob.data;
				} else if (blob.encoding === "URI") {
					return data_URI_header + "," + decodeURIComponent(blob.data);
				} if (btoa) {
					return data_URI_header + ";base64," + btoa(blob.data);
				} else {
					return data_URI_header + "," + encodeURIComponent(blob.data);
				}
			} else if (real_create_object_URL) {
				return real_create_object_URL.call(real_URL, blob);
			}
		};
		URL.revokeObjectURL = function(object_URL) {
			if (object_URL.substring(0, 5) !== "data:" && real_revoke_object_URL) {
				real_revoke_object_URL.call(real_URL, object_URL);
			}
		};
		FBB_proto.append = function(data/*, endings*/) {
			var bb = this.data;
			// decode data to a binary string
			if (Uint8Array && (data instanceof ArrayBuffer || data instanceof Uint8Array)) {
				var
					  str = ""
					, buf = new Uint8Array(data)
					, i = 0
					, buf_len = buf.length
				;
				for (; i < buf_len; i++) {
					str += String.fromCharCode(buf[i]);
				}
				bb.push(str);
			} else if (get_class(data) === "Blob" || get_class(data) === "File") {
				if (FileReaderSync) {
					var fr = new FileReaderSync;
					bb.push(fr.readAsBinaryString(data));
				} else {
					// async FileReader won't work as BlobBuilder is sync
					throw new FileException("NOT_READABLE_ERR");
				}
			} else if (data instanceof FakeBlob) {
				if (data.encoding === "base64" && atob) {
					bb.push(atob(data.data));
				} else if (data.encoding === "URI") {
					bb.push(decodeURIComponent(data.data));
				} else if (data.encoding === "raw") {
					bb.push(data.data);
				}
			} else {
				if (typeof data !== "string") {
					data += ""; // convert unsupported types to strings
				}
				// decode UTF-16 to binary string
				bb.push(unescape(encodeURIComponent(data)));
			}
		};
		FBB_proto.getBlob = function(type) {
			if (!arguments.length) {
				type = null;
			}
			return new FakeBlob(this.data.join(""), type, "raw");
		};
		FBB_proto.toString = function() {
			return "[object BlobBuilder]";
		};
		FB_proto.slice = function(start, end, type) {
			var args = arguments.length;
			if (args < 3) {
				type = null;
			}
			return new FakeBlob(
				  this.data.slice(start, args > 1 ? end : this.data.length)
				, type
				, this.encoding
			);
		};
		FB_proto.toString = function() {
			return "[object Blob]";
		};
		FB_proto.close = function() {
			this.size = 0;
			delete this.data;
		};
		return FakeBlobBuilder;
	}(view));

	view.Blob = function(blobParts, options) {
		var type = options ? (options.type || "") : "";
		var builder = new BlobBuilder();
		if (blobParts) {
			for (var i = 0, len = blobParts.length; i < len; i++) {
				builder.append(blobParts[i]);
			}
		}
		return builder.getBlob(type);
	};
}(typeof self !== "undefined" && self || typeof window !== "undefined" && window || this.content || this));;
/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 2014-12-17
 *
 * By Eli Grey, http://eligrey.com
 * License: X11/MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs
  // IE 10+ (native saveAs)
  || (typeof navigator !== "undefined" &&
      navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator))
  // Everyone else
  || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof navigator !== "undefined" &&
	    /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = doc.createEvent("MouseEvents");
			event.initMouseEvent(
				"click", true, false, view, 0, 0, 0, 0, 0
				, false, false, false, false, 0, null
			);
			node.dispatchEvent(event);
		}
		, webkit_req_fs = view.webkitRequestFileSystem
		, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		, fs_min_size = 0
		// See https://code.google.com/p/chromium/issues/detail?id=375297#c7 and
		// https://github.com/eligrey/FileSaver.js/commit/485930a#commitcomment-8768047
		// for the reasoning behind the timeout and revocation flow
		, arbitrary_revoke_timeout = 500 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			if (view.chrome) {
				revoker();
			} else {
				setTimeout(revoker, arbitrary_revoke_timeout);
			}
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, FileSaver = function(blob, name) {
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, blob_changed = false
				, object_url
				, target_view
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					// don't create more object URLs than needed
					if (blob_changed || !object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (target_view) {
						target_view.location.href = object_url;
					} else {
						var new_tab = view.open(object_url, "_blank");
						if (new_tab == undefined && typeof safari !== "undefined") {
							//Apple do not allow window.open, see http://bit.ly/1kZffRI
							view.location.href = object_url
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
				, abortable = function(func) {
					return function() {
						if (filesaver.readyState !== filesaver.DONE) {
							return func.apply(this, arguments);
						}
					};
				}
				, create_if_not_found = {create: true, exclusive: false}
				, slice
			;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				save_link.href = object_url;
				save_link.download = name;
				click(save_link);
				filesaver.readyState = filesaver.DONE;
				dispatch_all();
				revoke(object_url);
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			// Update: Google errantly closed 91158, I submitted it again:
			// https://code.google.com/p/chromium/issues/detail?id=389642
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function(dir) {
					var save = function() {
						dir.getFile(name, create_if_not_found, abortable(function(file) {
							file.createWriter(abortable(function(writer) {
								writer.onwriteend = function(event) {
									target_view.location.href = file.toURL();
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
									revoke(file);
								};
								writer.onerror = function() {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function(event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function() {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, {create: false}, abortable(function(file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function(ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name) {
			return new FileSaver(blob, name);
		}
	;
	FS_proto.abort = function() {
		var filesaver = this;
		filesaver.readyState = filesaver.DONE;
		dispatch(filesaver, "abort");
	};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd != null)) {
  define([], function() {
    return saveAs;
  });
};
(function () {

    "use strict";

    angular.module("leaflet-directive", []).directive('leaflet', ["$q", "leafletData", "leafletMapDefaults", "leafletHelpers", "leafletEvents", function ($q, leafletData, leafletMapDefaults, leafletHelpers, leafletEvents) {
        var _leafletMap;
        return {
            restrict: "EA",
            replace: true,
            scope: {
                center: '=center',
                defaults: '=defaults',
                maxbounds: '=maxbounds',
                bounds: '=bounds',
                markers: '=markers',
                legend: '=legend',
                geojson: '=geojson',
                paths: '=paths',
                tiles: '=tiles',
                layers: '=layers',
                controls: '=controls',
                decorations: '=decorations',
                eventBroadcast: '=eventBroadcast'
            },
            transclude: true,
            template: '<div class="angular-leaflet-map"><div ng-transclude></div></div>',
            controller: ["$scope", function ($scope) {
                _leafletMap = $q.defer();
                this.getMap = function () {
                    return _leafletMap.promise;
                };

                this.getLeafletScope = function () {
                    return $scope;
                };
            }],

            link: function (scope, element, attrs) {
                var isDefined = leafletHelpers.isDefined,
                    defaults = leafletMapDefaults.setDefaults(scope.defaults, attrs.id),
                    genDispatchMapEvent = leafletEvents.genDispatchMapEvent,
                    mapEvents = leafletEvents.getAvailableMapEvents();

                // Set width and height if they are defined
                if (isDefined(attrs.width)) {
                    if (isNaN(attrs.width)) {
                        element.css('width', attrs.width);
                    } else {
                        element.css('width', attrs.width + 'px');
                    }
                }
                if (isDefined(attrs.height)) {
                    if (isNaN(attrs.height)) {
                        element.css('height', attrs.height);
                    } else {
                        element.css('height', attrs.height + 'px');
                    }
                }

                // Create the Leaflet Map Object with the options
                var map = new L.Map(element[0], leafletMapDefaults.getMapCreationDefaults(attrs.id));
                _leafletMap.resolve(map);

                if (!isDefined(attrs.center)) {
                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                }

                // If no layers nor tiles defined, set the default tileLayer
                if (!isDefined(attrs.tiles) && (!isDefined(attrs.layers))) {
                    var tileLayerObj = L.tileLayer(defaults.tileLayer, defaults.tileLayerOptions);
                    tileLayerObj.addTo(map);
                    leafletData.setTiles(tileLayerObj, attrs.id);
                }

                // Set zoom control configuration
                if (isDefined(map.zoomControl) &&
                    isDefined(defaults.zoomControlPosition)) {
                    map.zoomControl.setPosition(defaults.zoomControlPosition);
                }

                if (isDefined(map.zoomControl) &&
                    defaults.zoomControl === false) {
                    map.zoomControl.removeFrom(map);
                }

                if (isDefined(map.zoomsliderControl) &&
                    isDefined(defaults.zoomsliderControl) &&
                    defaults.zoomsliderControl === false) {
                    map.zoomsliderControl.removeFrom(map);
                }


                // if no event-broadcast attribute, all events are broadcasted
                if (!isDefined(attrs.eventBroadcast)) {
                    var logic = "broadcast";
                    for (var i = 0; i < mapEvents.length; i++) {
                        var eventName = mapEvents[i];
                        map.on(eventName, genDispatchMapEvent(scope, eventName, logic), {
                            eventName: eventName
                        });
                    }
                }

                // Resolve the map object to the promises
                map.whenReady(function () {
                    leafletData.setMap(map, attrs.id);
                });

                scope.$on('$destroy', function () {
                    map.remove();
                    leafletData.unresolveMap(attrs.id);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('center',
        ["$log", "$q", "$location", "$timeout", "leafletMapDefaults", "leafletHelpers", "leafletBoundsHelpers", "leafletEvents", function ($log, $q, $location, $timeout, leafletMapDefaults, leafletHelpers, leafletBoundsHelpers, leafletEvents) {

            var isDefined = leafletHelpers.isDefined,
                isNumber = leafletHelpers.isNumber,
                isSameCenterOnMap = leafletHelpers.isSameCenterOnMap,
                safeApply = leafletHelpers.safeApply,
                isValidCenter = leafletHelpers.isValidCenter,
                isEmpty = leafletHelpers.isEmpty,
                isUndefinedOrEmpty = leafletHelpers.isUndefinedOrEmpty;

            var shouldInitializeMapWithBounds = function (bounds, center) {
                return (isDefined(bounds) && !isEmpty(bounds)) && isUndefinedOrEmpty(center);
            };

            var _leafletCenter;
            return {
                restrict: "A",
                scope: false,
                replace: false,
                require: 'leaflet',
                controller: function () {
                    _leafletCenter = $q.defer();
                    this.getCenter = function () {
                        return _leafletCenter.promise;
                    };
                },
                link: function (scope, element, attrs, controller) {
                    var leafletScope = controller.getLeafletScope(),
                        centerModel = leafletScope.center;

                    controller.getMap().then(function (map) {
                        var defaults = leafletMapDefaults.getDefaults(attrs.id);

                        if (attrs.center.search("-") !== -1) {
                            $log.error('The "center" variable can\'t use a "-" on his key name: "' + attrs.center + '".');
                            map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                            return;
                        } else if (shouldInitializeMapWithBounds(leafletScope.bounds, centerModel)) {
                            map.fitBounds(leafletBoundsHelpers.createLeafletBounds(leafletScope.bounds));
                            centerModel = map.getCenter();
                            safeApply(leafletScope, function (scope) {
                                scope.center = {
                                    lat: map.getCenter().lat,
                                    lng: map.getCenter().lng,
                                    zoom: map.getZoom(),
                                    autoDiscover: false
                                };
                            });
                            safeApply(leafletScope, function (scope) {
                                var mapBounds = map.getBounds();
                                var newScopeBounds = {
                                    northEast: {
                                        lat: mapBounds._northEast.lat,
                                        lng: mapBounds._northEast.lng
                                    },
                                    southWest: {
                                        lat: mapBounds._southWest.lat,
                                        lng: mapBounds._southWest.lng
                                    }
                                };
                                scope.bounds = newScopeBounds;
                            });
                        } else if (!isDefined(centerModel)) {
                            $log.error('The "center" property is not defined in the main scope');
                            map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                            return;
                        } else if (!(isDefined(centerModel.lat) && isDefined(centerModel.lng)) && !isDefined(centerModel.autoDiscover)) {
                            angular.copy(defaults.center, centerModel);
                        }

                        var urlCenterHash, mapReady;
                        if (attrs.urlHashCenter === "yes") {
                            var extractCenterFromUrl = function () {
                                var search = $location.search();
                                var centerParam;
                                if (isDefined(search.c)) {
                                    var cParam = search.c.split(":");
                                    if (cParam.length === 3) {
                                        centerParam = { lat: parseFloat(cParam[0]), lng: parseFloat(cParam[1]), zoom: parseInt(cParam[2], 10) };
                                    }
                                }
                                return centerParam;
                            };
                            urlCenterHash = extractCenterFromUrl();

                            leafletScope.$on('$locationChangeSuccess', function (event) {
                                var scope = event.currentScope;
                                //$log.debug("updated location...");
                                var urlCenter = extractCenterFromUrl();
                                if (isDefined(urlCenter) && !isSameCenterOnMap(urlCenter, map)) {
                                    //$log.debug("updating center model...", urlCenter);
                                    scope.center = {
                                        lat: urlCenter.lat,
                                        lng: urlCenter.lng,
                                        zoom: urlCenter.zoom
                                    };
                                }
                            });
                        }

                        leafletScope.$watch("center", function (center) {
                            //$log.debug("updated center model...");
                            // The center from the URL has priority
                            if (isDefined(urlCenterHash)) {
                                angular.copy(urlCenterHash, center);
                                urlCenterHash = undefined;
                            }

                            if (!isValidCenter(center) && center.autoDiscover !== true) {
                                $log.warn("[AngularJS - Leaflet] invalid 'center'");
                                //map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                                return;
                            }

                            if (center.autoDiscover === true) {
                                if (!isNumber(center.zoom)) {
                                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                                }
                                if (isNumber(center.zoom) && center.zoom > defaults.center.zoom) {
                                    map.locate({ setView: true, maxZoom: center.zoom });
                                } else if (isDefined(defaults.maxZoom)) {
                                    map.locate({ setView: true, maxZoom: defaults.maxZoom });
                                } else {
                                    map.locate({ setView: true });
                                }
                                return;
                            }

                            if (mapReady && isSameCenterOnMap(center, map)) {
                                //$log.debug("no need to update map again.");
                                return;
                            }

                            //$log.debug("updating map center...", center);
                            leafletScope.settingCenterFromScope = true;
                            map.setView([center.lat, center.lng], center.zoom);
                            leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                            $timeout(function () {
                                leafletScope.settingCenterFromScope = false;
                                //$log.debug("allow center scope updates");
                            });
                        }, true);

                        map.whenReady(function () {
                            mapReady = true;
                        });

                        map.on("moveend", function (/* event */) {
                            // Resolve the center after the first map position
                            _leafletCenter.resolve();
                            leafletEvents.notifyCenterUrlHashChanged(leafletScope, map, attrs, $location.search());
                            //$log.debug("updated center on map...");
                            if (isSameCenterOnMap(centerModel, map) || scope.settingCenterFromScope) {
                                //$log.debug("same center in model, no need to update again.");
                                return;
                            }
                            safeApply(leafletScope, function (scope) {
                                if (!leafletScope.settingCenterFromScope) {
                                    //$log.debug("updating center model...", map.getCenter(), map.getZoom());
                                    scope.center = {
                                        lat: map.getCenter().lat,
                                        lng: map.getCenter().lng,
                                        zoom: map.getZoom(),
                                        autoDiscover: false
                                    };
                                }
                                leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                            });
                        });

                        if (centerModel.autoDiscover === true) {
                            map.on("locationerror", function () {
                                $log.warn("[AngularJS - Leaflet] The Geolocation API is unauthorized on this page.");
                                if (isValidCenter(centerModel)) {
                                    map.setView([centerModel.lat, centerModel.lng], centerModel.zoom);
                                    leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                                } else {
                                    map.setView([defaults.center.lat, defaults.center.lng], defaults.center.zoom);
                                    leafletEvents.notifyCenterChangedToBounds(leafletScope, map);
                                }
                            });
                        }
                    });
                }
            };
        }]);

    angular.module("leaflet-directive").directive('tiles', ["$log", "leafletData", "leafletMapDefaults", "leafletHelpers", function ($log, leafletData, leafletMapDefaults, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    tiles = leafletScope.tiles;

                if (!isDefined(tiles) && !isDefined(tiles.url)) {
                    $log.warn("[AngularJS - Leaflet] The 'tiles' definition doesn't have the 'url' property.");
                    return;
                }

                controller.getMap().then(function (map) {
                    var defaults = leafletMapDefaults.getDefaults(attrs.id);
                    var tileLayerObj;
                    leafletScope.$watch("tiles", function (tiles) {
                        var tileLayerOptions = defaults.tileLayerOptions;
                        var tileLayerUrl = defaults.tileLayer;

                        // If no valid tiles are in the scope, remove the last layer
                        if (!isDefined(tiles.url) && isDefined(tileLayerObj)) {
                            map.removeLayer(tileLayerObj);
                            return;
                        }

                        // No leafletTiles object defined yet
                        if (!isDefined(tileLayerObj)) {
                            if (isDefined(tiles.options)) {
                                angular.copy(tiles.options, tileLayerOptions);
                            }

                            if (isDefined(tiles.url)) {
                                tileLayerUrl = tiles.url;
                            }

                            tileLayerObj = L.tileLayer(tileLayerUrl, tileLayerOptions);
                            tileLayerObj.addTo(map);
                            leafletData.setTiles(tileLayerObj, attrs.id);
                            return;
                        }

                        // If the options of the tilelayer is changed, we need to redraw the layer
                        if (isDefined(tiles.url) && isDefined(tiles.options) && !angular.equals(tiles.options, tileLayerOptions)) {
                            map.removeLayer(tileLayerObj);
                            tileLayerOptions = defaults.tileLayerOptions;
                            angular.copy(tiles.options, tileLayerOptions);
                            tileLayerUrl = tiles.url;
                            tileLayerObj = L.tileLayer(tileLayerUrl, tileLayerOptions);
                            tileLayerObj.addTo(map);
                            leafletData.setTiles(tileLayerObj, attrs.id);
                            return;
                        }

                        // Only the URL of the layer is changed, update the tiles object
                        if (isDefined(tiles.url)) {
                            tileLayerObj.setUrl(tiles.url);
                        }
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('legend', ["$log", "$http", "leafletHelpers", "leafletLegendHelpers", function ($log, $http, leafletHelpers, leafletLegendHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var isArray = leafletHelpers.isArray,
                    isDefined = leafletHelpers.isDefined,
                    isFunction = leafletHelpers.isFunction,
                    leafletScope = controller.getLeafletScope(),
                    legend = leafletScope.legend;

                var legendClass = legend.legendClass ? legend.legendClass : "legend";
                var position = legend.position || 'bottomright';
                var leafletLegend;

                controller.getMap().then(function (map) {
                    leafletScope.$watch('legend', function (legend) {
                        if (!isDefined(legend.url) && (!isArray(legend.colors) || !isArray(legend.labels) || legend.colors.length !== legend.labels.length)) {
                            $log.warn("[AngularJS - Leaflet] legend.colors and legend.labels must be set.");
                        } else if (isDefined(legend.url)) {
                            $log.info("[AngularJS - Leaflet] loading arcgis legend service.");
                        } else {
                            if (isDefined(leafletLegend)) {
                                leafletLegend.removeFrom(map);
                            }
                            leafletLegend = L.control({ position: position });
                            leafletLegend.onAdd = leafletLegendHelpers.getOnAddArrayLegend(legend, legendClass);
                            leafletLegend.addTo(map);
                        }
                    });

                    leafletScope.$watch('legend.url', function (newURL) {
                        if (!isDefined(newURL)) {
                            return;
                        }
                        $http.get(newURL)
                            .success(function (legendData) {
                                if (isDefined(leafletLegend)) {
                                    leafletLegendHelpers.updateArcGISLegend(leafletLegend.getContainer(), legendData);
                                } else {
                                    leafletLegend = L.control({ position: position });
                                    leafletLegend.onAdd = leafletLegendHelpers.getOnAddArcGISLegend(legendData, legendClass);
                                    leafletLegend.addTo(map);
                                }
                                if (isDefined(legend.loadedData) && isFunction(legend.loadedData)) {
                                    legend.loadedData();
                                }
                            })
                            .error(function () {
                                $log.warn('[AngularJS - Leaflet] legend.url not loaded.');
                            });
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('geojson', ["$log", "$rootScope", "leafletData", "leafletHelpers", function ($log, $rootScope, leafletData, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var safeApply = leafletHelpers.safeApply,
                    isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    leafletGeoJSON = {};

                controller.getMap().then(function (map) {
                    leafletScope.$watch("geojson", function (geojson) {
                        if (isDefined(leafletGeoJSON) && map.hasLayer(leafletGeoJSON)) {
                            map.removeLayer(leafletGeoJSON);
                        }

                        if (!(isDefined(geojson) && isDefined(geojson.data))) {
                            return;
                        }

                        var resetStyleOnMouseout = geojson.resetStyleOnMouseout,
                            onEachFeature = geojson.onEachFeature;

                        if (!onEachFeature) {
                            onEachFeature = function (feature, layer) {
                                if (leafletHelpers.LabelPlugin.isLoaded() && isDefined(geojson.label)) {
                                    layer.bindLabel(feature.properties.description);
                                }

                                layer.on({
                                    mouseover: function (e) {
                                        safeApply(leafletScope, function () {
                                            geojson.selected = feature;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonMouseover', e);
                                        });
                                    },
                                    mouseout: function (e) {
                                        if (resetStyleOnMouseout) {
                                            leafletGeoJSON.resetStyle(e.target);
                                        }
                                        safeApply(leafletScope, function () {
                                            geojson.selected = undefined;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonMouseout', e);
                                        });
                                    },
                                    click: function (e) {
                                        safeApply(leafletScope, function () {
                                            geojson.selected = feature;
                                            $rootScope.$broadcast('leafletDirectiveMap.geojsonClick', geojson.selected, e);
                                        });
                                    }
                                });
                            };
                        }

                        geojson.options = {
                            style: geojson.style,
                            filter: geojson.filter,
                            onEachFeature: onEachFeature,
                            pointToLayer: geojson.pointToLayer
                        };

                        leafletGeoJSON = L.geoJson(geojson.data, geojson.options);
                        leafletData.setGeoJSON(leafletGeoJSON, attrs.id);
                        leafletGeoJSON.addTo(map);
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('layers', ["$log", "$q", "leafletData", "leafletHelpers", "leafletLayerHelpers", "leafletControlHelpers", function ($log, $q, leafletData, leafletHelpers, leafletLayerHelpers, leafletControlHelpers) {
        var _leafletLayers;

        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',
            controller: function () {
                _leafletLayers = $q.defer();
                this.getLayers = function () {
                    return _leafletLayers.promise;
                };
            },
            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    leafletLayers = {},
                    leafletScope = controller.getLeafletScope(),
                    layers = leafletScope.layers,
                    createLayer = leafletLayerHelpers.createLayer,
                    updateLayersControl = leafletControlHelpers.updateLayersControl,
                    isLayersControlVisible = false;

                controller.getMap().then(function (map) {
                    // Do we have a baselayers property?
                    if (!isDefined(layers) || !isDefined(layers.baselayers) || Object.keys(layers.baselayers).length === 0) {
                        // No baselayers property
                        $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        return;
                    }

                    // We have baselayers to add to the map
                    _leafletLayers.resolve(leafletLayers);
                    leafletData.setLayers(leafletLayers, attrs.id);

                    leafletLayers.baselayers = {};
                    leafletLayers.overlays = {};

                    var mapId = attrs.id;

                    // Setup all baselayers definitions
                    var oneVisibleLayer = false;
                    for (var layerName in layers.baselayers) {
                        var newBaseLayer = createLayer(layers.baselayers[layerName]);
                        if (!isDefined(newBaseLayer)) {
                            delete layers.baselayers[layerName];
                            continue;
                        }
                        leafletLayers.baselayers[layerName] = newBaseLayer;
                        // Only add the visible layer to the map, layer control manages the addition to the map
                        // of layers in its control
                        if (layers.baselayers[layerName].top === true) {
                            map.addLayer(leafletLayers.baselayers[layerName]);
                            oneVisibleLayer = true;
                        }
                    }

                    // If there is no visible layer add first to the map
                    if (!oneVisibleLayer && Object.keys(leafletLayers.baselayers).length > 0) {
                        map.addLayer(leafletLayers.baselayers[Object.keys(layers.baselayers)[0]]);
                    }

                    // Setup the Overlays
                    for (layerName in layers.overlays) {
                        if (layers.overlays[layerName].type === 'cartodb') {

                        }
                        var newOverlayLayer = createLayer(layers.overlays[layerName]);
                        if (!isDefined(newOverlayLayer)) {
                            delete layers.overlays[layerName];
                            continue;
                        }
                        leafletLayers.overlays[layerName] = newOverlayLayer;
                        // Only add the visible overlays to the map
                        if (layers.overlays[layerName].visible === true) {
                            map.addLayer(leafletLayers.overlays[layerName]);
                        }
                    }

                    // Watch for the base layers
                    leafletScope.$watch('layers.baselayers', function (newBaseLayers) {
                        // Delete layers from the array
                        for (var name in leafletLayers.baselayers) {
                            if (!isDefined(newBaseLayers[name])) {
                                // Remove from the map if it's on it
                                if (map.hasLayer(leafletLayers.baselayers[name])) {
                                    map.removeLayer(leafletLayers.baselayers[name]);
                                }
                                delete leafletLayers.baselayers[name];
                            }
                        }
                        // add new layers
                        for (var newName in newBaseLayers) {
                            if (!isDefined(leafletLayers.baselayers[newName])) {
                                var testBaseLayer = createLayer(newBaseLayers[newName]);
                                if (isDefined(testBaseLayer)) {
                                    leafletLayers.baselayers[newName] = testBaseLayer;
                                    // Only add the visible layer to the map
                                    if (newBaseLayers[newName].top === true) {
                                        map.addLayer(leafletLayers.baselayers[newName]);
                                    }
                                }
                            }
                        }
                        if (Object.keys(leafletLayers.baselayers).length === 0) {
                            $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                            return;
                        }

                        //we have layers, so we need to make, at least, one active
                        var found = false;
                        // search for an active layer
                        for (var key in leafletLayers.baselayers) {
                            if (map.hasLayer(leafletLayers.baselayers[key])) {
                                found = true;
                                break;
                            }
                        }
                        // If there is no active layer make one active
                        if (!found) {
                            map.addLayer(leafletLayers.baselayers[Object.keys(layers.baselayers)[0]]);
                        }

                        // Only show the layers switch selector control if we have more than one baselayer + overlay
                        isLayersControlVisible = updateLayersControl(map, mapId, isLayersControlVisible, newBaseLayers, layers.overlays, leafletLayers);
                    }, true);

                    // Watch for the overlay layers
                    leafletScope.$watch('layers.overlays', function (newOverlayLayers) {
                        // Delete layers from the array
                        for (var name in leafletLayers.overlays) {
                            if (!isDefined(newOverlayLayers[name])) {
                                // Remove from the map if it's on it
                                if (map.hasLayer(leafletLayers.overlays[name])) {
                                    map.removeLayer(leafletLayers.overlays[name]);
                                }
                                // TODO: Depending on the layer type we will have to delete what's included on it
                                delete leafletLayers.overlays[name];
                            }
                        }

                        // add new overlays
                        for (var newName in newOverlayLayers) {
                            if (!isDefined(leafletLayers.overlays[newName])) {
                                var testOverlayLayer = createLayer(newOverlayLayers[newName]);
                                if (isDefined(testOverlayLayer)) {
                                    leafletLayers.overlays[newName] = testOverlayLayer;
                                    if (newOverlayLayers[newName].visible === true) {
                                        map.addLayer(leafletLayers.overlays[newName]);
                                    }
                                }
                            }// layer already exists, update options if appropriate
                            else {
                                if (newOverlayLayers[newName].layerOptions && newOverlayLayers[newName].layerOptions.opacity) {
                                    if (leafletLayers.overlays[newName].options.opacity != newOverlayLayers[newName].layerOptions.opacity) {
                                        leafletLayers.overlays[newName].setOpacity(newOverlayLayers[newName].layerOptions.opacity);
                                    }
                                }

                                if (newOverlayLayers[newName].layerOptions && newOverlayLayers[newName].layerOptions.zIndex) {
                                    if (leafletLayers.overlays.options.zIndex != newOverlayLayers[newName].layerOptions.zIndex) {
                                        leafletLayers.overlays.setZIndex(newOverlayLayers[newName].layerOptions.zIndex);
                                    }
                                }
                            }

                            // check for the .visible property to hide/show overLayers
                            if (newOverlayLayers[newName].visible && !map.hasLayer(leafletLayers.overlays[newName])) {
                                map.addLayer(leafletLayers.overlays[newName]);
                            } else if (newOverlayLayers[newName].visible === false && map.hasLayer(leafletLayers.overlays[newName])) {
                                map.removeLayer(leafletLayers.overlays[newName]);
                            }
                        }

                        // Only add the layers switch selector control if we have more than one baselayer + overlay
                        isLayersControlVisible = updateLayersControl(map, mapId, isLayersControlVisible, layers.baselayers, newOverlayLayers, leafletLayers);
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('bounds', ["$log", "$timeout", "leafletHelpers", "leafletBoundsHelpers", function ($log, $timeout, leafletHelpers, leafletBoundsHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: [ 'leaflet', 'center' ],

            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    createLeafletBounds = leafletBoundsHelpers.createLeafletBounds,
                    leafletScope = controller[0].getLeafletScope(),
                    mapController = controller[0];

                var emptyBounds = function (bounds) {
                    if (bounds._southWest.lat === 0 && bounds._southWest.lng === 0 && bounds._northEast.lat === 0 && bounds._northEast.lng === 0) {
                        return true;
                    }
                    return false;
                };

                mapController.getMap().then(function (map) {
                    leafletScope.$on('boundsChanged', function (event) {
                        var scope = event.currentScope;
                        var bounds = map.getBounds();
                        //$log.debug('updated map bounds...', bounds);
                        if (emptyBounds(bounds) || scope.settingBoundsFromScope) {
                            return;
                        }
                        var newScopeBounds = {
                            northEast: {
                                lat: bounds._northEast.lat,
                                lng: bounds._northEast.lng
                            },
                            southWest: {
                                lat: bounds._southWest.lat,
                                lng: bounds._southWest.lng
                            }
                        };
                        if (!angular.equals(scope.bounds, newScopeBounds)) {
                            //$log.debug('Need to update scope bounds.');
                            scope.bounds = newScopeBounds;
                        }
                    });
                    leafletScope.$watch('bounds', function (bounds) {
                        //$log.debug('updated bounds...', bounds);
                        if (!isDefined(bounds)) {
                            $log.error('[AngularJS - Leaflet] Invalid bounds');
                            return;
                        }
                        var leafletBounds = createLeafletBounds(bounds);
                        if (leafletBounds && !map.getBounds().equals(leafletBounds)) {
                            //$log.debug('Need to update map bounds.');
                            scope.settingBoundsFromScope = true;
                            map.fitBounds(leafletBounds);
                            $timeout(function () {
                                //$log.debug('Allow bound updates.');
                                scope.settingBoundsFromScope = false;
                            });
                        }
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('markers', ["$log", "$rootScope", "$q", "leafletData", "leafletHelpers", "leafletMapDefaults", "leafletMarkersHelpers", "leafletEvents", function ($log, $rootScope, $q, leafletData, leafletHelpers, leafletMapDefaults, leafletMarkersHelpers, leafletEvents) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: ['leaflet', '?layers'],

            link: function (scope, element, attrs, controller) {
                var mapController = controller[0],
                    Helpers = leafletHelpers,
                    isDefined = leafletHelpers.isDefined,
                    isString = leafletHelpers.isString,
                    leafletScope = mapController.getLeafletScope(),
                    deleteMarker = leafletMarkersHelpers.deleteMarker,
                    addMarkerWatcher = leafletMarkersHelpers.addMarkerWatcher,
                    listenMarkerEvents = leafletMarkersHelpers.listenMarkerEvents,
                    addMarkerToGroup = leafletMarkersHelpers.addMarkerToGroup,
                    bindMarkerEvents = leafletEvents.bindMarkerEvents,
                    createMarker = leafletMarkersHelpers.createMarker;

                mapController.getMap().then(function (map) {
                    var leafletMarkers = {},
                        getLayers;

                    // If the layers attribute is used, we must wait until the layers are created
                    if (isDefined(controller[1])) {
                        getLayers = controller[1].getLayers;
                    } else {
                        getLayers = function () {
                            var deferred = $q.defer();
                            deferred.resolve();
                            return deferred.promise;
                        };
                    }
//                    leafletMarkers.on('animationend', function () {
//                        console.log('end')
//                    })
                    getLayers().then(function (layers) {
                        leafletData.setMarkers(leafletMarkers, attrs.id);
                        leafletScope.$watch('markers', function (newMarkers) {
                            // Delete markers from the array
                            for (var name in leafletMarkers) {
                                deleteMarker(leafletMarkers[name], map, layers);
                                delete leafletMarkers[name];
                            }

                            // add new markers
                            for (var newName in newMarkers) {
                                if (newName.search("-") !== -1) {
                                    $log.error('The marker can\'t use a "-" on his key name: "' + newName + '".');
                                    continue;
                                }

                                if (!isDefined(leafletMarkers[newName])) {
                                    var markerData = newMarkers[newName];
                                    var marker = createMarker(markerData);
                                    if (!isDefined(marker)) {
                                        $log.error('[AngularJS - Leaflet] Received invalid data on the marker ' + newName + '.');
                                        continue;
                                    }
                                    leafletMarkers[newName] = marker;

                                    // Bind message
                                    if (isDefined(markerData.message)) {
                                        marker.bindPopup(markerData.message, markerData.popupOptions);
                                    }

                                    // Add the marker to a cluster group if needed
                                    if (isDefined(markerData.group)) {
                                        var groupOptions = isDefined(markerData.groupOption) ? markerData.groupOption : null;
                                        addMarkerToGroup(marker, markerData.group, groupOptions, map);
                                    }

                                    // Show label if defined
                                    if (Helpers.LabelPlugin.isLoaded() && isDefined(markerData.label) && isDefined(markerData.label.message)) {
                                        marker.bindLabel(markerData.label.message, markerData.label.options);
                                    }

                                    // Check if the marker should be added to a layer


//                                    if (isDefined(markerData) && isDefined(markerData.layer)) {
                                    if (isDefined(markerData)) {
                                        if (!isString(markerData.layer)) {
//                                            $log.error('[AngularJS - Leaflet] A layername must be a string');
                                            markerData.layer = 'locations';
                                            continue;
                                        }
                                        if (!isDefined(layers)) {
//                                            $log.error('[AngularJS - Leaflet] You must add layers to the directive if the markers are going to use this functionality.');
                                            markerData.layer = 'locations';
                                            continue;
                                        }

                                        if (!isDefined(layers.overlays) || !isDefined(layers.overlays[markerData.layer])) {
                                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group"');
                                            continue;
                                        }
                                        var layerGroup = layers.overlays[markerData.layer];
                                        if (!(layerGroup instanceof L.LayerGroup || layerGroup instanceof L.FeatureGroup)) {
                                            $log.error('[AngularJS - Leaflet] Adding a marker to an overlay needs a overlay of the type "group" or "featureGroup"');
                                            continue;
                                        }

                                        // The marker goes to a correct layer group, so first of all we add it
                                        layerGroup.addLayer(marker);

                                        // The marker is automatically added to the map depending on the visibility
                                        // of the layer, so we only have to open the popup if the marker is in the map
                                        if (map.hasLayer(marker) && markerData.focus === true) {
                                            marker.openPopup();
                                        }

                                        // Add the marker to the map if it hasn't been added to a layer or to a group
                                    } else if (!isDefined(markerData.group)) {
                                        // We do not have a layer attr, so the marker goes to the map layer
                                        map.addLayer(marker);
                                        if (markerData.focus === true) {
                                            marker.openPopup();
                                        }
                                        if (Helpers.LabelPlugin.isLoaded() && isDefined(markerData.label) && isDefined(markerData.label.options) && markerData.label.options.noHide === true) {
                                            marker.showLabel();
                                        }
                                    }

                                    // Should we watch for every specific marker on the map?
                                    var shouldWatch = (!isDefined(attrs.watchMarkers) || attrs.watchMarkers === 'true');

                                    if (shouldWatch) {
                                        addMarkerWatcher(marker, newName, leafletScope, layers, map);
                                        listenMarkerEvents(marker, markerData, leafletScope);
                                    }
                                    bindMarkerEvents(marker, newName, markerData, leafletScope);
                                }
                            }
                        }, true);
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('paths', ["$log", "$q", "leafletData", "leafletMapDefaults", "leafletHelpers", "leafletPathsHelpers", "leafletEvents", function ($log, $q, leafletData, leafletMapDefaults, leafletHelpers, leafletPathsHelpers, leafletEvents) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: ['leaflet', '?layers'],

            link: function (scope, element, attrs, controller) {
                var mapController = controller[0],
                    isDefined = leafletHelpers.isDefined,
                    isString = leafletHelpers.isString,
                    leafletScope = mapController.getLeafletScope(),
                    paths = leafletScope.paths,
                    createPath = leafletPathsHelpers.createPath,
                    bindPathEvents = leafletEvents.bindPathEvents,
                    setPathOptions = leafletPathsHelpers.setPathOptions;

                mapController.getMap().then(function (map) {
                    var defaults = leafletMapDefaults.getDefaults(attrs.id),
                        getLayers;

                    // If the layers attribute is used, we must wait until the layers are created
                    if (isDefined(controller[1])) {
                        getLayers = controller[1].getLayers;
                    } else {
                        getLayers = function () {
                            var deferred = $q.defer();
                            deferred.resolve();
                            return deferred.promise;
                        };
                    }

                    if (!isDefined(paths)) {
                        return;
                    }

                    getLayers().then(function (layers) {

                        var leafletPaths = {};
                        leafletData.setPaths(leafletPaths, attrs.id);

                        // Function for listening every single path once created
                        var watchPathFn = function (leafletPath, name) {
                            var clearWatch = leafletScope.$watch('paths.' + name, function (pathData) {
                                if (!isDefined(pathData)) {
                                    map.removeLayer(leafletPath);
                                    clearWatch();
                                    return;
                                }
                                setPathOptions(leafletPath, pathData.type, pathData);
                            }, true);
                        };

                        leafletScope.$watch("paths", function (newPaths) {

                            // Create the new paths
                            for (var newName in newPaths) {
                                if (newName.search('\\$') === 0) {
                                    continue;
                                }
                                if (newName.search("-") !== -1) {
                                    $log.error('[AngularJS - Leaflet] The path name "' + newName + '" is not valid. It must not include "-" and a number.');
                                    continue;
                                }

                                if (!isDefined(leafletPaths[newName])) {
                                    var pathData = newPaths[newName];
                                    var newPath = createPath(newName, newPaths[newName], defaults);

                                    // bind popup if defined
                                    if (isDefined(newPath) && isDefined(pathData.message)) {
                                        newPath.bindPopup(pathData.message);
                                    }

                                    // Show label if defined
                                    if (leafletHelpers.LabelPlugin.isLoaded() && isDefined(pathData.label) && isDefined(pathData.label.message)) {
                                        newPath.bindLabel(pathData.label.message, pathData.label.options);
                                    }

                                    // Check if the marker should be added to a layer
                                    if (isDefined(pathData) && isDefined(pathData.layer)) {

                                        if (!isString(pathData.layer)) {
                                            $log.error('[AngularJS - Leaflet] A layername must be a string');
                                            continue;
                                        }
                                        if (!isDefined(layers)) {
                                            $log.error('[AngularJS - Leaflet] You must add layers to the directive if the markers are going to use this functionality.');
                                            continue;
                                        }

                                        if (!isDefined(layers.overlays) || !isDefined(layers.overlays[pathData.layer])) {
                                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group"');
                                            continue;
                                        }
                                        var layerGroup = layers.overlays[pathData.layer];
                                        if (!(layerGroup instanceof L.LayerGroup || layerGroup instanceof L.FeatureGroup)) {
                                            $log.error('[AngularJS - Leaflet] Adding a marker to an overlay needs a overlay of the type "group" or "featureGroup"');
                                            continue;
                                        }

                                        // Listen for changes on the new path
                                        leafletPaths[newName] = newPath;
                                        // The path goes to a correct layer group, so first of all we add it
                                        layerGroup.addLayer(newPath);

                                        watchPathFn(newPath, newName);
                                    } else if (isDefined(newPath)) {
                                        // Listen for changes on the new path
                                        leafletPaths[newName] = newPath;
                                        map.addLayer(newPath);
                                        watchPathFn(newPath, newName);
                                    }

                                    bindPathEvents(newPath, newName, pathData, leafletScope);
                                }
                            }

                            // Delete paths (by name) from the array
                            for (var name in leafletPaths) {
                                if (!isDefined(newPaths[name])) {
                                    delete leafletPaths[name];
                                }
                            }

                        }, true);

                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('controls', ["$log", "leafletHelpers", function ($log, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: '?^leaflet',

            link: function (scope, element, attrs, controller) {
                if (!controller) {
                    return;
                }

                var isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    controls = leafletScope.controls;

                controller.getMap().then(function (map) {
                    if (isDefined(L.Control.Draw) && isDefined(controls.draw)) {
                        var drawnItems = new L.FeatureGroup();
                        var options = {
                            edit: {
                                featureGroup: drawnItems
                            }
                        };
                        angular.extend(options, controls.draw);
                        controls.draw = options;
                        map.addLayer(options.edit.featureGroup);

                        var drawControl = new L.Control.Draw(options);
                        map.addControl(drawControl);
                    }

                    if (isDefined(controls.custom)) {
                        for (var i in controls.custom) {
                            map.addControl(controls.custom[i]);
                        }
                    }
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('eventBroadcast', ["$log", "$rootScope", "leafletHelpers", "leafletEvents", function ($log, $rootScope, leafletHelpers, leafletEvents) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var isObject = leafletHelpers.isObject,
                    leafletScope = controller.getLeafletScope(),
//                eventBroadcast = leafletScope.eventBroadcast,
                    availableMapEvents = leafletEvents.getAvailableMapEvents(),
                    genDispatchMapEvent = leafletEvents.genDispatchMapEvent;

                controller.getMap().then(function (map) {
                    leafletScope.$watch("eventBroadcast", function (eventBroadcast) {

                        var mapEvents = [];
                        var i;
                        var eventName;
                        var logic = "broadcast";

                        if (isObject(eventBroadcast)) {
                            // We have a possible valid object
                            if (eventBroadcast.map === undefined || eventBroadcast.map === null) {
                                // We do not have events enable/disable do we do nothing (all enabled by default)
                                mapEvents = availableMapEvents;
                            } else if (typeof eventBroadcast.map !== 'object') {
                                // Not a valid object
                                $log.warn("[AngularJS - Leaflet] event-broadcast.map must be an object check your model.");
                            } else {
                                // We have a possible valid map object
                                // Event propadation logic
                                if (eventBroadcast.map.logic !== undefined && eventBroadcast.map.logic !== null) {
                                    // We take care of possible propagation logic
                                    if (eventBroadcast.map.logic !== "emit" && eventBroadcast.map.logic !== "broadcast") {
                                        // This is an error
                                        $log.warn("[AngularJS - Leaflet] Available event propagation logic are: 'emit' or 'broadcast'.");
                                    } else if (eventBroadcast.map.logic === "emit") {
                                        logic = "emit";
                                    }
                                }
                                // Enable / Disable
                                var mapEventsEnable = false, mapEventsDisable = false;
                                if (eventBroadcast.map.enable !== undefined && eventBroadcast.map.enable !== null) {
                                    if (typeof eventBroadcast.map.enable === 'object') {
                                        mapEventsEnable = true;
                                    }
                                }
                                if (eventBroadcast.map.disable !== undefined && eventBroadcast.map.disable !== null) {
                                    if (typeof eventBroadcast.map.disable === 'object') {
                                        mapEventsDisable = true;
                                    }
                                }
                                if (mapEventsEnable && mapEventsDisable) {
                                    // Both are active, this is an error
                                    $log.warn("[AngularJS - Leaflet] can not enable and disable events at the time");
                                } else if (!mapEventsEnable && !mapEventsDisable) {
                                    // Both are inactive, this is an error
                                    $log.warn("[AngularJS - Leaflet] must enable or disable events");
                                } else {
                                    // At this point the map object is OK, lets enable or disable events
                                    if (mapEventsEnable) {
                                        // Enable events
                                        for (i = 0; i < eventBroadcast.map.enable.length; i++) {
                                            eventName = eventBroadcast.map.enable[i];
                                            // Do we have already the event enabled?
                                            if (mapEvents.indexOf(eventName) !== -1) {
                                                // Repeated event, this is an error
                                                $log.warn("[AngularJS - Leaflet] This event " + eventName + " is already enabled");
                                            } else {
                                                // Does the event exists?
                                                if (availableMapEvents.indexOf(eventName) === -1) {
                                                    // The event does not exists, this is an error
                                                    $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist");
                                                } else {
                                                    // All ok enable the event
                                                    mapEvents.push(eventName);
                                                }
                                            }
                                        }
                                    } else {
                                        // Disable events
                                        mapEvents = availableMapEvents;
                                        for (i = 0; i < eventBroadcast.map.disable.length; i++) {
                                            eventName = eventBroadcast.map.disable[i];
                                            var index = mapEvents.indexOf(eventName);
                                            if (index === -1) {
                                                // The event does not exist
                                                $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist or has been already disabled");
                                            } else {
                                                mapEvents.splice(index, 1);
                                            }
                                        }
                                    }
                                }
                            }

                            for (i = 0; i < mapEvents.length; i++) {
                                eventName = mapEvents[i];
                                map.on(eventName, genDispatchMapEvent(leafletScope, eventName, logic), {
                                    eventName: eventName
                                });
                            }
                        } else {
                            // Not a valid object
                            $log.warn("[AngularJS - Leaflet] event-broadcast must be an object, check your model.");
                        }
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive('maxbounds', ["$log", "leafletMapDefaults", "leafletBoundsHelpers", function ($log, leafletMapDefaults, leafletBoundsHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var leafletScope = controller.getLeafletScope(),
                    isValidBounds = leafletBoundsHelpers.isValidBounds;


                controller.getMap().then(function (map) {
                    leafletScope.$watch("maxbounds", function (maxbounds) {
                        if (!isValidBounds(maxbounds)) {
                            // Unset any previous maxbounds
                            map.setMaxBounds();
                            return;
                        }
                        var bounds = [
                            [ maxbounds.southWest.lat, maxbounds.southWest.lng ],
                            [ maxbounds.northEast.lat, maxbounds.northEast.lng ]
                        ];
                        map.setMaxBounds(bounds);

                        if (!attrs.center) {
                            map.fitBounds(bounds);
                        }
                    });
                });
            }
        };
    }]);

    angular.module("leaflet-directive").directive("decorations", ["$log", "leafletHelpers", function ($log, leafletHelpers) {
        return {
            restrict: "A",
            scope: false,
            replace: false,
            require: 'leaflet',

            link: function (scope, element, attrs, controller) {
                var leafletScope = controller.getLeafletScope(),
                    PolylineDecoratorPlugin = leafletHelpers.PolylineDecoratorPlugin,
                    isDefined = leafletHelpers.isDefined,
                    leafletDecorations = {};

                /* Creates an "empty" decoration with a set of coordinates, but no pattern. */
                function createDecoration(options) {
                    if (isDefined(options) && isDefined(options.coordinates)) {
                        if (!PolylineDecoratorPlugin.isLoaded()) {
                            $log.error('[AngularJS - Leaflet] The PolylineDecorator Plugin is not loaded.');
                        }
                    }

                    return L.polylineDecorator(options.coordinates);
                }

                /* Updates the path and the patterns for the provided decoration, and returns the decoration. */
                function setDecorationOptions(decoration, options) {
                    if (isDefined(decoration) && isDefined(options)) {
                        if (isDefined(options.coordinates) && isDefined(options.patterns)) {
                            decoration.setPaths(options.coordinates);
                            decoration.setPatterns(options.patterns);
                            return decoration;
                        }
                    }
                }

                controller.getMap().then(function (map) {
                    leafletScope.$watch("decorations", function (newDecorations) {
                        for (var name in leafletDecorations) {
                            if (!isDefined(newDecorations) || !isDefined(newDecorations[name])) {
                                delete leafletDecorations[name];
                            }
                            map.removeLayer(leafletDecorations[name]);
                        }

                        for (var newName in newDecorations) {
                            var decorationData = newDecorations[newName],
                                newDecoration = createDecoration(decorationData);

                            if (isDefined(newDecoration)) {
                                leafletDecorations[newName] = newDecoration;
                                map.addLayer(newDecoration);
                                setDecorationOptions(newDecoration, decorationData);
                            }
                        }
                    }, true);
                });
            }
        };
    }]);
    angular.module("leaflet-directive").directive('layercontrol', ["$log", "leafletData", "leafletHelpers", function ($log, leafletData, leafletHelpers) {
        return {
            restrict: "E",
            scope: {
            },
            replace: true,
            transclude: false,
            require: '^leaflet',
            controller: ["$scope", "$element", "$sce", function ($scope, $element, $sce) {
                $log.debug('[Angular Directive - Layers] layers', $scope, $element);
                var safeApply = leafletHelpers.safeApply,
                    isDefined = leafletHelpers.isDefined;
                angular.extend($scope, {
                    baselayer: '',
                    icons: {
                        uncheck: 'fa fa-check-square-o',
                        check: 'fa fa-square-o',
                        radio: 'fa fa-dot-circle-o',
                        unradio: 'fa fa-circle-o',
                        up: 'fa fa-angle-up',
                        down: 'fa fa-angle-down',
                        open: 'fa fa-angle-double-down',
                        close: 'fa fa-angle-double-up'
                    },
                    changeBaseLayer: function (key, e) {
                        leafletHelpers.safeApply($scope, function (scp) {
                            scp.baselayer = key;
                            leafletData.getMap().then(function (map) {
                                leafletData.getLayers().then(function (leafletLayers) {
                                    if (map.hasLayer(leafletLayers.baselayers[key])) {
                                        return;
                                    }
                                    for (var i in scp.layers.baselayers) {
                                        scp.layers.baselayers[i].icon = scp.icons.unradio;
                                        if (map.hasLayer(leafletLayers.baselayers[i])) {
                                            map.removeLayer(leafletLayers.baselayers[i]);
                                        }
                                    }
                                    map.addLayer(leafletLayers.baselayers[key]);
                                    scp.layers.baselayers[key].icon = $scope.icons.radio;
                                });
                            });
                        });
                        e.preventDefault();
                    },
                    moveLayer: function (ly, newIndex, e) {
                        var delta = Object.keys($scope.layers.baselayers).length;
                        if (newIndex >= (1 + delta) && newIndex <= ($scope.overlaysArray.length + delta)) {
                            var oldLy;
                            for (var key in $scope.layers.overlays) {
                                if ($scope.layers.overlays[key].index === newIndex) {
                                    oldLy = $scope.layers.overlays[key];
                                    break;
                                }
                            }
                            if (oldLy) {
                                safeApply($scope, function () {
                                    oldLy.index = ly.index;
                                    ly.index = newIndex;
                                });
                            }
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    },
                    initIndex: function (layer, idx) {
                        var delta = Object.keys($scope.layers.baselayers).length;
                        layer.index = isDefined(layer.index) ? layer.index : idx + delta + 1;
                    },
                    toggleOpacity: function (e, layer) {
                        $log.debug('Event', e);
                        if (layer.visible) {
                            var el = angular.element(e.currentTarget);
                            el.toggleClass($scope.icons.close + ' ' + $scope.icons.open);
                            el = el.parents('.lf-row').find('.lf-opacity');
                            el.toggle('fast', function () {
                                safeApply($scope, function () {
                                    layer.opacityControl = !layer.opacityControl;
                                });
                            });
                        }
                        e.stopPropagation();
                        e.preventDefault();
                    },
                    unsafeHTML: function (html) {
                        return $sce.trustAsHtml(html);
                    }
                });

                var div = $element.get(0);
                if (!L.Browser.touch) {
                    L.DomEvent.disableClickPropagation(div);
                    L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
                } else {
                    L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
                }
            }],
            template: '<div class="angular-leaflet-control-layers" ng-show="overlaysArray.length">' +
                '<div class="lf-baselayers">' +
                '<div class="lf-row" ng-repeat="(key, layer) in layers.baselayers">' +
                '<label class="lf-icon-bl" ng-click="changeBaseLayer(key, $event)">' +
                '<input class="leaflet-control-layers-selector" type="radio" name="lf-radio" ' +
                'ng-show="false" ng-checked="baselayer === key" ng-value="key" /> ' +
                '<i class="lf-icon lf-icon-radio" ng-class="layer.icon"></i>' +
                '<div class="lf-text">{{layer.name}}</div>' +
                '</label>' +
                '</div>' +
                '</div>' +
                '<div class="lf-overlays">' +
                '<div class="lf-container">' +
                '<div class="lf-row" ng-repeat="layer in overlaysArray | orderBy:\'index\':order" ng-init="initIndex(layer, $index)">' +
                '<label class="lf-icon-ol">' +
                '<input class="lf-control-layers-selector" type="checkbox" ng-show="false" ng-model="layer.visible"/> ' +
                '<i class="lf-icon lf-icon-check" ng-class="layer.icon"></i>' +
                '<div class="lf-text">{{layer.name}}</div>' +
                '<div class="lf-icons">' +
                '<i class="lf-icon lf-up" ng-class="icons.up" ng-click="moveLayer(layer, layer.index - orderNumber, $event)"></i> ' +
                '<i class="lf-icon lf-down" ng-class="icons.down" ng-click="moveLayer(layer, layer.index + orderNumber, $event)"></i> ' +
                '<i class="lf-icon lf-open" ng-class="layer.opacityControl? icons.close:icons.open" ng-click="toggleOpacity($event, layer)"></i>' +
                '</div>' +
                '</label>' +
                '<div class="lf-legend" ng-if="layer.legend" ng-bind-html="unsafeHTML(layer.legend)"></div>' +
                '<div class="lf-opacity" ng-show="layer.visible &amp;&amp; layer.opacityControl">' +
                '<input type="text" class="lf-opacity-control" name="lf-opacity-control" data-key="{{layer.index}}" />' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>',
            link: function (scope, element, attrs, controller) {
                var isDefined = leafletHelpers.isDefined,
                    leafletScope = controller.getLeafletScope(),
                    layers = leafletScope.layers;

                // Setting layer stack order.
                attrs.order = (isDefined(attrs.order) && (attrs.order === 'normal' || attrs.order === 'reverse')) ? attrs.order : 'normal';
                scope.order = attrs.order === 'normal';
                scope.orderNumber = attrs.order === 'normal' ? -1 : 1;

                scope.layers = layers;
                controller.getMap().then(function (map) {
                    // Do we have a baselayers property?
                    if (!isDefined(layers) || !isDefined(layers.baselayers) || Object.keys(layers.baselayers).length === 0) {
                        // No baselayers property
                        $log.error('[AngularJS - Leaflet] At least one baselayer has to be defined');
                        return;
                    }

                    leafletScope.$watch('layers.baselayers', function (newBaseLayers) {
                        leafletData.getLayers().then(function (leafletLayers) {
                            var key;
                            for (key in newBaseLayers) {
                                if (map.hasLayer(leafletLayers.baselayers[key])) {
                                    newBaseLayers[key].icon = scope.icons.radio;
                                } else {
                                    newBaseLayers[key].icon = scope.icons.unradio;
                                }
                            }
                        });
                    });

                    leafletScope.$watch('layers.overlays', function (newOverlayLayers) {
                        var overlaysArray = [];
                        leafletData.getLayers().then(function (leafletLayers) {
                            for (var key in newOverlayLayers) {
                                newOverlayLayers[key].icon = scope.icons[(newOverlayLayers[key].visible ? 'uncheck' : 'check')];
                                overlaysArray.push(newOverlayLayers[key]);
                                if (isDefined(newOverlayLayers[key].index) && leafletLayers.overlays[key].setZIndex) {
                                    leafletLayers.overlays[key].setZIndex(newOverlayLayers[key].index);
                                }
                            }
                        });

                        var unreg = scope.$watch(function () {
                            if (element.children().size() > 1) {
                                element.find('.lf-overlays').trigger('resize');
                                return element.find('.lf-opacity').size() === Object.keys(layers.overlays).length;
                            }
                        }, function (el) {
                            if (el === true) {
                                if (isDefined(element.find('.lf-opacity-control').ionRangeSlider)) {
                                    element.find('.lf-opacity-control').each(function (idx, inp) {
                                        var delta = Object.keys(layers.baselayers).length,
                                            lyAux;
                                        for (var key in scope.overlaysArray) {
                                            if (scope.overlaysArray[key].index === idx + delta + 1) {
                                                lyAux = scope.overlaysArray[key];
                                            }
                                        }

                                        var input = angular.element(inp),
                                            op = isDefined(lyAux) && isDefined(lyAux.layerOptions) ?
                                                lyAux.layerOptions.opacity : undefined;
                                        input.ionRangeSlider({
                                            min: 0,
                                            from: isDefined(op) ? Math.ceil(op * 100) : 100,
                                            step: 1,
                                            max: 100,
                                            prettify: false,
                                            hasGrid: false,
                                            hideMinMax: true,
                                            onChange: function (val) {
                                                leafletData.getLayers().then(function (leafletLayers) {
                                                    var key = val.input.data().key;
                                                    var ly, layer;
                                                    for (var k in layers.overlays) {
                                                        if (layers.overlays[k].index === key) {
                                                            ly = leafletLayers.overlays[k];
                                                            layer = layers.overlays[k];
                                                            break;
                                                        }
                                                    }
                                                    if (map.hasLayer(ly)) {
                                                        layer.layerOptions = isDefined(layer.layerOptions) ? layer.layerOptions : {};
                                                        layer.layerOptions.opacity = val.input.val() / 100;
                                                        if (ly.setOpacity) {
                                                            ly.setOpacity(val.input.val() / 100);
                                                        }
                                                        if (ly.getLayers && ly.eachLayer) {
                                                            ly.eachLayer(function (lay) {
                                                                if (lay.setOpacity) {
                                                                    lay.setOpacity(val.input.val() / 100);
                                                                }
                                                            });
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    });
                                } else {
                                    $log.warn('[AngularJS - Leaflet] Ion Slide Range Plugin is not loaded');
                                }
                                unreg();
                            }
                        });

                        scope.overlaysArray = overlaysArray;
                    }, true);
                });
            }
        };
    }]);

    angular.module("leaflet-directive").service('leafletData', ["$log", "$q", "leafletHelpers", function ($log, $q, leafletHelpers) {
        var getDefer = leafletHelpers.getDefer,
            getUnresolvedDefer = leafletHelpers.getUnresolvedDefer,
            setResolvedDefer = leafletHelpers.setResolvedDefer;

        var maps = {};
        var tiles = {};
        var layers = {};
        var paths = {};
        var markers = {};
        var geoJSON = {};
        var utfGrid = {};
        var decorations = {};

        this.setMap = function (leafletMap, scopeId) {
            var defer = getUnresolvedDefer(maps, scopeId);
            defer.resolve(leafletMap);
            setResolvedDefer(maps, scopeId);
        };

        this.getMap = function (scopeId) {
            var defer = getDefer(maps, scopeId);
            return defer.promise;
        };

        this.unresolveMap = function (scopeId) {
            var id = leafletHelpers.obtainEffectiveMapId(maps, scopeId);
            maps[id] = undefined;
        };

        this.getPaths = function (scopeId) {
            var defer = getDefer(paths, scopeId);
            return defer.promise;
        };

        this.setPaths = function (leafletPaths, scopeId) {
            var defer = getUnresolvedDefer(paths, scopeId);
            defer.resolve(leafletPaths);
            setResolvedDefer(paths, scopeId);
        };

        this.getMarkers = function (scopeId) {
            var defer = getDefer(markers, scopeId);
            return defer.promise;
        };

        this.setMarkers = function (leafletMarkers, scopeId) {
            var defer = getUnresolvedDefer(markers, scopeId);
            defer.resolve(leafletMarkers);
            setResolvedDefer(markers, scopeId);
        };

        this.getLayers = function (scopeId) {
            var defer = getDefer(layers, scopeId);
            return defer.promise;
        };

        this.setLayers = function (leafletLayers, scopeId) {
            var defer = getUnresolvedDefer(layers, scopeId);
            defer.resolve(leafletLayers);
            setResolvedDefer(layers, scopeId);
        };

        this.getUTFGrid = function (scopeId) {
            var defer = getDefer(utfGrid, scopeId);
            return defer.promise;
        };

        this.setUTFGrid = function (leafletUTFGrid, scopeId) {
            var defer = getUnresolvedDefer(utfGrid, scopeId);
            defer.resolve(leafletUTFGrid);
            setResolvedDefer(utfGrid, scopeId);
        };

        this.setTiles = function (leafletTiles, scopeId) {
            var defer = getUnresolvedDefer(tiles, scopeId);
            defer.resolve(leafletTiles);
            setResolvedDefer(tiles, scopeId);
        };

        this.getTiles = function (scopeId) {
            var defer = getDefer(tiles, scopeId);
            return defer.promise;
        };

        this.setGeoJSON = function (leafletGeoJSON, scopeId) {
            var defer = getUnresolvedDefer(geoJSON, scopeId);
            defer.resolve(leafletGeoJSON);
            setResolvedDefer(geoJSON, scopeId);
        };

        this.getGeoJSON = function (scopeId) {
            var defer = getDefer(geoJSON, scopeId);
            return defer.promise;
        };

        this.setDecorations = function (leafletDecorations, scopeId) {
            var defer = getUnresolvedDefer(decorations, scopeId);
            defer.resolve(leafletDecorations);
            setResolvedDefer(decorations, scopeId);
        };

        this.getDecorations = function (scopeId) {
            var defer = getDefer(decorations, scopeId);
            return defer.promise;
        };
    }]);

    angular.module("leaflet-directive").factory('leafletMapDefaults', ["$q", "leafletHelpers", function ($q, leafletHelpers) {
        function _getDefaults() {
            return {
                keyboard: true,
                dragging: true,
                worldCopyJump: false,
                doubleClickZoom: true,
                scrollWheelZoom: true,
                touchZoom: true,
                zoomControl: true,
                zoomsliderControl: false,
                zoomControlPosition: 'topleft',
                attributionControl: true,
                controls: {
                    layers: {
                        visible: true,
                        position: 'topright',
                        collapsed: true
                    }
                },
                crs: L.CRS.EPSG3857,
                tileLayer: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                tileLayerOptions: {
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                },
                path: {
                    weight: 10,
                    opacity: 1,
                    color: '#0000ff'
                },
                center: {
                    lat: 0,
                    lng: 0,
                    zoom: 1
                }
            };
        }

        var isDefined = leafletHelpers.isDefined,
            isObject = leafletHelpers.isObject,
            obtainEffectiveMapId = leafletHelpers.obtainEffectiveMapId,
            defaults = {};

        // Get the _defaults dictionary, and override the properties defined by the user
        return {
            getDefaults: function (scopeId) {
                var mapId = obtainEffectiveMapId(defaults, scopeId);
                return defaults[mapId];
            },

            getMapCreationDefaults: function (scopeId) {
                var mapId = obtainEffectiveMapId(defaults, scopeId);
                var d = defaults[mapId];

                var mapDefaults = {
                    maxZoom: d.maxZoom,
                    keyboard: d.keyboard,
                    dragging: d.dragging,
                    zoomControl: d.zoomControl,
                    doubleClickZoom: d.doubleClickZoom,
                    scrollWheelZoom: d.scrollWheelZoom,
                    touchZoom: d.touchZoom,
                    attributionControl: d.attributionControl,
                    worldCopyJump: d.worldCopyJump,
                    crs: d.crs
                };

                if (isDefined(d.minZoom)) {
                    mapDefaults.minZoom = d.minZoom;
                }

                if (isDefined(d.zoomAnimation)) {
                    mapDefaults.zoomAnimation = d.zoomAnimation;
                }

                if (isDefined(d.fadeAnimation)) {
                    mapDefaults.fadeAnimation = d.fadeAnimation;
                }

                if (isDefined(d.markerZoomAnimation)) {
                    mapDefaults.markerZoomAnimation = d.markerZoomAnimation;
                }

                if (d.map) {
                    for (var option in d.map) {
                        mapDefaults[option] = d.map[option];
                    }
                }

                return mapDefaults;
            },

            setDefaults: function (userDefaults, scopeId) {
                var newDefaults = _getDefaults();

                if (isDefined(userDefaults)) {
                    newDefaults.doubleClickZoom = isDefined(userDefaults.doubleClickZoom) ? userDefaults.doubleClickZoom : newDefaults.doubleClickZoom;
                    newDefaults.scrollWheelZoom = isDefined(userDefaults.scrollWheelZoom) ? userDefaults.scrollWheelZoom : newDefaults.doubleClickZoom;
                    newDefaults.touchZoom = isDefined(userDefaults.touchZoom) ? userDefaults.touchZoom : newDefaults.doubleClickZoom;
                    newDefaults.zoomControl = isDefined(userDefaults.zoomControl) ? userDefaults.zoomControl : newDefaults.zoomControl;
                    newDefaults.zoomsliderControl = isDefined(userDefaults.zoomsliderControl) ? userDefaults.zoomsliderControl : newDefaults.zoomsliderControl;
                    newDefaults.attributionControl = isDefined(userDefaults.attributionControl) ? userDefaults.attributionControl : newDefaults.attributionControl;
                    newDefaults.tileLayer = isDefined(userDefaults.tileLayer) ? userDefaults.tileLayer : newDefaults.tileLayer;
                    newDefaults.zoomControlPosition = isDefined(userDefaults.zoomControlPosition) ? userDefaults.zoomControlPosition : newDefaults.zoomControlPosition;
                    newDefaults.keyboard = isDefined(userDefaults.keyboard) ? userDefaults.keyboard : newDefaults.keyboard;
                    newDefaults.dragging = isDefined(userDefaults.dragging) ? userDefaults.dragging : newDefaults.dragging;

                    if (isDefined(userDefaults.controls)) {
                        angular.extend(newDefaults.controls, userDefaults.controls);
                    }

                    if (isObject(userDefaults.crs)) {
                        newDefaults.crs = userDefaults.crs;
                    } else if (isDefined(L.CRS[userDefaults.crs])) {
                        newDefaults.crs = L.CRS[userDefaults.crs];
                    }

                    if (isDefined(userDefaults.tileLayerOptions)) {
                        angular.copy(userDefaults.tileLayerOptions, newDefaults.tileLayerOptions);
                    }

                    if (isDefined(userDefaults.maxZoom)) {
                        newDefaults.maxZoom = userDefaults.maxZoom;
                    }

                    if (isDefined(userDefaults.minZoom)) {
                        newDefaults.minZoom = userDefaults.minZoom;
                    }

                    if (isDefined(userDefaults.zoomAnimation)) {
                        newDefaults.zoomAnimation = userDefaults.zoomAnimation;
                    }

                    if (isDefined(userDefaults.fadeAnimation)) {
                        newDefaults.fadeAnimation = userDefaults.fadeAnimation;
                    }

                    if (isDefined(userDefaults.markerZoomAnimation)) {
                        newDefaults.markerZoomAnimation = userDefaults.markerZoomAnimation;
                    }

                    if (isDefined(userDefaults.worldCopyJump)) {
                        newDefaults.worldCopyJump = userDefaults.worldCopyJump;
                    }

                    if (isDefined(userDefaults.map)) {
                        newDefaults.map = userDefaults.map;
                    }
                }

                var mapId = obtainEffectiveMapId(defaults, scopeId);
                defaults[mapId] = newDefaults;
                return newDefaults;
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletEvents', ["$rootScope", "$q", "$log", "leafletHelpers", function ($rootScope, $q, $log, leafletHelpers) {
        var safeApply = leafletHelpers.safeApply,
            isDefined = leafletHelpers.isDefined,
            isObject = leafletHelpers.isObject,
            Helpers = leafletHelpers;

        var _getAvailableLabelEvents = function () {
            return [
                'click',
                'dblclick',
                'mousedown',
                'mouseover',
                'mouseout',
                'contextmenu'
            ];
        };

        var genLabelEvents = function (leafletScope, logic, marker, name) {
            var labelEvents = _getAvailableLabelEvents();
            var scopeWatchName = "markers." + name;
            for (var i = 0; i < labelEvents.length; i++) {
                var eventName = labelEvents[i];
                marker.label.on(eventName, genDispatchLabelEvent(leafletScope, eventName, logic, marker.label, scopeWatchName));
            }
        };

        var genDispatchMarkerEvent = function (eventName, logic, leafletScope, marker, name, markerData) {
            return function (e) {
                var broadcastName = 'leafletDirectiveMarker.' + eventName;

                // Broadcast old marker click name for backwards compatibility
                if (eventName === "click") {
                    safeApply(leafletScope, function () {
                        $rootScope.$broadcast('leafletDirectiveMarkersClick', name);
                    });
                } else if (eventName === 'dragend') {
                    safeApply(leafletScope, function () {
                        markerData.lat = marker.getLatLng().lat;
                        markerData.lng = marker.getLatLng().lng;
                    });
                    if (markerData.message && markerData.focus === true) {
                        marker.openPopup();
                    }
                }

                safeApply(leafletScope, function (scope) {
                    if (logic === "emit") {
                        scope.$emit(broadcastName, {
                            markerName: name,
                            leafletEvent: e
                        });
                    } else {
                        $rootScope.$broadcast(broadcastName, {
                            markerName: name,
                            leafletEvent: e
                        });
                    }
                });
            };
        };

        var genDispatchPathEvent = function (eventName, logic, leafletScope, marker, name) {
            return function (e) {
                var broadcastName = 'leafletDirectivePath.' + eventName;

                safeApply(leafletScope, function (scope) {
                    if (logic === "emit") {
                        scope.$emit(broadcastName, {
                            pathName: name,
                            leafletEvent: e
                        });
                    } else {
                        $rootScope.$broadcast(broadcastName, {
                            pathName: name,
                            leafletEvent: e
                        });
                    }
                });
            };
        };

        var genDispatchLabelEvent = function (scope, eventName, logic, label, scope_watch_name) {
            return function (e) {
                // Put together broadcast name
                var broadcastName = 'leafletDirectiveLabel.' + eventName;
                var markerName = scope_watch_name.replace('markers.', '');

                // Safely broadcast the event
                safeApply(scope, function (scope) {
                    if (logic === "emit") {
                        scope.$emit(broadcastName, {
                            leafletEvent: e,
                            label: label,
                            markerName: markerName
                        });
                    } else if (logic === "broadcast") {
                        $rootScope.$broadcast(broadcastName, {
                            leafletEvent: e,
                            label: label,
                            markerName: markerName
                        });
                    }
                });
            };
        };

        var _getAvailableMarkerEvents = function () {
            return [
                'click',
                'dblclick',
                'mousedown',
                'mouseover',
                'mouseout',
                'contextmenu',
                'dragstart',
                'drag',
                'dragend',
                'move',
                'remove',
                'popupopen',
                'popupclose'
            ];
        };

        var _getAvailablePathEvents = function () {
            return [
                'click',
                'dblclick',
                'mousedown',
                'mouseover',
                'mouseout',
                'contextmenu',
                'add',
                'remove',
                'popupopen',
                'popupclose'
            ];
        };

        return {
            getAvailableMapEvents: function () {
                return [
                    'click',
                    'dblclick',
                    'mousedown',
                    'mouseup',
                    'mouseover',
                    'mouseout',
                    'mousemove',
                    'contextmenu',
                    'focus',
                    'blur',
                    'preclick',
                    'load',
                    'unload',
                    'viewreset',
                    'movestart',
                    'move',
                    'moveend',
                    'dragstart',
                    'drag',
                    'dragend',
                    'zoomstart',
                    'zoomend',
                    'zoomlevelschange',
                    'resize',
                    'autopanstart',
                    'layeradd',
                    'layerremove',
                    'baselayerchange',
                    'overlayadd',
                    'overlayremove',
                    'locationfound',
                    'locationerror',
                    'popupopen',
                    'popupclose',
                    'draw:created',
                    'draw:edited',
                    'draw:deleted',
                    'draw:drawstart',
                    'draw:drawstop',
                    'draw:editstart',
                    'draw:editstop',
                    'draw:deletestart',
                    'draw:deletestop'
                ];
            },

            genDispatchMapEvent: function (scope, eventName, logic) {
                return function (e) {
                    // Put together broadcast name
                    var broadcastName = 'leafletDirectiveMap.' + eventName;
                    // Safely broadcast the event
                    safeApply(scope, function (scope) {
                        if (logic === "emit") {
                            scope.$emit(broadcastName, {
                                leafletEvent: e
                            });
                        } else if (logic === "broadcast") {
                            $rootScope.$broadcast(broadcastName, {
                                leafletEvent: e
                            });
                        }
                    });
                };
            },

            getAvailableMarkerEvents: _getAvailableMarkerEvents,

            getAvailablePathEvents: _getAvailablePathEvents,

            notifyCenterChangedToBounds: function (scope) {
                scope.$broadcast("boundsChanged");
            },

            notifyCenterUrlHashChanged: function (scope, map, attrs, search) {
                if (!isDefined(attrs.urlHashCenter)) {
                    return;
                }
                var center = map.getCenter();
                var centerUrlHash = (center.lat).toFixed(4) + ":" + (center.lng).toFixed(4) + ":" + map.getZoom();
                if (!isDefined(search.c) || search.c !== centerUrlHash) {
                    //$log.debug("notified new center...");
                    scope.$emit("centerUrlHash", centerUrlHash);
                }
            },

            bindMarkerEvents: function (marker, name, markerData, leafletScope) {
                var markerEvents = [];
                var i;
                var eventName;
                var logic = "broadcast";

                if (!isDefined(leafletScope.eventBroadcast)) {
                    // Backward compatibility, if no event-broadcast attribute, all events are broadcasted
                    markerEvents = _getAvailableMarkerEvents();
                } else if (!isObject(leafletScope.eventBroadcast)) {
                    // Not a valid object
                    $log.error("[AngularJS - Leaflet] event-broadcast must be an object check your model.");
                } else {
                    // We have a possible valid object
                    if (!isDefined(leafletScope.eventBroadcast.marker)) {
                        // We do not have events enable/disable do we do nothing (all enabled by default)
                        markerEvents = _getAvailableMarkerEvents();
                    } else if (!isObject(leafletScope.eventBroadcast.marker)) {
                        // Not a valid object
                        $log.warn("[AngularJS - Leaflet] event-broadcast.marker must be an object check your model.");
                    } else {
                        // We have a possible valid map object
                        // Event propadation logic
                        if (leafletScope.eventBroadcast.marker.logic !== undefined && leafletScope.eventBroadcast.marker.logic !== null) {
                            // We take care of possible propagation logic
                            if (leafletScope.eventBroadcast.marker.logic !== "emit" && leafletScope.eventBroadcast.marker.logic !== "broadcast") {
                                // This is an error
                                $log.warn("[AngularJS - Leaflet] Available event propagation logic are: 'emit' or 'broadcast'.");
                            } else if (leafletScope.eventBroadcast.marker.logic === "emit") {
                                logic = "emit";
                            }
                        }
                        // Enable / Disable
                        var markerEventsEnable = false, markerEventsDisable = false;
                        if (leafletScope.eventBroadcast.marker.enable !== undefined && leafletScope.eventBroadcast.marker.enable !== null) {
                            if (typeof leafletScope.eventBroadcast.marker.enable === 'object') {
                                markerEventsEnable = true;
                            }
                        }
                        if (leafletScope.eventBroadcast.marker.disable !== undefined && leafletScope.eventBroadcast.marker.disable !== null) {
                            if (typeof leafletScope.eventBroadcast.marker.disable === 'object') {
                                markerEventsDisable = true;
                            }
                        }
                        if (markerEventsEnable && markerEventsDisable) {
                            // Both are active, this is an error
                            $log.warn("[AngularJS - Leaflet] can not enable and disable events at the same time");
                        } else if (!markerEventsEnable && !markerEventsDisable) {
                            // Both are inactive, this is an error
                            $log.warn("[AngularJS - Leaflet] must enable or disable events");
                        } else {
                            // At this point the marker object is OK, lets enable or disable events
                            if (markerEventsEnable) {
                                // Enable events
                                for (i = 0; i < leafletScope.eventBroadcast.marker.enable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.marker.enable[i];
                                    // Do we have already the event enabled?
                                    if (markerEvents.indexOf(eventName) !== -1) {
                                        // Repeated event, this is an error
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " is already enabled");
                                    } else {
                                        // Does the event exists?
                                        if (_getAvailableMarkerEvents().indexOf(eventName) === -1) {
                                            // The event does not exists, this is an error
                                            $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist");
                                        } else {
                                            // All ok enable the event
                                            markerEvents.push(eventName);
                                        }
                                    }
                                }
                            } else {
                                // Disable events
                                markerEvents = _getAvailableMarkerEvents();
                                for (i = 0; i < leafletScope.eventBroadcast.marker.disable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.marker.disable[i];
                                    var index = markerEvents.indexOf(eventName);
                                    if (index === -1) {
                                        // The event does not exist
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist or has been already disabled");

                                    } else {
                                        markerEvents.splice(index, 1);
                                    }
                                }
                            }
                        }
                    }
                }

                for (i = 0; i < markerEvents.length; i++) {
                    eventName = markerEvents[i];
                    marker.on(eventName, genDispatchMarkerEvent(eventName, logic, leafletScope, marker, name, markerData));
                }

                if (Helpers.LabelPlugin.isLoaded() && isDefined(marker.label)) {
                    genLabelEvents(leafletScope, logic, marker, name);
                }
            },

            bindPathEvents: function (path, name, pathData, leafletScope) {
                var pathEvents = [];
                var i;
                var eventName;
                var logic = "broadcast";

                if (!isDefined(leafletScope.eventBroadcast)) {
                    // Backward compatibility, if no event-broadcast attribute, all events are broadcasted
                    pathEvents = _getAvailablePathEvents();
                } else if (!isObject(leafletScope.eventBroadcast)) {
                    // Not a valid object
                    $log.error("[AngularJS - Leaflet] event-broadcast must be an object check your model.");
                } else {
                    // We have a possible valid object
                    if (!isDefined(leafletScope.eventBroadcast.path)) {
                        // We do not have events enable/disable do we do nothing (all enabled by default)
                        pathEvents = _getAvailablePathEvents();
                    } else if (isObject(leafletScope.eventBroadcast.paths)) {
                        // Not a valid object
                        $log.warn("[AngularJS - Leaflet] event-broadcast.path must be an object check your model.");
                    } else {
                        // We have a possible valid map object
                        // Event propadation logic
                        if (leafletScope.eventBroadcast.path.logic !== undefined && leafletScope.eventBroadcast.path.logic !== null) {
                            // We take care of possible propagation logic
                            if (leafletScope.eventBroadcast.path.logic !== "emit" && leafletScope.eventBroadcast.path.logic !== "broadcast") {
                                // This is an error
                                $log.warn("[AngularJS - Leaflet] Available event propagation logic are: 'emit' or 'broadcast'.");
                            } else if (leafletScope.eventBroadcast.path.logic === "emit") {
                                logic = "emit";
                            }
                        }
                        // Enable / Disable
                        var pathEventsEnable = false, pathEventsDisable = false;
                        if (leafletScope.eventBroadcast.path.enable !== undefined && leafletScope.eventBroadcast.path.enable !== null) {
                            if (typeof leafletScope.eventBroadcast.path.enable === 'object') {
                                pathEventsEnable = true;
                            }
                        }
                        if (leafletScope.eventBroadcast.path.disable !== undefined && leafletScope.eventBroadcast.path.disable !== null) {
                            if (typeof leafletScope.eventBroadcast.path.disable === 'object') {
                                pathEventsDisable = true;
                            }
                        }
                        if (pathEventsEnable && pathEventsDisable) {
                            // Both are active, this is an error
                            $log.warn("[AngularJS - Leaflet] can not enable and disable events at the same time");
                        } else if (!pathEventsEnable && !pathEventsDisable) {
                            // Both are inactive, this is an error
                            $log.warn("[AngularJS - Leaflet] must enable or disable events");
                        } else {
                            // At this point the path object is OK, lets enable or disable events
                            if (pathEventsEnable) {
                                // Enable events
                                for (i = 0; i < leafletScope.eventBroadcast.path.enable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.path.enable[i];
                                    // Do we have already the event enabled?
                                    if (pathEvents.indexOf(eventName) !== -1) {
                                        // Repeated event, this is an error
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " is already enabled");
                                    } else {
                                        // Does the event exists?
                                        if (_getAvailablePathEvents().indexOf(eventName) === -1) {
                                            // The event does not exists, this is an error
                                            $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist");
                                        } else {
                                            // All ok enable the event
                                            pathEvents.push(eventName);
                                        }
                                    }
                                }
                            } else {
                                // Disable events
                                pathEvents = _getAvailablePathEvents();
                                for (i = 0; i < leafletScope.eventBroadcast.path.disable.length; i++) {
                                    eventName = leafletScope.eventBroadcast.path.disable[i];
                                    var index = pathEvents.indexOf(eventName);
                                    if (index === -1) {
                                        // The event does not exist
                                        $log.warn("[AngularJS - Leaflet] This event " + eventName + " does not exist or has been already disabled");

                                    } else {
                                        pathEvents.splice(index, 1);
                                    }
                                }
                            }
                        }
                    }
                }

                for (i = 0; i < pathEvents.length; i++) {
                    eventName = pathEvents[i];
                    path.on(eventName, genDispatchPathEvent(eventName, logic, leafletScope, pathEvents, name));
                }

                if (Helpers.LabelPlugin.isLoaded() && isDefined(path.label)) {
                    genLabelEvents(leafletScope, logic, path, name);
                }
            }

        };
    }]);


    angular.module("leaflet-directive").factory('leafletLayerHelpers', ["$rootScope", "$log", "leafletHelpers", function ($rootScope, $log, leafletHelpers) {
        var Helpers = leafletHelpers,
            isString = leafletHelpers.isString,
            isObject = leafletHelpers.isObject,
            isDefined = leafletHelpers.isDefined;

        var utfGridCreateLayer = function (params) {
            if (!Helpers.UTFGridPlugin.isLoaded()) {
                $log.error('[AngularJS - Leaflet] The UTFGrid plugin is not loaded.');
                return;
            }
            var utfgrid = new L.UtfGrid(params.url, params.pluginOptions);

            utfgrid.on('mouseover', function (e) {
                $rootScope.$broadcast('leafletDirectiveMap.utfgridMouseover', e);
            });

            utfgrid.on('mouseout', function (e) {
                $rootScope.$broadcast('leafletDirectiveMap.utfgridMouseout', e);
            });

            utfgrid.on('click', function (e) {
                $rootScope.$broadcast('leafletDirectiveMap.utfgridClick', e);
            });

            return utfgrid;
        };

        var layerTypes = {
            xyz: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return L.tileLayer(params.url, params.options);
                }
            },
            mapbox: {
                mustHaveKey: true,
                createLayer: function (params) {
                    var url = '//{s}.tiles.mapbox.com/v3/' + params.key + '/{z}/{x}/{y}.png';
                    return L.tileLayer(url, params.options);
                }
            },
            geoJSON: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    if (!Helpers.GeoJSONPlugin.isLoaded()) {
                        return;
                    }
                    return new L.TileLayer.GeoJSON(params.url, params.pluginOptions, params.options);
                }
            },
            utfGrid: {
                mustHaveUrl: true,
                createLayer: utfGridCreateLayer
            },
            cartodbTiles: {
                mustHaveKey: true,
                createLayer: function (params) {
                    var url = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/{z}/{x}/{y}.png';
                    return L.tileLayer(url, params.options);
                }
            },
            cartodbUTFGrid: {
                mustHaveKey: true,
                mustHaveLayer: true,
                createLayer: function (params) {
                    params.url = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/' + params.layer + '/{z}/{x}/{y}.grid.json';
                    return utfGridCreateLayer(params);
                }
            },
            cartodbInteractive: {
                mustHaveKey: true,
                mustHaveLayer: true,
                createLayer: function (params) {
                    var tilesURL = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/{z}/{x}/{y}.png';
                    var tileLayer = L.tileLayer(tilesURL, params.options);
                    params.url = '//' + params.user + '.cartodb.com/api/v1/map/' + params.key + '/' + params.layer + '/{z}/{x}/{y}.grid.json';
                    var utfLayer = utfGridCreateLayer(params);
                    return L.layerGroup([tileLayer, utfLayer]);
                }
            },
            wms: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return L.tileLayer.wms(params.url, params.options);
                }
            },
            wmts: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return L.tileLayer.wmts(params.url, params.options);
                }
            },
            wfs: {
                mustHaveUrl: true,
                mustHaveLayer: true,
                createLayer: function (params) {
                    if (!Helpers.WFSLayerPlugin.isLoaded()) {
                        return;
                    }
                    var options = angular.copy(params.options);
                    if (options.crs && 'string' === typeof options.crs) {
                        /*jshint -W061 */
                        options.crs = eval(options.crs);
                    }
                    return new L.GeoJSON.WFS(params.url, params.layer, options);
                }
            },
            group: {
                mustHaveUrl: false,
                createLayer: function () {
                    return L.layerGroup();
                }
            },
            featureGroup: {
                mustHaveUrl: false,
                createLayer: function () {
                    return L.featureGroup();
                }
            },
            google: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    var type = params.type || 'SATELLITE';
                    if (!Helpers.GoogleLayerPlugin.isLoaded()) {
                        return;
                    }
                    return new L.Google(type, params.options);
                }
            },
            china: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    var type = params.type || '';
                    if (!Helpers.ChinaLayerPlugin.isLoaded()) {
                        return;
                    }
                    return L.tileLayer.chinaProvider(type, params.options);
                }
            },
            ags: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    if (!Helpers.AGSLayerPlugin.isLoaded()) {
                        return;
                    }

                    var options = angular.copy(params.options);
                    angular.extend(options, {
                        url: params.url
                    });
                    var layer = new lvector.AGS(options);
                    layer.onAdd = function (map) {
                        this.setMap(map);
                    };
                    layer.onRemove = function () {
                        this.setMap(null);
                    };
                    return layer;
                }
            },
            dynamic: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    if (!Helpers.DynamicMapLayerPlugin.isLoaded()) {
                        return;
                    }
                    return L.esri.dynamicMapLayer(params.url, params.options);
                }
            },
            markercluster: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    if (!Helpers.MarkerClusterPlugin.isLoaded()) {
                        $log.error('[AngularJS - Leaflet] The markercluster plugin is not loaded.');
                        return;
                    }
                    return new L.MarkerClusterGroup(params.options);
                }
            },
            bing: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    if (!Helpers.BingLayerPlugin.isLoaded()) {
                        return;
                    }
                    return new L.BingLayer(params.key, params.options);
                }
            },
            heatmap: {
                mustHaveUrl: false,
                mustHaveData: true,
                createLayer: function (params) {
                    if (!Helpers.HeatMapLayerPlugin.isLoaded()) {
                        return;
                    }
                    var layer = new L.TileLayer.WebGLHeatMap(params.options);
                    if (isDefined(params.data)) {
                        layer.setData(params.data);
                    }

                    return layer;
                }
            },
            yandex: {
                mustHaveUrl: false,
                createLayer: function (params) {
                    var type = params.type || 'map';
                    if (!Helpers.YandexLayerPlugin.isLoaded()) {
                        return;
                    }
                    return new L.Yandex(type, params.options);
                }
            },
            imageOverlay: {
                mustHaveUrl: true,
                mustHaveBounds: true,
                createLayer: function (params) {
                    return L.imageOverlay(params.url, params.bounds, params.options);
                }
            },

            // This "custom" type is used to accept every layer that user want to define himself.
            // We can wrap these custom layers like heatmap or yandex, but it means a lot of work/code to wrap the world,
            // so we let user to define their own layer outside the directive,
            // and pass it on "createLayer" result for next processes
            custom: {
                createLayer: function (params) {
                    if (params.layer instanceof L.Class) {
                        return angular.copy(params.layer);
                    }
                    else {
                        $log.error('[AngularJS - Leaflet] A custom layer must be a leaflet Class');
                    }
                }
            },
            cartodb: {
                mustHaveUrl: true,
                createLayer: function (params) {
                    return cartodb.createLayer(params.map, params.url);
                }
            }
        };

        function isValidLayerType(layerDefinition) {
            // Check if the baselayer has a valid type
            if (!isString(layerDefinition.type)) {
                $log.error('[AngularJS - Leaflet] A layer must have a valid type defined.');
                return false;
            }

            if (Object.keys(layerTypes).indexOf(layerDefinition.type) === -1) {
                $log.error('[AngularJS - Leaflet] A layer must have a valid type: ' + Object.keys(layerTypes));
                return false;
            }

            // Check if the layer must have an URL
            if (layerTypes[layerDefinition.type].mustHaveUrl && !isString(layerDefinition.url)) {
                $log.error('[AngularJS - Leaflet] A base layer must have an url');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveData && !isDefined(layerDefinition.data)) {
                $log.error('[AngularJS - Leaflet] The base layer must have a "data" array attribute');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveLayer && !isDefined(layerDefinition.layer)) {
                $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have an layer defined');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveBounds && !isDefined(layerDefinition.bounds)) {
                $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have bounds defined');
                return false;
            }

            if (layerTypes[layerDefinition.type].mustHaveKey && !isDefined(layerDefinition.key)) {
                $log.error('[AngularJS - Leaflet] The type of layer ' + layerDefinition.type + ' must have key defined');
                return false;
            }
            return true;
        }

        return {
            createLayer: function (layerDefinition) {
                if (!isValidLayerType(layerDefinition)) {
                    return;
                }

                if (!isString(layerDefinition.name)) {
                    $log.error('[AngularJS - Leaflet] A base layer must have a name');
                    return;
                }
                if (!isObject(layerDefinition.layerParams)) {
                    layerDefinition.layerParams = {};
                }
                if (!isObject(layerDefinition.layerOptions)) {
                    layerDefinition.layerOptions = {};
                }

                // Mix the layer specific parameters with the general Leaflet options. Although this is an overhead
                // the definition of a base layers is more 'clean' if the two types of parameters are differentiated
                for (var attrname in layerDefinition.layerParams) {
                    layerDefinition.layerOptions[attrname] = layerDefinition.layerParams[attrname];
                }

                var params = {
                    url: layerDefinition.url,
                    data: layerDefinition.data,
                    options: layerDefinition.layerOptions,
                    layer: layerDefinition.layer,
                    type: layerDefinition.layerType,
                    bounds: layerDefinition.bounds,
                    key: layerDefinition.key,
                    pluginOptions: layerDefinition.pluginOptions,
                    user: layerDefinition.user
                };

                //TODO Add $watch to the layer properties
                return layerTypes[layerDefinition.type].createLayer(params);
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletControlHelpers', ["$rootScope", "$log", "leafletHelpers", "leafletMapDefaults", function ($rootScope, $log, leafletHelpers, leafletMapDefaults) {
        var isObject = leafletHelpers.isObject,
            isDefined = leafletHelpers.isDefined;
        var _layersControl;

        var _controlLayersMustBeVisible = function (baselayers, overlays, mapId) {
            var defaults = leafletMapDefaults.getDefaults(mapId);
            if (!defaults.controls.layers.visible) {
                return false;
            }

            var numberOfLayers = 0;
            if (isObject(baselayers)) {
                numberOfLayers += Object.keys(baselayers).length;
            }
            if (isObject(overlays)) {
                numberOfLayers += Object.keys(overlays).length;
            }
            return numberOfLayers > 1;
        };

        var _createLayersControl = function (mapId) {
            var defaults = leafletMapDefaults.getDefaults(mapId);
            var controlOptions = {
                collapsed: defaults.controls.layers.collapsed,
                position: defaults.controls.layers.position
            };

            angular.extend(controlOptions, defaults.controls.layers.options);

            var control;
            if (defaults.controls.layers && isDefined(defaults.controls.layers.control)) {
                control = defaults.controls.layers.control.apply(this, [
                    [],
                    [],
                    controlOptions
                ]);
            } else {
                control = new L.control.layers([], [], controlOptions);
            }

            return control;
        };

        return {
            layersControlMustBeVisible: _controlLayersMustBeVisible,

            updateLayersControl: function (map, mapId, loaded, baselayers, overlays, leafletLayers) {
                var i;

                var mustBeLoaded = _controlLayersMustBeVisible(baselayers, overlays, mapId);
                if (isDefined(_layersControl) && loaded) {
                    for (i in leafletLayers.baselayers) {
                        _layersControl.removeLayer(leafletLayers.baselayers[i]);
                    }
                    for (i in leafletLayers.overlays) {
                        _layersControl.removeLayer(leafletLayers.overlays[i]);
                    }
                    _layersControl.removeFrom(map);
                }

                if (mustBeLoaded) {
                    _layersControl = _createLayersControl(mapId);
                    for (i in baselayers) {
                        if (isDefined(leafletLayers.baselayers[i])) {
                            _layersControl.addBaseLayer(leafletLayers.baselayers[i], baselayers[i].name);
                        }
                    }
                    for (i in overlays) {
                        if (isDefined(leafletLayers.overlays[i])) {
                            _layersControl.addOverlay(leafletLayers.overlays[i], overlays[i].name);
                        }
                    }
                    _layersControl.addTo(map);
                }
                return mustBeLoaded;
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletLegendHelpers', function () {
        var _updateArcGISLegend = function (div, legendData) {
            div.innerHTML = '';
            if (legendData.error) {
                div.innerHTML += '<div class="info-title alert alert-danger">' + legendData.error.message + '</div>';
            } else {
                for (var i = 0; i < legendData.layers.length; i++) {
                    var layer = legendData.layers[i];
                    div.innerHTML += '<div class="info-title" data-layerid="' + layer.layerId + '">' + layer.layerName + '</div>';
                    for (var j = 0; j < layer.legend.length; j++) {
                        var leg = layer.legend[j];
                        div.innerHTML +=
                            '<div class="inline" data-layerid="' + layer.layerId + '"><img src="data:' + leg.contentType + ';base64,' + leg.imageData + '" /></div>' +
                            '<div class="info-label" data-layerid="' + layer.layerId + '">' + leg.label + '</div>';
                    }
                }
            }
        };

        var _getOnAddArcGISLegend = function (legendData, legendClass) {
            return function (/*map*/) {
                var div = L.DomUtil.create('div', legendClass);

                if (!L.Browser.touch) {
                    L.DomEvent.disableClickPropagation(div);
                    L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
                } else {
                    L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
                }
                _updateArcGISLegend(div, legendData);
                return div;
            };
        };

        var _getOnAddArrayLegend = function (legend, legendClass) {
            return function (/*map*/) {
                var div = L.DomUtil.create('div', legendClass);
                for (var i = 0; i < legend.colors.length; i++) {
                    div.innerHTML +=
                        '<div class="outline"><i style="background:' + legend.colors[i] + '"></i></div>' +
                        '<div class="info-label">' + legend.labels[i] + '</div>';
                }
                if (!L.Browser.touch) {
                    L.DomEvent.disableClickPropagation(div);
                    L.DomEvent.on(div, 'mousewheel', L.DomEvent.stopPropagation);
                } else {
                    L.DomEvent.on(div, 'click', L.DomEvent.stopPropagation);
                }
                return div;
            };
        };

        return {
            getOnAddArcGISLegend: _getOnAddArcGISLegend,
            getOnAddArrayLegend: _getOnAddArrayLegend,
            updateArcGISLegend: _updateArcGISLegend,
        };
    });

    angular.module("leaflet-directive").factory('leafletPathsHelpers', ["$rootScope", "$log", "leafletHelpers", function ($rootScope, $log, leafletHelpers) {
        var isDefined = leafletHelpers.isDefined,
            isArray = leafletHelpers.isArray,
            isNumber = leafletHelpers.isNumber,
            isValidPoint = leafletHelpers.isValidPoint;
        var availableOptions = [
            // Path options
            'stroke', 'weight', 'color', 'opacity',
            'fill', 'fillColor', 'fillOpacity',
            'dashArray', 'lineCap', 'lineJoin', 'clickable',
            'pointerEvents', 'className',

            // Polyline options
            'smoothFactor', 'noClip'
        ];

        function _convertToLeafletLatLngs(latlngs) {
            return latlngs.filter(function (latlng) {
                return isValidPoint(latlng);
            }).map(function (latlng) {
                return new L.LatLng(latlng.lat, latlng.lng);
            });
        }

        function _convertToLeafletLatLng(latlng) {
            return new L.LatLng(latlng.lat, latlng.lng);
        }

        function _convertToLeafletMultiLatLngs(paths) {
            return paths.map(function (latlngs) {
                return _convertToLeafletLatLngs(latlngs);
            });
        }

        function _getOptions(path, defaults) {
            var options = {};
            for (var i = 0; i < availableOptions.length; i++) {
                var optionName = availableOptions[i];

                if (isDefined(path[optionName])) {
                    options[optionName] = path[optionName];
                } else if (isDefined(defaults.path[optionName])) {
                    options[optionName] = defaults.path[optionName];
                }
            }

            return options;
        }

        var _updatePathOptions = function (path, data) {
            var updatedStyle = {};
            for (var i = 0; i < availableOptions.length; i++) {
                var optionName = availableOptions[i];
                if (isDefined(data[optionName])) {
                    updatedStyle[optionName] = data[optionName];
                }
            }
            path.setStyle(data);
        };

        var _isValidPolyline = function (latlngs) {
            if (!isArray(latlngs)) {
                return false;
            }
            for (var i = 0; i < latlngs.length; i++) {
                var point = latlngs[i];
                if (!isValidPoint(point)) {
                    return false;
                }
            }
            return true;
        };

        var pathTypes = {
            polyline: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;
                    return _isValidPolyline(latlngs);
                },
                createPath: function (options) {
                    return new L.Polyline([], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            multiPolyline: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;
                    if (!isArray(latlngs)) {
                        return false;
                    }

                    for (var i in latlngs) {
                        var polyline = latlngs[i];
                        if (!_isValidPolyline(polyline)) {
                            return false;
                        }
                    }

                    return true;
                },
                createPath: function (options) {
                    return new L.multiPolyline([
                        [
                            [0, 0],
                            [1, 1]
                        ]
                    ], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletMultiLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            polygon: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;
                    return _isValidPolyline(latlngs);
                },
                createPath: function (options) {
                    return new L.Polygon([], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            multiPolygon: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;

                    if (!isArray(latlngs)) {
                        return false;
                    }

                    for (var i in latlngs) {
                        var polyline = latlngs[i];
                        if (!_isValidPolyline(polyline)) {
                            return false;
                        }
                    }

                    return true;
                },
                createPath: function (options) {
                    return new L.MultiPolygon([
                        [
                            [0, 0],
                            [1, 1],
                            [0, 1]
                        ]
                    ], options);
                },
                setPath: function (path, data) {
                    path.setLatLngs(_convertToLeafletMultiLatLngs(data.latlngs));
                    _updatePathOptions(path, data);
                    return;
                }
            },
            rectangle: {
                isValid: function (pathData) {
                    var latlngs = pathData.latlngs;

                    if (!isArray(latlngs) || latlngs.length !== 2) {
                        return false;
                    }

                    for (var i in latlngs) {
                        var point = latlngs[i];
                        if (!isValidPoint(point)) {
                            return false;
                        }
                    }

                    return true;
                },
                createPath: function (options) {
                    return new L.Rectangle([
                        [0, 0],
                        [1, 1]
                    ], options);
                },
                setPath: function (path, data) {
                    path.setBounds(new L.LatLngBounds(_convertToLeafletLatLngs(data.latlngs)));
                    _updatePathOptions(path, data);
                }
            },
            circle: {
                isValid: function (pathData) {
                    var point = pathData.latlngs;
                    return isValidPoint(point) && isNumber(pathData.radius);
                },
                createPath: function (options) {
                    return new L.Circle([0, 0], 1, options);
                },
                setPath: function (path, data) {
                    path.setLatLng(_convertToLeafletLatLng(data.latlngs));
                    if (isDefined(data.radius)) {
                        path.setRadius(data.radius);
                    }
                    _updatePathOptions(path, data);
                }
            },
            circleMarker: {
                isValid: function (pathData) {
                    var point = pathData.latlngs;
                    return isValidPoint(point) && isNumber(pathData.radius);
                },
                createPath: function (options) {
                    return new L.CircleMarker([0, 0], options);
                },
                setPath: function (path, data) {
                    path.setLatLng(_convertToLeafletLatLng(data.latlngs));
                    if (isDefined(data.radius)) {
                        path.setRadius(data.radius);
                    }
                    _updatePathOptions(path, data);
                }
            }
        };

        var _getPathData = function (path) {
            var pathData = {};
            if (path.latlngs) {
                pathData.latlngs = path.latlngs;
            }

            if (path.radius) {
                pathData.radius = path.radius;
            }

            return pathData;
        };

        return {
            setPathOptions: function (leafletPath, pathType, data) {
                if (!isDefined(pathType)) {
                    pathType = "polyline";
                }
                pathTypes[pathType].setPath(leafletPath, data);
            },
            createPath: function (name, path, defaults) {
                if (!isDefined(path.type)) {
                    path.type = "polyline";
                }
                var options = _getOptions(path, defaults);
                var pathData = _getPathData(path);

                if (!pathTypes[path.type].isValid(pathData)) {
                    $log.error("[AngularJS - Leaflet] Invalid data passed to the " + path.type + " path");
                    return;
                }

                return pathTypes[path.type].createPath(options);
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletBoundsHelpers', ["$log", "leafletHelpers", function ($log, leafletHelpers) {

        var isArray = leafletHelpers.isArray,
            isNumber = leafletHelpers.isNumber;

        function _isValidBounds(bounds) {
            return angular.isDefined(bounds) && angular.isDefined(bounds.southWest) &&
                angular.isDefined(bounds.northEast) && angular.isNumber(bounds.southWest.lat) &&
                angular.isNumber(bounds.southWest.lng) && angular.isNumber(bounds.northEast.lat) &&
                angular.isNumber(bounds.northEast.lng);
        }

        return {
            createLeafletBounds: function (bounds) {
                if (_isValidBounds(bounds)) {
                    return L.latLngBounds([bounds.southWest.lat, bounds.southWest.lng],
                        [bounds.northEast.lat, bounds.northEast.lng ]);
                }
            },

            isValidBounds: _isValidBounds,

            createBoundsFromArray: function (boundsArray) {
                if (!(isArray(boundsArray) && boundsArray.length === 2 &&
                    isArray(boundsArray[0]) && isArray(boundsArray[1]) &&
                    boundsArray[0].length === 2 && boundsArray[1].length === 2 &&
                    isNumber(boundsArray[0][0]) && isNumber(boundsArray[0][1]) &&
                    isNumber(boundsArray[1][0]) && isNumber(boundsArray[1][1]))) {
                    $log.error("[AngularJS - Leaflet] The bounds array is not valid.");
                    return;
                }

                return {
                    northEast: {
                        lat: boundsArray[0][0],
                        lng: boundsArray[0][1]
                    },
                    southWest: {
                        lat: boundsArray[1][0],
                        lng: boundsArray[1][1]
                    }
                };

            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletMarkersHelpers', ["$rootScope", "leafletHelpers", "$log", function ($rootScope, leafletHelpers, $log) {

        var isDefined = leafletHelpers.isDefined,
            MarkerClusterPlugin = leafletHelpers.MarkerClusterPlugin,
            AwesomeMarkersPlugin = leafletHelpers.AwesomeMarkersPlugin,
            MakiMarkersPlugin = leafletHelpers.MakiMarkersPlugin,
            safeApply = leafletHelpers.safeApply,
            Helpers = leafletHelpers,
            isString = leafletHelpers.isString,
            isNumber = leafletHelpers.isNumber,
            isObject = leafletHelpers.isObject,
            groups = {};

        var createLeafletIcon = function (iconData) {
            if (isDefined(iconData) && isDefined(iconData.type) && iconData.type === 'awesomeMarker') {
                if (!AwesomeMarkersPlugin.isLoaded()) {
                    $log.error('[AngularJS - Leaflet] The AwesomeMarkers Plugin is not loaded.');
                }

                return new L.AwesomeMarkers.icon(iconData);
            }

            if (isDefined(iconData) && isDefined(iconData.type) && iconData.type === 'makiMarker') {
                if (!MakiMarkersPlugin.isLoaded()) {
                    $log.error('[AngularJS - Leaflet] The MakiMarkers Plugin is not loaded.');
                }

                return new L.MakiMarkers.icon(iconData);
            }

            if (isDefined(iconData) && isDefined(iconData.type) && iconData.type === 'div') {
                return new L.divIcon(iconData);
            }

            var base64icon = "data:image/png;base64,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";

            var base64shadow = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAC5ElEQVRYw+2YW4/TMBCF45S0S1luXZCABy5CgLQgwf//S4BYBLTdJLax0fFqmB07nnQfEGqkIydpVH85M+NLjPe++dcPc4Q8Qh4hj5D/AaQJx6H/4TMwB0PeBNwU7EGQAmAtsNfAzoZkgIa0ZgLMa4Aj6CxIAsjhjOCoL5z7Glg1JAOkaicgvQBXuncwJAWjksLtBTWZe04CnYRktUGdilALppZBOgHGZcBzL6OClABvMSVIzyBjazOgrvACf1ydC5mguqAVg6RhdkSWQFj2uxfaq/BrIZOLEWgZdALIDvcMcZLD8ZbLC9de4yR1sYMi4G20S4Q/PWeJYxTOZn5zJXANZHIxAd4JWhPIloTJZhzMQduM89WQ3MUVAE/RnhAXpTycqys3NZALOBbB7kFrgLesQl2h45Fcj8L1tTSohUwuxhy8H/Qg6K7gIs+3kkaigQCOcyEXCHN07wyQazhrmIulvKMQAwMcmLNqyCVyMAI+BuxSMeTk3OPikLY2J1uE+VHQk6ANrhds+tNARqBeaGc72cK550FP4WhXmFmcMGhTwAR1ifOe3EvPqIegFmF+C8gVy0OfAaWQPMR7gF1OQKqGoBjq90HPMP01BUjPOqGFksC4emE48tWQAH0YmvOgF3DST6xieJgHAWxPAHMuNhrImIdvoNOKNWIOcE+UXE0pYAnkX6uhWsgVXDxHdTfCmrEEmMB2zMFimLVOtiiajxiGWrbU52EeCdyOwPEQD8LqyPH9Ti2kgYMf4OhSKB7qYILbBv3CuVTJ11Y80oaseiMWOONc/Y7kJYe0xL2f0BaiFTxknHO5HaMGMublKwxFGzYdWsBF174H/QDknhTHmHHN39iWFnkZx8lPyM8WHfYELmlLKtgWNmFNzQcC1b47gJ4hL19i7o65dhH0Negbca8vONZoP7doIeOC9zXm8RjuL0Gf4d4OYaU5ljo3GYiqzrWQHfJxA6ALhDpVKv9qYeZA8eM3EhfPSCmpuD0AAAAASUVORK5CYII=";

            if (!isDefined(iconData)) {
                return new L.Icon.Default({
                    iconUrl: base64icon,
                    shadowUrl: base64shadow
                });
            }

            if (!isDefined(iconData.iconUrl)) {
                iconData.iconUrl = base64icon;
                iconData.shadowUrl = base64shadow;
            }
            return new L.Icon(iconData);
        };

        var _resetMarkerGroup = function (groupName) {
            if (isDefined(groups[groupName])) {
                groups.splice(groupName, 1);
            }
        };

        var _resetMarkerGroups = function () {
            groups = {};
        };

        var _deleteMarker = function (marker, map, layers) {
            marker.closePopup();
            // There is no easy way to know if a marker is added to a layer, so we search for it
            // if there are overlays
            if (isDefined(layers) && isDefined(layers.overlays)) {
                for (var key in layers.overlays) {
                    if (layers.overlays[key] instanceof L.LayerGroup || layers.overlays[key] instanceof L.FeatureGroup) {
                        if (layers.overlays[key].hasLayer(marker)) {
                            layers.overlays[key].removeLayer(marker);
                            return;
                        }
                    }
                }
            }

            if (isDefined(groups)) {
                for (var groupKey in groups) {
                    if (groups[groupKey].hasLayer(marker)) {
                        groups[groupKey].removeLayer(marker);
                    }
                }
            }

            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        };

        return {
            resetMarkerGroup: _resetMarkerGroup,

            resetMarkerGroups: _resetMarkerGroups,

            deleteMarker: _deleteMarker,

            createMarker: function (markerData) {
                if (!isDefined(markerData)) {
                    $log.error('[AngularJS - Leaflet] The marker definition is not valid.');
                    return;
                }

                var markerOptions = {
                    icon: createLeafletIcon(markerData.icon),
                    title: isDefined(markerData.title) ? markerData.title : '',
                    draggable: isDefined(markerData.draggable) ? markerData.draggable : false,
                    clickable: isDefined(markerData.clickable) ? markerData.clickable : true,
                    riseOnHover: isDefined(markerData.riseOnHover) ? markerData.riseOnHover : false,
                    zIndexOffset: isDefined(markerData.zIndexOffset) ? markerData.zIndexOffset : 0,
                    iconAngle: isDefined(markerData.iconAngle) ? markerData.iconAngle : 0
                };
                // Add any other options not added above to markerOptions
                for (var markerDatum in markerData) {
                    if (markerData.hasOwnProperty(markerDatum) && !markerOptions.hasOwnProperty(markerDatum)) {
                        markerOptions[markerDatum] = markerData[markerDatum];
                    }
                }

                var marker = new L.marker(markerData, markerOptions);

                if (!isString(markerData.message)) {
                    marker.unbindPopup();
                }

                return marker;
            },

            addMarkerToGroup: function (marker, groupName, groupOptions, map) {
                if (!isString(groupName)) {
                    $log.error('[AngularJS - Leaflet] The marker group you have specified is invalid.');
                    return;
                }

                if (!MarkerClusterPlugin.isLoaded()) {
                    $log.error("[AngularJS - Leaflet] The MarkerCluster plugin is not loaded.");
                    return;
                }
                if (!isDefined(groups[groupName])) {
                    groups[groupName] = new L.MarkerClusterGroup(groupOptions);
                    map.addLayer(groups[groupName]);
                }
                groups[groupName].addLayer(marker);
            },

            listenMarkerEvents: function (marker, markerData, leafletScope) {
                marker.on("popupopen", function (/* event */) {
                    safeApply(leafletScope, function () {
                        markerData.focus = true;
                    });
                });
                marker.on("popupclose", function (/* event */) {
                    safeApply(leafletScope, function () {
                        markerData.focus = false;
                    });
                });
            },

            addMarkerWatcher: function (marker, name, leafletScope, layers, map) {
                var clearWatch = leafletScope.$watch("markers." + name, function (markerData, oldMarkerData) {
                    if (!isDefined(markerData)) {
                        _deleteMarker(marker, map, layers);
                        clearWatch();
                        return;
                    }

                    if (!isDefined(oldMarkerData)) {
                        return;
                    }

                    // Update the lat-lng property (always present in marker properties)
                    if (!(isNumber(markerData.lat) && isNumber(markerData.lng))) {
                        $log.warn('There are problems with lat-lng data, please verify your marker model');
                        _deleteMarker(marker, map, layers);
                        return;
                    }

                    // It is possible that the layer has been removed or the layer marker does not exist
                    // Update the layer group if present or move it to the map if not
                    if (!isString(markerData.layer)) {
                        // There is no layer information, we move the marker to the map if it was in a layer group
                        if (isString(oldMarkerData.layer)) {
                            // Remove from the layer group that is supposed to be
                            if (isDefined(layers.overlays[oldMarkerData.layer]) && layers.overlays[oldMarkerData.layer].hasLayer(marker)) {
                                layers.overlays[oldMarkerData.layer].removeLayer(marker);
                                marker.closePopup();
                            }
                            // Test if it is not on the map and add it
                            if (!map.hasLayer(marker)) {
                                map.addLayer(marker);
                            }
                        }
                    }

                    if (isString(markerData.layer) && oldMarkerData.layer !== markerData.layer) {
                        // If it was on a layer group we have to remove it
                        if (isString(oldMarkerData.layer) && isDefined(layers.overlays[oldMarkerData.layer]) && layers.overlays[oldMarkerData.layer].hasLayer(marker)) {
                            layers.overlays[oldMarkerData.layer].removeLayer(marker);
                        }
                        marker.closePopup();

                        // Remove it from the map in case the new layer is hidden or there is an error in the new layer
                        if (map.hasLayer(marker)) {
                            map.removeLayer(marker);
                        }

                        // The markerData.layer is defined so we add the marker to the layer if it is different from the old data
                        if (!isDefined(layers.overlays[markerData.layer])) {
                            $log.error('[AngularJS - Leaflet] You must use a name of an existing layer');
                            return;
                        }
                        // Is a group layer?
                        var layerGroup = layers.overlays[markerData.layer];
                        if (!(layerGroup instanceof L.LayerGroup || layerGroup instanceof L.FeatureGroup)) {
                            $log.error('[AngularJS - Leaflet] A marker can only be added to a layer of type "group" or "featureGroup"');
                            return;
                        }
                        // The marker goes to a correct layer group, so first of all we add it
                        layerGroup.addLayer(marker);
                        // The marker is automatically added to the map depending on the visibility
                        // of the layer, so we only have to open the popup if the marker is in the map
                        if (map.hasLayer(marker) && markerData.focus === true) {
                            marker.openPopup();
                        }
                    }

                    // Update the draggable property
                    if (markerData.draggable !== true && oldMarkerData.draggable === true && (isDefined(marker.dragging))) {
                        marker.dragging.disable();
                    }

                    if (markerData.draggable === true && oldMarkerData.draggable !== true) {
                        // The markerData.draggable property must be true so we update if there wasn't a previous value or it wasn't true
                        if (marker.dragging) {
                            marker.dragging.enable();
                        } else {
                            if (L.Handler.MarkerDrag) {
                                marker.dragging = new L.Handler.MarkerDrag(marker);
                                marker.options.draggable = true;
                                marker.dragging.enable();
                            }
                        }
                    }

                    // Update the icon property
                    if (!isObject(markerData.icon)) {
                        // If there is no icon property or it's not an object
                        if (isObject(oldMarkerData.icon)) {
                            // If there was an icon before restore to the default
                            marker.setIcon(createLeafletIcon());
                            marker.closePopup();
                            marker.unbindPopup();
                            if (isString(markerData.message)) {
                                marker.bindPopup(markerData.message, markerData.popupOptions);
                            }
                        }
                    }

                    if (isObject(markerData.icon) && isObject(oldMarkerData.icon) && !angular.equals(markerData.icon, oldMarkerData.icon)) {
                        var dragG = false;
                        if (marker.dragging) {
                            dragG = marker.dragging.enabled();
                        }
                        marker.setIcon(createLeafletIcon(markerData.icon));
                        if (dragG) {
                            marker.dragging.enable();
                        }
                        marker.closePopup();
                        marker.unbindPopup();
                        if (isString(markerData.message)) {
                            marker.bindPopup(markerData.message, markerData.popupOptions);
                        }
                    }

                    // Update the Popup message property
                    if (!isString(markerData.message) && isString(oldMarkerData.message)) {
                        marker.closePopup();
                        marker.unbindPopup();
                    }

                    // Update the label content
                    if (Helpers.LabelPlugin.isLoaded() && isDefined(markerData.label) && isDefined(markerData.label.message) && !angular.equals(markerData.label.message, oldMarkerData.label.message)) {
                        marker.updateLabelContent(markerData.label.message);
                    }

                    // There is some text in the popup, so we must show the text or update existing
                    if (isString(markerData.message) && !isString(oldMarkerData.message)) {
                        // There was no message before so we create it
                        marker.bindPopup(markerData.message, markerData.popupOptions);
                        if (markerData.focus === true) {
                            // If the focus is set, we must open the popup, because we do not know if it was opened before
                            marker.openPopup();
                        }
                    }

                    if (isString(markerData.message) && isString(oldMarkerData.message) && markerData.message !== oldMarkerData.message) {
                        // There was a different previous message so we update it
                        marker.setPopupContent(markerData.message);
                    }

                    // Update the focus property
                    var updatedFocus = false;
                    if (markerData.focus !== true && oldMarkerData.focus === true) {
                        // If there was a focus property and was true we turn it off
                        marker.closePopup();
                        updatedFocus = true;
                    }

                    // The markerData.focus property must be true so we update if there wasn't a previous value or it wasn't true
                    if (markerData.focus === true && oldMarkerData.focus !== true) {
                        marker.openPopup();
                        updatedFocus = true;
                    }

                    if (oldMarkerData.focus === true && markerData.focus === true) {
                        // Reopen the popup when focus is still true
                        marker.openPopup();
                        updatedFocus = true;
                    }

                    // zIndexOffset adjustment
                    if (oldMarkerData.zIndexOffset !== markerData.zIndexOffset) {
                        marker.setZIndexOffset(markerData.zIndexOffset);
                    }

                    var markerLatLng = marker.getLatLng();
                    var isCluster = (isString(markerData.layer) && Helpers.MarkerClusterPlugin.is(layers.overlays[markerData.layer]));
                    // If the marker is in a cluster it has to be removed and added to the layer when the location is changed
                    if (isCluster) {
                        // The focus has changed even by a user click or programatically
                        if (updatedFocus) {
                            // We only have to update the location if it was changed programatically, because it was
                            // changed by a user drag the marker data has already been updated by the internal event
                            // listened by the directive
                            if ((markerData.lat !== oldMarkerData.lat) || (markerData.lng !== oldMarkerData.lng)) {
                                layers.overlays[markerData.layer].removeLayer(marker);
                                marker.setLatLng([markerData.lat, markerData.lng]);
                                layers.overlays[markerData.layer].addLayer(marker);
                            }
                        } else {
                            // The marker has possibly moved. It can be moved by a user drag (marker location and data are equal but old
                            // data is diferent) or programatically (marker location and data are diferent)
                            if ((markerLatLng.lat !== markerData.lat) || (markerLatLng.lng !== markerData.lng)) {
                                // The marker was moved by a user drag
                                layers.overlays[markerData.layer].removeLayer(marker);
                                marker.setLatLng([markerData.lat, markerData.lng]);
                                layers.overlays[markerData.layer].addLayer(marker);
                            } else if ((markerData.lat !== oldMarkerData.lat) || (markerData.lng !== oldMarkerData.lng)) {
                                // The marker was moved programatically
                                layers.overlays[markerData.layer].removeLayer(marker);
                                marker.setLatLng([markerData.lat, markerData.lng]);
                                layers.overlays[markerData.layer].addLayer(marker);
                            }
                        }
                    } else if (markerLatLng.lat !== markerData.lat || markerLatLng.lng !== markerData.lng) {
                        marker.setLatLng([markerData.lat, markerData.lng]);
                    }
                }, true);
            }
        };
    }]);

    angular.module("leaflet-directive").factory('leafletHelpers', ["$q", "$log", function ($q, $log) {

        function _obtainEffectiveMapId(d, mapId) {
            var id, i;
            if (!angular.isDefined(mapId)) {
                if (Object.keys(d).length === 0) {
                    id = "main";
                } else if (Object.keys(d).length >= 1) {
                    for (i in d) {
                        if (d.hasOwnProperty(i)) {
                            id = i;
                        }
                    }
                } else if (Object.keys(d).length === 0) {
                    id = "main";
                } else {
                    $log.error("[AngularJS - Leaflet] - You have more than 1 map on the DOM, you must provide the map ID to the leafletData.getXXX call");
                }
            } else {
                id = mapId;
            }

            return id;
        }

        function _getUnresolvedDefer(d, mapId) {
            var id = _obtainEffectiveMapId(d, mapId),
                defer;

            if (!angular.isDefined(d[id]) || d[id].resolvedDefer === true) {
                defer = $q.defer();
                d[id] = {
                    defer: defer,
                    resolvedDefer: false
                };
            } else {
                defer = d[id].defer;
            }

            return defer;
        }

        return {
            //Determine if a reference is {}
            isEmpty: function (value) {
                return Object.keys(value).length === 0;
            },

            //Determine if a reference is undefined or {}
            isUndefinedOrEmpty: function (value) {
                return (angular.isUndefined(value) || value === null) || Object.keys(value).length === 0;
            },

            // Determine if a reference is defined
            isDefined: function (value) {
                return angular.isDefined(value) && value !== null;
            },

            // Determine if a reference is a number
            isNumber: function (value) {
                return angular.isNumber(value);
            },

            // Determine if a reference is a string
            isString: function (value) {
                return angular.isString(value);
            },

            // Determine if a reference is an array
            isArray: function (value) {
                return angular.isArray(value);
            },

            // Determine if a reference is an object
            isObject: function (value) {
                return angular.isObject(value);
            },

            // Determine if a reference is a function.
            isFunction: function (value) {
                return angular.isFunction(value);
            },

            // Determine if two objects have the same properties
            equals: function (o1, o2) {
                return angular.equals(o1, o2);
            },

            isValidCenter: function (center) {
                return angular.isDefined(center) && angular.isNumber(center.lat) &&
                    angular.isNumber(center.lng) && angular.isNumber(center.zoom);
            },

            isValidPoint: function (point) {
                return angular.isDefined(point) && angular.isNumber(point.lat) &&
                    angular.isNumber(point.lng);
            },

            isSameCenterOnMap: function (centerModel, map) {
                var mapCenter = map.getCenter();
                var zoom = map.getZoom();
                if (centerModel.lat && centerModel.lng &&
                    mapCenter.lat.toFixed(4) === centerModel.lat.toFixed(4) &&
                    mapCenter.lng.toFixed(4) === centerModel.lng.toFixed(4) &&
                    zoom === centerModel.zoom) {
                    return true;
                }
                return false;
            },

            safeApply: function ($scope, fn) {
                var phase = $scope.$root.$$phase;
                if (phase === '$apply' || phase === '$digest') {
                    $scope.$eval(fn);
                } else {
                    $scope.$apply(fn);
                }
            },

            obtainEffectiveMapId: _obtainEffectiveMapId,

            getDefer: function (d, mapId) {
                var id = _obtainEffectiveMapId(d, mapId),
                    defer;
                if (!angular.isDefined(d[id]) || d[id].resolvedDefer === false) {
                    defer = _getUnresolvedDefer(d, mapId);
                } else {
                    defer = d[id].defer;
                }
                return defer;
            },

            getUnresolvedDefer: _getUnresolvedDefer,

            setResolvedDefer: function (d, mapId) {
                var id = _obtainEffectiveMapId(d, mapId);
                d[id].resolvedDefer = true;
            },

            AwesomeMarkersPlugin: {
                isLoaded: function () {
                    if (angular.isDefined(L.AwesomeMarkers) && angular.isDefined(L.AwesomeMarkers.Icon)) {
                        return true;
                    } else {
                        return false;
                    }
                },
                is: function (icon) {
                    if (this.isLoaded()) {
                        return icon instanceof L.AwesomeMarkers.Icon;
                    } else {
                        return false;
                    }
                },
                equal: function (iconA, iconB) {
                    if (!this.isLoaded()) {
                        return false;
                    }
                    if (this.is(iconA)) {
                        return angular.equals(iconA, iconB);
                    } else {
                        return false;
                    }
                }
            },

            PolylineDecoratorPlugin: {
                isLoaded: function () {
                    if (angular.isDefined(L.PolylineDecorator)) {
                        return true;
                    } else {
                        return false;
                    }
                },
                is: function (decoration) {
                    if (this.isLoaded()) {
                        return decoration instanceof L.PolylineDecorator;
                    } else {
                        return false;
                    }
                },
                equal: function (decorationA, decorationB) {
                    if (!this.isLoaded()) {
                        return false;
                    }
                    if (this.is(decorationA)) {
                        return angular.equals(decorationA, decorationB);
                    } else {
                        return false;
                    }
                }
            },

            MakiMarkersPlugin: {
                isLoaded: function () {
                    if (angular.isDefined(L.MakiMarkers) && angular.isDefined(L.MakiMarkers.Icon)) {
                        return true;
                    } else {
                        return false;
                    }
                },
                is: function (icon) {
                    if (this.isLoaded()) {
                        return icon instanceof L.MakiMarkers.Icon;
                    } else {
                        return false;
                    }
                },
                equal: function (iconA, iconB) {
                    if (!this.isLoaded()) {
                        return false;
                    }
                    if (this.is(iconA)) {
                        return angular.equals(iconA, iconB);
                    } else {
                        return false;
                    }
                }
            },
            LabelPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.Label);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.MarkerClusterGroup;
                    } else {
                        return false;
                    }
                }
            },
            MarkerClusterPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.MarkerClusterGroup);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.MarkerClusterGroup;
                    } else {
                        return false;
                    }
                }
            },
            GoogleLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.Google);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.Google;
                    } else {
                        return false;
                    }
                }
            },
            ChinaLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.tileLayer.chinaProvider);
                }
            },
            HeatMapLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.TileLayer.WebGLHeatMap);
                }
            },
            BingLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.BingLayer);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.BingLayer;
                    } else {
                        return false;
                    }
                }
            },
            WFSLayerPlugin: {
                isLoaded: function () {
                    return L.GeoJSON.WFS !== undefined;
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.GeoJSON.WFS;
                    } else {
                        return false;
                    }
                }
            },
            AGSLayerPlugin: {
                isLoaded: function () {
                    return lvector !== undefined && lvector.AGS !== undefined;
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof lvector.AGS;
                    } else {
                        return false;
                    }
                }
            },
            YandexLayerPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.Yandex);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.Yandex;
                    } else {
                        return false;
                    }
                }
            },
            DynamicMapLayerPlugin: {
                isLoaded: function () {
                    return L.esri !== undefined && L.esri.dynamicMapLayer !== undefined;
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.esri.dynamicMapLayer;
                    } else {
                        return false;
                    }
                }
            },
            GeoJSONPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.TileLayer.GeoJSON);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.TileLayer.GeoJSON;
                    } else {
                        return false;
                    }
                }
            },
            UTFGridPlugin: {
                isLoaded: function () {
                    return angular.isDefined(L.UtfGrid);
                },
                is: function (layer) {
                    if (this.isLoaded()) {
                        return layer instanceof L.UtfGrid;
                    } else {
                        $log.error('[AngularJS - Leaflet] No UtfGrid plugin found.');
                        return false;
                    }
                }
            },
            CartoDB: {
                isLoaded: function () {
                    return cartodb;
                },
                is: function (/*layer*/) {
                    return true;
                    /*
                     if (this.isLoaded()) {
                     return layer instanceof L.TileLayer.GeoJSON;
                     } else {
                     return false;
                     }*/
                }
            },
            Leaflet: {
                DivIcon: {
                    is: function (icon) {
                        return icon instanceof L.DivIcon;
                    },
                    equal: function (iconA, iconB) {
                        if (this.is(iconA)) {
                            return angular.equals(iconA, iconB);
                        } else {
                            return false;
                        }
                    }
                },
                Icon: {
                    is: function (icon) {
                        return icon instanceof L.Icon;
                    },
                    equal: function (iconA, iconB) {
                        if (this.is(iconA)) {
                            return angular.equals(iconA, iconB);
                        } else {
                            return false;
                        }
                    }
                }
            }
        };
    }]);

}());;
/*
 Leaflet.markercluster, Provides Beautiful Animated Marker Clustering functionality for Leaflet, a JS library for interactive maps.
 https://github.com/Leaflet/Leaflet.markercluster
 (c) 2012-2013, Dave Leaver, smartrak
*/
!function(t,e){L.MarkerClusterGroup=L.FeatureGroup.extend({options:{maxClusterRadius:80,iconCreateFunction:null,spiderfyOnMaxZoom:!0,showCoverageOnHover:!0,zoomToBoundsOnClick:!0,singleMarkerMode:!1,disableClusteringAtZoom:null,removeOutsideVisibleBounds:!0,animateAddingMarkers:!1,spiderfyDistanceMultiplier:1,chunkedLoading:!1,chunkInterval:200,chunkDelay:50,chunkProgress:null,polygonOptions:{}},initialize:function(t){L.Util.setOptions(this,t),this.options.iconCreateFunction||(this.options.iconCreateFunction=this._defaultIconCreateFunction),this._featureGroup=L.featureGroup(),this._featureGroup.on(L.FeatureGroup.EVENTS,this._propagateEvent,this),this._nonPointGroup=L.featureGroup(),this._nonPointGroup.on(L.FeatureGroup.EVENTS,this._propagateEvent,this),this._inZoomAnimation=0,this._needsClustering=[],this._needsRemoving=[],this._currentShownBounds=null,this._queue=[]},addLayer:function(t){if(t instanceof L.LayerGroup){var e=[];for(var i in t._layers)e.push(t._layers[i]);return this.addLayers(e)}if(!t.getLatLng)return this._nonPointGroup.addLayer(t),this;if(!this._map)return this._needsClustering.push(t),this;if(this.hasLayer(t))return this;this._unspiderfy&&this._unspiderfy(),this._addLayer(t,this._maxZoom);var n=t,s=this._map.getZoom();if(t.__parent)for(;n.__parent._zoom>=s;)n=n.__parent;return this._currentShownBounds.contains(n.getLatLng())&&(this.options.animateAddingMarkers?this._animationAddLayer(t,n):this._animationAddLayerNonAnimated(t,n)),this},removeLayer:function(t){if(t instanceof L.LayerGroup){var e=[];for(var i in t._layers)e.push(t._layers[i]);return this.removeLayers(e)}return t.getLatLng?this._map?t.__parent?(this._unspiderfy&&(this._unspiderfy(),this._unspiderfyLayer(t)),this._removeLayer(t,!0),this._featureGroup.hasLayer(t)&&(this._featureGroup.removeLayer(t),t.setOpacity&&t.setOpacity(1)),this):this:(!this._arraySplice(this._needsClustering,t)&&this.hasLayer(t)&&this._needsRemoving.push(t),this):(this._nonPointGroup.removeLayer(t),this)},addLayers:function(t){var e,i,n,s,r=this._featureGroup,o=this._nonPointGroup,a=this.options.chunkedLoading,h=this.options.chunkInterval,_=this.options.chunkProgress;if(this._map){var u=0,l=(new Date).getTime(),d=L.bind(function(){for(var e=(new Date).getTime();u<t.length;u++){if(a&&0===u%200){var i=(new Date).getTime()-e;if(i>h)break}if(s=t[u],s.getLatLng){if(!this.hasLayer(s)&&(this._addLayer(s,this._maxZoom),s.__parent&&2===s.__parent.getChildCount())){var n=s.__parent.getAllChildMarkers(),p=n[0]===s?n[1]:n[0];r.removeLayer(p)}}else o.addLayer(s)}_&&_(u,t.length,(new Date).getTime()-l),u===t.length?(this._featureGroup.eachLayer(function(t){t instanceof L.MarkerCluster&&t._iconNeedsUpdate&&t._updateIcon()}),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds)):setTimeout(d,this.options.chunkDelay)},this);d()}else{for(e=[],i=0,n=t.length;n>i;i++)s=t[i],s.getLatLng?this.hasLayer(s)||e.push(s):o.addLayer(s);this._needsClustering=this._needsClustering.concat(e)}return this},removeLayers:function(t){var e,i,n,s=this._featureGroup,r=this._nonPointGroup;if(!this._map){for(e=0,i=t.length;i>e;e++)n=t[e],this._arraySplice(this._needsClustering,n),r.removeLayer(n);return this}for(e=0,i=t.length;i>e;e++)n=t[e],n.__parent?(this._removeLayer(n,!0,!0),s.hasLayer(n)&&(s.removeLayer(n),n.setOpacity&&n.setOpacity(1))):r.removeLayer(n);return this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds),s.eachLayer(function(t){t instanceof L.MarkerCluster&&t._updateIcon()}),this},clearLayers:function(){return this._map||(this._needsClustering=[],delete this._gridClusters,delete this._gridUnclustered),this._noanimationUnspiderfy&&this._noanimationUnspiderfy(),this._featureGroup.clearLayers(),this._nonPointGroup.clearLayers(),this.eachLayer(function(t){delete t.__parent}),this._map&&this._generateInitialClusters(),this},getBounds:function(){var t=new L.LatLngBounds;this._topClusterLevel&&t.extend(this._topClusterLevel._bounds);for(var e=this._needsClustering.length-1;e>=0;e--)t.extend(this._needsClustering[e].getLatLng());return t.extend(this._nonPointGroup.getBounds()),t},eachLayer:function(t,e){var i,n=this._needsClustering.slice();for(this._topClusterLevel&&this._topClusterLevel.getAllChildMarkers(n),i=n.length-1;i>=0;i--)t.call(e,n[i]);this._nonPointGroup.eachLayer(t,e)},getLayers:function(){var t=[];return this.eachLayer(function(e){t.push(e)}),t},getLayer:function(t){var e=null;return this.eachLayer(function(i){L.stamp(i)===t&&(e=i)}),e},hasLayer:function(t){if(!t)return!1;var e,i=this._needsClustering;for(e=i.length-1;e>=0;e--)if(i[e]===t)return!0;for(i=this._needsRemoving,e=i.length-1;e>=0;e--)if(i[e]===t)return!1;return!(!t.__parent||t.__parent._group!==this)||this._nonPointGroup.hasLayer(t)},zoomToShowLayer:function(t,e){var i=function(){if((t._icon||t.__parent._icon)&&!this._inZoomAnimation)if(this._map.off("moveend",i,this),this.off("animationend",i,this),t._icon)e();else if(t.__parent._icon){var n=function(){this.off("spiderfied",n,this),e()};this.on("spiderfied",n,this),t.__parent.spiderfy()}};if(t._icon&&this._map.getBounds().contains(t.getLatLng()))e();else if(t.__parent._zoom<this._map.getZoom())this._map.on("moveend",i,this),this._map.panTo(t.getLatLng());else{var n=function(){this._map.off("movestart",n,this),n=null};this._map.on("movestart",n,this),this._map.on("moveend",i,this),this.on("animationend",i,this),t.__parent.zoomToBounds(),n&&i.call(this)}},onAdd:function(t){this._map=t;var e,i,n;if(!isFinite(this._map.getMaxZoom()))throw"Map has no maxZoom specified";for(this._featureGroup.onAdd(t),this._nonPointGroup.onAdd(t),this._gridClusters||this._generateInitialClusters(),e=0,i=this._needsRemoving.length;i>e;e++)n=this._needsRemoving[e],this._removeLayer(n,!0);this._needsRemoving=[],this._zoom=this._map.getZoom(),this._currentShownBounds=this._getExpandedVisibleBounds(),this._map.on("zoomend",this._zoomEnd,this),this._map.on("moveend",this._moveEnd,this),this._spiderfierOnAdd&&this._spiderfierOnAdd(),this._bindEvents(),i=this._needsClustering,this._needsClustering=[],this.addLayers(i)},onRemove:function(t){t.off("zoomend",this._zoomEnd,this),t.off("moveend",this._moveEnd,this),this._unbindEvents(),this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim",""),this._spiderfierOnRemove&&this._spiderfierOnRemove(),this._hideCoverage(),this._featureGroup.onRemove(t),this._nonPointGroup.onRemove(t),this._featureGroup.clearLayers(),this._map=null},getVisibleParent:function(t){for(var e=t;e&&!e._icon;)e=e.__parent;return e||null},_arraySplice:function(t,e){for(var i=t.length-1;i>=0;i--)if(t[i]===e)return t.splice(i,1),!0},_removeLayer:function(t,e,i){var n=this._gridClusters,s=this._gridUnclustered,r=this._featureGroup,o=this._map;if(e)for(var a=this._maxZoom;a>=0&&s[a].removeObject(t,o.project(t.getLatLng(),a));a--);var h,_=t.__parent,u=_._markers;for(this._arraySplice(u,t);_&&(_._childCount--,!(_._zoom<0));)e&&_._childCount<=1?(h=_._markers[0]===t?_._markers[1]:_._markers[0],n[_._zoom].removeObject(_,o.project(_._cLatLng,_._zoom)),s[_._zoom].addObject(h,o.project(h.getLatLng(),_._zoom)),this._arraySplice(_.__parent._childClusters,_),_.__parent._markers.push(h),h.__parent=_.__parent,_._icon&&(r.removeLayer(_),i||r.addLayer(h))):(_._recalculateBounds(),i&&_._icon||_._updateIcon()),_=_.__parent;delete t.__parent},_isOrIsParent:function(t,e){for(;e;){if(t===e)return!0;e=e.parentNode}return!1},_propagateEvent:function(t){if(t.layer instanceof L.MarkerCluster){if(t.originalEvent&&this._isOrIsParent(t.layer._icon,t.originalEvent.relatedTarget))return;t.type="cluster"+t.type}this.fire(t.type,t)},_defaultIconCreateFunction:function(t){var e=t.getChildCount(),i=" marker-cluster-";return i+=10>e?"small":100>e?"medium":"large",new L.DivIcon({html:"<div><span>"+e+"</span></div>",className:"marker-cluster"+i,iconSize:new L.Point(40,40)})},_bindEvents:function(){var t=this._map,e=this.options.spiderfyOnMaxZoom,i=this.options.showCoverageOnHover,n=this.options.zoomToBoundsOnClick;(e||n)&&this.on("clusterclick",this._zoomOrSpiderfy,this),i&&(this.on("clustermouseover",this._showCoverage,this),this.on("clustermouseout",this._hideCoverage,this),t.on("zoomend",this._hideCoverage,this))},_zoomOrSpiderfy:function(t){var e=this._map;e.getMaxZoom()===e.getZoom()?this.options.spiderfyOnMaxZoom&&t.layer.spiderfy():this.options.zoomToBoundsOnClick&&t.layer.zoomToBounds(),t.originalEvent&&13===t.originalEvent.keyCode&&e._container.focus()},_showCoverage:function(t){var e=this._map;this._inZoomAnimation||(this._shownPolygon&&e.removeLayer(this._shownPolygon),t.layer.getChildCount()>2&&t.layer!==this._spiderfied&&(this._shownPolygon=new L.Polygon(t.layer.getConvexHull(),this.options.polygonOptions),e.addLayer(this._shownPolygon)))},_hideCoverage:function(){this._shownPolygon&&(this._map.removeLayer(this._shownPolygon),this._shownPolygon=null)},_unbindEvents:function(){var t=this.options.spiderfyOnMaxZoom,e=this.options.showCoverageOnHover,i=this.options.zoomToBoundsOnClick,n=this._map;(t||i)&&this.off("clusterclick",this._zoomOrSpiderfy,this),e&&(this.off("clustermouseover",this._showCoverage,this),this.off("clustermouseout",this._hideCoverage,this),n.off("zoomend",this._hideCoverage,this))},_zoomEnd:function(){this._map&&(this._mergeSplitClusters(),this._zoom=this._map._zoom,this._currentShownBounds=this._getExpandedVisibleBounds())},_moveEnd:function(){if(!this._inZoomAnimation){var t=this._getExpandedVisibleBounds();this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._map._zoom,t),this._currentShownBounds=t}},_generateInitialClusters:function(){var t=this._map.getMaxZoom(),e=this.options.maxClusterRadius,i=e;"function"!=typeof e&&(i=function(){return e}),this.options.disableClusteringAtZoom&&(t=this.options.disableClusteringAtZoom-1),this._maxZoom=t,this._gridClusters={},this._gridUnclustered={};for(var n=t;n>=0;n--)this._gridClusters[n]=new L.DistanceGrid(i(n)),this._gridUnclustered[n]=new L.DistanceGrid(i(n));this._topClusterLevel=new L.MarkerCluster(this,-1)},_addLayer:function(t,e){var i,n,s=this._gridClusters,r=this._gridUnclustered;for(this.options.singleMarkerMode&&(t.options.icon=this.options.iconCreateFunction({getChildCount:function(){return 1},getAllChildMarkers:function(){return[t]}}));e>=0;e--){i=this._map.project(t.getLatLng(),e);var o=s[e].getNearObject(i);if(o)return o._addChild(t),t.__parent=o,void 0;if(o=r[e].getNearObject(i)){var a=o.__parent;a&&this._removeLayer(o,!1);var h=new L.MarkerCluster(this,e,o,t);s[e].addObject(h,this._map.project(h._cLatLng,e)),o.__parent=h,t.__parent=h;var _=h;for(n=e-1;n>a._zoom;n--)_=new L.MarkerCluster(this,n,_),s[n].addObject(_,this._map.project(o.getLatLng(),n));for(a._addChild(_),n=e;n>=0&&r[n].removeObject(o,this._map.project(o.getLatLng(),n));n--);return}r[e].addObject(t,i)}this._topClusterLevel._addChild(t),t.__parent=this._topClusterLevel},_enqueue:function(t){this._queue.push(t),this._queueTimeout||(this._queueTimeout=setTimeout(L.bind(this._processQueue,this),300))},_processQueue:function(){for(var t=0;t<this._queue.length;t++)this._queue[t].call(this);this._queue.length=0,clearTimeout(this._queueTimeout),this._queueTimeout=null},_mergeSplitClusters:function(){this._processQueue(),this._zoom<this._map._zoom&&this._currentShownBounds.intersects(this._getExpandedVisibleBounds())?(this._animationStart(),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,this._getExpandedVisibleBounds()),this._animationZoomIn(this._zoom,this._map._zoom)):this._zoom>this._map._zoom?(this._animationStart(),this._animationZoomOut(this._zoom,this._map._zoom)):this._moveEnd()},_getExpandedVisibleBounds:function(){if(!this.options.removeOutsideVisibleBounds)return this.getBounds();var t=this._map,e=t.getBounds(),i=e._southWest,n=e._northEast,s=L.Browser.mobile?0:Math.abs(i.lat-n.lat),r=L.Browser.mobile?0:Math.abs(i.lng-n.lng);return new L.LatLngBounds(new L.LatLng(i.lat-s,i.lng-r,!0),new L.LatLng(n.lat+s,n.lng+r,!0))},_animationAddLayerNonAnimated:function(t,e){if(e===t)this._featureGroup.addLayer(t);else if(2===e._childCount){e._addToMap();var i=e.getAllChildMarkers();this._featureGroup.removeLayer(i[0]),this._featureGroup.removeLayer(i[1])}else e._updateIcon()}}),L.MarkerClusterGroup.include(L.DomUtil.TRANSITION?{_animationStart:function(){this._map._mapPane.className+=" leaflet-cluster-anim",this._inZoomAnimation++},_animationEnd:function(){this._map&&(this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim","")),this._inZoomAnimation--,this.fire("animationend")},_animationZoomIn:function(t,e){var i,n=this._getExpandedVisibleBounds(),s=this._featureGroup;this._topClusterLevel._recursively(n,t,0,function(r){var o,a=r._latlng,h=r._markers;for(n.contains(a)||(a=null),r._isSingleParent()&&t+1===e?(s.removeLayer(r),r._recursivelyAddChildrenToMap(null,e,n)):(r.setOpacity(0),r._recursivelyAddChildrenToMap(a,e,n)),i=h.length-1;i>=0;i--)o=h[i],n.contains(o._latlng)||s.removeLayer(o)}),this._forceLayout(),this._topClusterLevel._recursivelyBecomeVisible(n,e),s.eachLayer(function(t){t instanceof L.MarkerCluster||!t._icon||t.setOpacity(1)}),this._topClusterLevel._recursively(n,t,e,function(t){t._recursivelyRestoreChildPositions(e)}),this._enqueue(function(){this._topClusterLevel._recursively(n,t,0,function(t){s.removeLayer(t),t.setOpacity(1)}),this._animationEnd()})},_animationZoomOut:function(t,e){this._animationZoomOutSingle(this._topClusterLevel,t-1,e),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t,this._getExpandedVisibleBounds())},_animationZoomOutSingle:function(t,e,i){var n=this._getExpandedVisibleBounds();t._recursivelyAnimateChildrenInAndAddSelfToMap(n,e+1,i);var s=this;this._forceLayout(),t._recursivelyBecomeVisible(n,i),this._enqueue(function(){if(1===t._childCount){var r=t._markers[0];r.setLatLng(r.getLatLng()),r.setOpacity&&r.setOpacity(1)}else t._recursively(n,i,0,function(t){t._recursivelyRemoveChildrenFromMap(n,e+1)});s._animationEnd()})},_animationAddLayer:function(t,e){var i=this,n=this._featureGroup;n.addLayer(t),e!==t&&(e._childCount>2?(e._updateIcon(),this._forceLayout(),this._animationStart(),t._setPos(this._map.latLngToLayerPoint(e.getLatLng())),t.setOpacity(0),this._enqueue(function(){n.removeLayer(t),t.setOpacity(1),i._animationEnd()})):(this._forceLayout(),i._animationStart(),i._animationZoomOutSingle(e,this._map.getMaxZoom(),this._map.getZoom())))},_forceLayout:function(){L.Util.falseFn(e.body.offsetWidth)}}:{_animationStart:function(){},_animationZoomIn:function(t,e){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this.fire("animationend")},_animationZoomOut:function(t,e){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,e,this._getExpandedVisibleBounds()),this.fire("animationend")},_animationAddLayer:function(t,e){this._animationAddLayerNonAnimated(t,e)}}),L.markerClusterGroup=function(t){return new L.MarkerClusterGroup(t)},L.MarkerCluster=L.Marker.extend({initialize:function(t,e,i,n){L.Marker.prototype.initialize.call(this,i?i._cLatLng||i.getLatLng():new L.LatLng(0,0),{icon:this}),this._group=t,this._zoom=e,this._markers=[],this._childClusters=[],this._childCount=0,this._iconNeedsUpdate=!0,this._bounds=new L.LatLngBounds,i&&this._addChild(i),n&&this._addChild(n)},getAllChildMarkers:function(t){t=t||[];for(var e=this._childClusters.length-1;e>=0;e--)this._childClusters[e].getAllChildMarkers(t);for(var i=this._markers.length-1;i>=0;i--)t.push(this._markers[i]);return t},getChildCount:function(){return this._childCount},zoomToBounds:function(){for(var t,e=this._childClusters.slice(),i=this._group._map,n=i.getBoundsZoom(this._bounds),s=this._zoom+1,r=i.getZoom();e.length>0&&n>s;){s++;var o=[];for(t=0;t<e.length;t++)o=o.concat(e[t]._childClusters);e=o}n>s?this._group._map.setView(this._latlng,s):r>=n?this._group._map.setView(this._latlng,r+1):this._group._map.fitBounds(this._bounds)},getBounds:function(){var t=new L.LatLngBounds;return t.extend(this._bounds),t},_updateIcon:function(){this._iconNeedsUpdate=!0,this._icon&&this.setIcon(this)},createIcon:function(){return this._iconNeedsUpdate&&(this._iconObj=this._group.options.iconCreateFunction(this),this._iconNeedsUpdate=!1),this._iconObj.createIcon()},createShadow:function(){return this._iconObj.createShadow()},_addChild:function(t,e){this._iconNeedsUpdate=!0,this._expandBounds(t),t instanceof L.MarkerCluster?(e||(this._childClusters.push(t),t.__parent=this),this._childCount+=t._childCount):(e||this._markers.push(t),this._childCount++),this.__parent&&this.__parent._addChild(t,!0)},_expandBounds:function(t){var e,i=t._wLatLng||t._latlng;t instanceof L.MarkerCluster?(this._bounds.extend(t._bounds),e=t._childCount):(this._bounds.extend(i),e=1),this._cLatLng||(this._cLatLng=t._cLatLng||i);var n=this._childCount+e;this._wLatLng?(this._wLatLng.lat=(i.lat*e+this._wLatLng.lat*this._childCount)/n,this._wLatLng.lng=(i.lng*e+this._wLatLng.lng*this._childCount)/n):this._latlng=this._wLatLng=new L.LatLng(i.lat,i.lng)},_addToMap:function(t){t&&(this._backupLatlng=this._latlng,this.setLatLng(t)),this._group._featureGroup.addLayer(this)},_recursivelyAnimateChildrenIn:function(t,e,i){this._recursively(t,0,i-1,function(t){var i,n,s=t._markers;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(e),n.setOpacity(0))},function(t){var i,n,s=t._childClusters;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(e),n.setOpacity(0))})},_recursivelyAnimateChildrenInAndAddSelfToMap:function(t,e,i){this._recursively(t,i,0,function(n){n._recursivelyAnimateChildrenIn(t,n._group._map.latLngToLayerPoint(n.getLatLng()).round(),e),n._isSingleParent()&&e-1===i?(n.setOpacity(1),n._recursivelyRemoveChildrenFromMap(t,e)):n.setOpacity(0),n._addToMap()})},_recursivelyBecomeVisible:function(t,e){this._recursively(t,0,e,null,function(t){t.setOpacity(1)})},_recursivelyAddChildrenToMap:function(t,e,i){this._recursively(i,-1,e,function(n){if(e!==n._zoom)for(var s=n._markers.length-1;s>=0;s--){var r=n._markers[s];i.contains(r._latlng)&&(t&&(r._backupLatlng=r.getLatLng(),r.setLatLng(t),r.setOpacity&&r.setOpacity(0)),n._group._featureGroup.addLayer(r))}},function(e){e._addToMap(t)})},_recursivelyRestoreChildPositions:function(t){for(var e=this._markers.length-1;e>=0;e--){var i=this._markers[e];i._backupLatlng&&(i.setLatLng(i._backupLatlng),delete i._backupLatlng)}if(t-1===this._zoom)for(var n=this._childClusters.length-1;n>=0;n--)this._childClusters[n]._restorePosition();else for(var s=this._childClusters.length-1;s>=0;s--)this._childClusters[s]._recursivelyRestoreChildPositions(t)},_restorePosition:function(){this._backupLatlng&&(this.setLatLng(this._backupLatlng),delete this._backupLatlng)},_recursivelyRemoveChildrenFromMap:function(t,e,i){var n,s;this._recursively(t,-1,e-1,function(t){for(s=t._markers.length-1;s>=0;s--)n=t._markers[s],i&&i.contains(n._latlng)||(t._group._featureGroup.removeLayer(n),n.setOpacity&&n.setOpacity(1))},function(t){for(s=t._childClusters.length-1;s>=0;s--)n=t._childClusters[s],i&&i.contains(n._latlng)||(t._group._featureGroup.removeLayer(n),n.setOpacity&&n.setOpacity(1))})},_recursively:function(t,e,i,n,s){var r,o,a=this._childClusters,h=this._zoom;if(e>h)for(r=a.length-1;r>=0;r--)o=a[r],t.intersects(o._bounds)&&o._recursively(t,e,i,n,s);else if(n&&n(this),s&&this._zoom===i&&s(this),i>h)for(r=a.length-1;r>=0;r--)o=a[r],t.intersects(o._bounds)&&o._recursively(t,e,i,n,s)},_recalculateBounds:function(){var t,e=this._markers,i=this._childClusters;for(this._bounds=new L.LatLngBounds,delete this._wLatLng,t=e.length-1;t>=0;t--)this._expandBounds(e[t]);for(t=i.length-1;t>=0;t--)this._expandBounds(i[t])},_isSingleParent:function(){return this._childClusters.length>0&&this._childClusters[0]._childCount===this._childCount}}),L.DistanceGrid=function(t){this._cellSize=t,this._sqCellSize=t*t,this._grid={},this._objectPoint={}},L.DistanceGrid.prototype={addObject:function(t,e){var i=this._getCoord(e.x),n=this._getCoord(e.y),s=this._grid,r=s[n]=s[n]||{},o=r[i]=r[i]||[],a=L.Util.stamp(t);this._objectPoint[a]=e,o.push(t)},updateObject:function(t,e){this.removeObject(t),this.addObject(t,e)},removeObject:function(t,e){var i,n,s=this._getCoord(e.x),r=this._getCoord(e.y),o=this._grid,a=o[r]=o[r]||{},h=a[s]=a[s]||[];for(delete this._objectPoint[L.Util.stamp(t)],i=0,n=h.length;n>i;i++)if(h[i]===t)return h.splice(i,1),1===n&&delete a[s],!0},eachObject:function(t,e){var i,n,s,r,o,a,h,_=this._grid;for(i in _){o=_[i];for(n in o)for(a=o[n],s=0,r=a.length;r>s;s++)h=t.call(e,a[s]),h&&(s--,r--)}},getNearObject:function(t){var e,i,n,s,r,o,a,h,_=this._getCoord(t.x),u=this._getCoord(t.y),l=this._objectPoint,d=this._sqCellSize,p=null;for(e=u-1;u+1>=e;e++)if(s=this._grid[e])for(i=_-1;_+1>=i;i++)if(r=s[i])for(n=0,o=r.length;o>n;n++)a=r[n],h=this._sqDist(l[L.Util.stamp(a)],t),d>h&&(d=h,p=a);return p},_getCoord:function(t){return Math.floor(t/this._cellSize)},_sqDist:function(t,e){var i=e.x-t.x,n=e.y-t.y;return i*i+n*n}},function(){L.QuickHull={getDistant:function(t,e){var i=e[1].lat-e[0].lat,n=e[0].lng-e[1].lng;return n*(t.lat-e[0].lat)+i*(t.lng-e[0].lng)},findMostDistantPointFromBaseLine:function(t,e){var i,n,s,r=0,o=null,a=[];for(i=e.length-1;i>=0;i--)n=e[i],s=this.getDistant(n,t),s>0&&(a.push(n),s>r&&(r=s,o=n));return{maxPoint:o,newPoints:a}},buildConvexHull:function(t,e){var i=[],n=this.findMostDistantPointFromBaseLine(t,e);return n.maxPoint?(i=i.concat(this.buildConvexHull([t[0],n.maxPoint],n.newPoints)),i=i.concat(this.buildConvexHull([n.maxPoint,t[1]],n.newPoints))):[t[0]]},getConvexHull:function(t){var e,i=!1,n=!1,s=null,r=null;for(e=t.length-1;e>=0;e--){var o=t[e];(i===!1||o.lat>i)&&(s=o,i=o.lat),(n===!1||o.lat<n)&&(r=o,n=o.lat)}var a=[].concat(this.buildConvexHull([r,s],t),this.buildConvexHull([s,r],t));return a}}}(),L.MarkerCluster.include({getConvexHull:function(){var t,e,i=this.getAllChildMarkers(),n=[];for(e=i.length-1;e>=0;e--)t=i[e].getLatLng(),n.push(t);return L.QuickHull.getConvexHull(n)}}),L.MarkerCluster.include({_2PI:2*Math.PI,_circleFootSeparation:25,_circleStartAngle:Math.PI/6,_spiralFootSeparation:28,_spiralLengthStart:11,_spiralLengthFactor:5,_circleSpiralSwitchover:9,spiderfy:function(){if(this._group._spiderfied!==this&&!this._group._inZoomAnimation){var t,e=this.getAllChildMarkers(),i=this._group,n=i._map,s=n.latLngToLayerPoint(this._latlng);this._group._unspiderfy(),this._group._spiderfied=this,e.length>=this._circleSpiralSwitchover?t=this._generatePointsSpiral(e.length,s):(s.y+=10,t=this._generatePointsCircle(e.length,s)),this._animationSpiderfy(e,t)}},unspiderfy:function(t){this._group._inZoomAnimation||(this._animationUnspiderfy(t),this._group._spiderfied=null)},_generatePointsCircle:function(t,e){var i,n,s=this._group.options.spiderfyDistanceMultiplier*this._circleFootSeparation*(2+t),r=s/this._2PI,o=this._2PI/t,a=[];for(a.length=t,i=t-1;i>=0;i--)n=this._circleStartAngle+i*o,a[i]=new L.Point(e.x+r*Math.cos(n),e.y+r*Math.sin(n))._round();return a},_generatePointsSpiral:function(t,e){var i,n=this._group.options.spiderfyDistanceMultiplier*this._spiralLengthStart,s=this._group.options.spiderfyDistanceMultiplier*this._spiralFootSeparation,r=this._group.options.spiderfyDistanceMultiplier*this._spiralLengthFactor,o=0,a=[];for(a.length=t,i=t-1;i>=0;i--)o+=s/n+5e-4*i,a[i]=new L.Point(e.x+n*Math.cos(o),e.y+n*Math.sin(o))._round(),n+=this._2PI*r/o;return a},_noanimationUnspiderfy:function(){var t,e,i=this._group,n=i._map,s=i._featureGroup,r=this.getAllChildMarkers();for(this.setOpacity(1),e=r.length-1;e>=0;e--)t=r[e],s.removeLayer(t),t._preSpiderfyLatlng&&(t.setLatLng(t._preSpiderfyLatlng),delete t._preSpiderfyLatlng),t.setZIndexOffset&&t.setZIndexOffset(0),t._spiderLeg&&(n.removeLayer(t._spiderLeg),delete t._spiderLeg);i._spiderfied=null}}),L.MarkerCluster.include(L.DomUtil.TRANSITION?{SVG_ANIMATION:function(){return e.createElementNS("http://www.w3.org/2000/svg","animate").toString().indexOf("SVGAnimate")>-1}(),_animationSpiderfy:function(t,i){var n,s,r,o,a=this,h=this._group,_=h._map,u=h._featureGroup,l=_.latLngToLayerPoint(this._latlng);for(n=t.length-1;n>=0;n--)s=t[n],s.setOpacity?(s.setZIndexOffset(1e6),s.setOpacity(0),u.addLayer(s),s._setPos(l)):u.addLayer(s);h._forceLayout(),h._animationStart();var d=L.Path.SVG?0:.3,p=L.Path.SVG_NS;for(n=t.length-1;n>=0;n--)if(o=_.layerPointToLatLng(i[n]),s=t[n],s._preSpiderfyLatlng=s._latlng,s.setLatLng(o),s.setOpacity&&s.setOpacity(1),r=new L.Polyline([a._latlng,o],{weight:1.5,color:"#222",opacity:d}),_.addLayer(r),s._spiderLeg=r,L.Path.SVG&&this.SVG_ANIMATION){var c=r._path.getTotalLength();r._path.setAttribute("stroke-dasharray",c+","+c);var f=e.createElementNS(p,"animate");f.setAttribute("attributeName","stroke-dashoffset"),f.setAttribute("begin","indefinite"),f.setAttribute("from",c),f.setAttribute("to",0),f.setAttribute("dur",.25),r._path.appendChild(f),f.beginElement(),f=e.createElementNS(p,"animate"),f.setAttribute("attributeName","stroke-opacity"),f.setAttribute("attributeName","stroke-opacity"),f.setAttribute("begin","indefinite"),f.setAttribute("from",0),f.setAttribute("to",.5),f.setAttribute("dur",.25),r._path.appendChild(f),f.beginElement()}if(a.setOpacity(.3),L.Path.SVG)for(this._group._forceLayout(),n=t.length-1;n>=0;n--)s=t[n]._spiderLeg,s.options.opacity=.5,s._path.setAttribute("stroke-opacity",.5);setTimeout(function(){h._animationEnd(),h.fire("spiderfied")},200)},_animationUnspiderfy:function(t){var e,i,n,s=this._group,r=s._map,o=s._featureGroup,a=t?r._latLngToNewLayerPoint(this._latlng,t.zoom,t.center):r.latLngToLayerPoint(this._latlng),h=this.getAllChildMarkers(),_=L.Path.SVG&&this.SVG_ANIMATION;for(s._animationStart(),this.setOpacity(1),i=h.length-1;i>=0;i--)e=h[i],e._preSpiderfyLatlng&&(e.setLatLng(e._preSpiderfyLatlng),delete e._preSpiderfyLatlng,e.setOpacity?(e._setPos(a),e.setOpacity(0)):o.removeLayer(e),_&&(n=e._spiderLeg._path.childNodes[0],n.setAttribute("to",n.getAttribute("from")),n.setAttribute("from",0),n.beginElement(),n=e._spiderLeg._path.childNodes[1],n.setAttribute("from",.5),n.setAttribute("to",0),n.setAttribute("stroke-opacity",0),n.beginElement(),e._spiderLeg._path.setAttribute("stroke-opacity",0)));setTimeout(function(){var t=0;for(i=h.length-1;i>=0;i--)e=h[i],e._spiderLeg&&t++;for(i=h.length-1;i>=0;i--)e=h[i],e._spiderLeg&&(e.setOpacity&&(e.setOpacity(1),e.setZIndexOffset(0)),t>1&&o.removeLayer(e),r.removeLayer(e._spiderLeg),delete e._spiderLeg);s._animationEnd()},200)}}:{_animationSpiderfy:function(t,e){var i,n,s,r,o=this._group,a=o._map,h=o._featureGroup;for(i=t.length-1;i>=0;i--)r=a.layerPointToLatLng(e[i]),n=t[i],n._preSpiderfyLatlng=n._latlng,n.setLatLng(r),n.setZIndexOffset&&n.setZIndexOffset(1e6),h.addLayer(n),s=new L.Polyline([this._latlng,r],{weight:1.5,color:"#222"}),a.addLayer(s),n._spiderLeg=s;this.setOpacity(.3),o.fire("spiderfied")},_animationUnspiderfy:function(){this._noanimationUnspiderfy()}}),L.MarkerClusterGroup.include({_spiderfied:null,_spiderfierOnAdd:function(){this._map.on("click",this._unspiderfyWrapper,this),this._map.options.zoomAnimation&&this._map.on("zoomstart",this._unspiderfyZoomStart,this),this._map.on("zoomend",this._noanimationUnspiderfy,this),L.Path.SVG&&!L.Browser.touch&&this._map._initPathRoot()},_spiderfierOnRemove:function(){this._map.off("click",this._unspiderfyWrapper,this),this._map.off("zoomstart",this._unspiderfyZoomStart,this),this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy()},_unspiderfyZoomStart:function(){this._map&&this._map.on("zoomanim",this._unspiderfyZoomAnim,this)},_unspiderfyZoomAnim:function(t){L.DomUtil.hasClass(this._map._mapPane,"leaflet-touching")||(this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy(t))},_unspiderfyWrapper:function(){this._unspiderfy()},_unspiderfy:function(t){this._spiderfied&&this._spiderfied.unspiderfy(t)},_noanimationUnspiderfy:function(){this._spiderfied&&this._spiderfied._noanimationUnspiderfy()},_unspiderfyLayer:function(t){t._spiderLeg&&(this._featureGroup.removeLayer(t),t.setOpacity(1),t.setZIndexOffset(0),this._map.removeLayer(t._spiderLeg),delete t._spiderLeg)}})}(window,document);;
/*
 * Google layer using Google Maps API
 */
//(function (google, L) {

L.Google = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		opacity: 1,
		continuousWorld: false,
		noWrap: false,
		mapOptions: {
			backgroundColor: '#dddddd'
		}
	},

	// Possible types: SATELLITE, ROADMAP, HYBRID, TERRAIN
	initialize: function(type, options) {
		L.Util.setOptions(this, options);

		this._ready = google.maps.Map != undefined;
		if (!this._ready) L.Google.asyncWait.push(this);

		this._type = type || 'SATELLITE';
	},

	onAdd: function(map, insertAtTheBottom) {
		this._map = map;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();
		this._initMapObject();

		// set up events
		map.on('viewreset', this._resetCallback, this);

		this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
		map.on('move', this._update, this);

		map.on('zoomanim', this._handleZoomAnim, this);

		//20px instead of 1em to avoid a slight overlap with google's attribution
		map._controlCorners['bottomright'].style.marginBottom = "20px";

		this._reset();
		this._update();
	},

	onRemove: function(map) {
		this._map._container.removeChild(this._container);
		//this._container = null;

		this._map.off('viewreset', this._resetCallback, this);

		this._map.off('move', this._update, this);

		this._map.off('zoomanim', this._handleZoomAnim, this);

		map._controlCorners['bottomright'].style.marginBottom = "0em";
		//this._map.off('moveend', this._update, this);
	},

	getAttribution: function() {
		return this.options.attribution;
	},

	setOpacity: function(opacity) {
		this.options.opacity = opacity;
		if (opacity < 1) {
			L.DomUtil.setOpacity(this._container, opacity);
		}
	},

	setElementSize: function(e, size) {
		e.style.width = size.x + "px";
		e.style.height = size.y + "px";
	},

	_initContainer: function() {
		var tilePane = this._map._container,
			first = tilePane.firstChild;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-google-layer leaflet-top leaflet-left');
			this._container.id = "_GMapContainer_" + L.Util.stamp(this);
			this._container.style.zIndex = "auto";
		}

		if (true) {
			tilePane.insertBefore(this._container, first);

			this.setOpacity(this.options.opacity);
			this.setElementSize(this._container, this._map.getSize());
		}
	},

	_initMapObject: function() {
		if (!this._ready) return;
		this._google_center = new google.maps.LatLng(0, 0);
		var map = new google.maps.Map(this._container, {
		    center: this._google_center,
		    zoom: 0,
		    tilt: 0,
		    mapTypeId: google.maps.MapTypeId[this._type],
		    disableDefaultUI: true,
		    keyboardShortcuts: false,
		    draggable: false,
		    disableDoubleClickZoom: true,
		    scrollwheel: false,
		    streetViewControl: false,
		    styles: this.options.mapOptions.styles,
		    backgroundColor: this.options.mapOptions.backgroundColor
		});

		var _this = this;
		this._reposition = google.maps.event.addListenerOnce(map, "center_changed",
			function() { _this.onReposition(); });
		this._google = map;

		google.maps.event.addListenerOnce(map, "idle",
			function() { _this._checkZoomLevels(); });
	},

	_checkZoomLevels: function() {
		//setting the zoom level on the Google map may result in a different zoom level than the one requested
		//(it won't go beyond the level for which they have data).
		// verify and make sure the zoom levels on both Leaflet and Google maps are consistent
		if (this._google.getZoom() !== this._map.getZoom()) {
			//zoom levels are out of sync. Set the leaflet zoom level to match the google one
			this._map.setZoom( this._google.getZoom() );
		}
	},

	_resetCallback: function(e) {
		this._reset(e.hard);
	},

	_reset: function(clearOldContainer) {
		this._initContainer();
	},

	_update: function(e) {
		if (!this._google) return;
		this._resize();

		var center = e && e.latlng ? e.latlng : this._map.getCenter();
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(this._map.getZoom());

		this._checkZoomLevels();
		//this._google.fitBounds(google_bounds);
	},

	_resize: function() {
		var size = this._map.getSize();
		if (this._container.style.width == size.x &&
		    this._container.style.height == size.y)
			return;
		this.setElementSize(this._container, size);
		this.onReposition();
	},


	_handleZoomAnim: function (e) {
		var center = e.center;
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(e.zoom);
	},


	onReposition: function() {
		if (!this._google) return;
		google.maps.event.trigger(this._google, "resize");
	}
});

L.Google.asyncWait = [];
L.Google.asyncInitialize = function() {
	var i;
	for (i = 0; i < L.Google.asyncWait.length; i++) {
		var o = L.Google.asyncWait[i];
		o._ready = true;
		if (o._container) {
			o._initMapObject();
			o._update();
		}
	}
	L.Google.asyncWait = [];
};
//})(window.google, L);
var gfsad = {};
gfsad.decToHex = function (n) {
    // return two digit hex number
    if (n > 255) {
        throw "Cannot convert to hex.";
    }
    return (n + 0x100).toString(16).substr(-2).toUpperCase();
};;
var app = angular.module("app", ["leaflet-directive", "ngRoute", 'mgcrea.ngStrap']);
app.config(['$tooltipProvider', '$routeProvider', 'version', '$sceDelegateProvider', '$locationProvider', function ($tooltipProvider, $routeProvider, version, $sceDelegateProvider, $locationProvider) {
    $routeProvider
        // route for the home page
        .when('/', {
//            templateUrl: 'http://cache.croplands.org/static/partials/home.html',
            templateUrl: '/static/partials/home.html'
        }).when('/map', {
//            templateUrl: 'http://cache.croplands.org/static/partials/map.' + version + '.html',
            templateUrl: '/static/partials/map.' + version + '.html',
            controller: 'mapCtrl',
            reloadOnSearch: false
        }).when('/account/dashboard', {
//            templateUrl: 'http://cache.croplands.org/static/partials/map.' + version + '.html',
            templateUrl: '/static/partials/dashboard.' + version + '.html',
            controller: 'dashboardCtrl'
        }).when('/account/profile', {
//            templateUrl: 'http://cache.croplands.org/static/partials/map.' + version + '.html',
            templateUrl: '/static/partials/profile.' + version + '.html',
            controller: 'profileCtrl'
        }).when('/account/score', {
//            templateUrl: 'http://cache.croplands.org/static/partials/map.' + version + '.html',
            templateUrl: '/static/partials/score.' + version + '.html',
            controller: 'scoreCtrl'
        }).when('/account/notifications', {
//            templateUrl: 'http://cache.croplands.org/static/partials/map.' + version + '.html',
            templateUrl: '/static/partials/notifications.' + version + '.html',
            controller: 'notificationsCtrl'
        }).when('/account/login', {
            template: '',
            controller: 'accountFormCtrl'
        }).when('/account/register', {
            template: '',
            controller: 'accountFormCtrl'
        }).when('/account/forgot', {
            template: '',
            controller: 'accountFormCtrl'
        }).when('/account/reset', {
            templateUrl: '/static/partials/reset.html',
            controller: 'resetCtrl'
        }).otherwise({
            templateUrl: '/static/partials/404.html'
        });

    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!#');

    angular.extend($tooltipProvider.defaults, {
        animation: 'am-fade-and-scale',
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });
    $sceDelegateProvider.resourceUrlWhitelist([
        // Allow same origin resource loads.ot
        'self',
        // Allow loading from our assets domain.  Notice the difference between * and **.
        'http://cache.croplands.org/static/**']);
}]);

app.run([
    '$http',
    '$window',
    function ($http, $window) {
        $http.defaults.headers.post['X-CSRFToken'] = $window.csrfToken;
    }]);;
/**
 * Created by justin on 12/5/14.
 */
app.factory('awsUrlSigning', ['$http', 'log', '$window', '$q', function ($http, log, $window, $q) {
    var aws = {};
    var params, expiration;

    function getCurrentParams() {
        var deferred = $q.defer();
        $http.post('/aws/policy', {}).
            success(function (data, status, headers, config) {
                // this callback will be called asynchronously
                // when the response is available
                params = data.params;
                expiration = data.expires;
                deferred.resolve(data);
            }).
            error(function (data, status, headers, config) {
                // called asynchronously if an error occurs
                // or server returns response with an error status.
                deferred.reject(data);
            });
        return deferred.promise;
    }

    aws.getParams = function () {
        var deferred = $q.defer();

        if (expiration === undefined || params === undefined || expiration - Date.now() / 1000 < 30) {
            getCurrentParams().then(function () {
                log.info("Downloaded signed url parameters.");
                deferred.resolve(params);
            }, function () {
                log.warn("Could not get signed url parameters.");
                deferred.reject();
            });
        } else {
            deferred.resolve(params);
        }
        return deferred.promise;
    };


    // init
//    aws.getParams();

    return aws;
}]);;
app.constant('countries', [
      "Afghanistan", "Aland Islands", "Albania", "Algeria", "American Samoa", "Andorra", "Angola",
      "Anguilla", "Antarctica", "Antigua And Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria",
      "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
      "Bermuda", "Bhutan", "Bolivia, Plurinational State of", "Bonaire, Sint Eustatius and Saba", "Bosnia and Herzegovina",
      "Botswana", "Bouvet Island", "Brazil",
      "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia",
      "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China",
      "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo",
      "Congo, the Democratic Republic of the", "Cook Islands", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba",
      "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
      "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Falkland Islands (Malvinas)",
      "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia",
      "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece",
      "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea",
      "Guinea-Bissau", "Guyana", "Haiti", "Heard Island and McDonald Islands", "Holy See (Vatican City State)",
      "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran, Islamic Republic of", "Iraq",
      "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya",
      "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan",
      "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
      "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Macedonia, The Former Yugoslav Republic Of",
      "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique",
      "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of",
      "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
      "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger",
      "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau",
      "Palestinian Territory, Occupied", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines",
      "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation",
      "Rwanda", "Saint Barthelemy", "Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis", "Saint Lucia",
      "Saint Martin (French Part)", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
      "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
      "Sint Maarten (Dutch Part)", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
      "South Georgia and the South Sandwich Islands", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
      "Svalbard and Jan Mayen", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic",
      "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Timor-Leste",
      "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
      "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
      "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu",
      "Venezuela, Bolivarian Republic of", "Viet Nam", "Virgin Islands, British", "Virgin Islands, U.S.",
      "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"
    ])
;
app.factory("icons", [ function (){
var base = {
shadowUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAApCAYAAACoYAD2AAAC5ElEQVRYw+2YW4/TMBCF45S0S1luXZCABy5CgLQgwf//S4BYBLTdJLax0fFqmB07nnQfEGqkIydpVH85M+NLjPe++dcPc4Q8Qh4hj5D/AaQJx6H/4TMwB0PeBNwU7EGQAmAtsNfAzoZkgIa0ZgLMa4Aj6CxIAsjhjOCoL5z7Glg1JAOkaicgvQBXuncwJAWjksLtBTWZe04CnYRktUGdilALppZBOgHGZcBzL6OClABvMSVIzyBjazOgrvACf1ydC5mguqAVg6RhdkSWQFj2uxfaq/BrIZOLEWgZdALIDvcMcZLD8ZbLC9de4yR1sYMi4G20S4Q/PWeJYxTOZn5zJXANZHIxAd4JWhPIloTJZhzMQduM89WQ3MUVAE/RnhAXpTycqys3NZALOBbB7kFrgLesQl2h45Fcj8L1tTSohUwuxhy8H/Qg6K7gIs+3kkaigQCOcyEXCHN07wyQazhrmIulvKMQAwMcmLNqyCVyMAI+BuxSMeTk3OPikLY2J1uE+VHQk6ANrhds+tNARqBeaGc72cK550FP4WhXmFmcMGhTwAR1ifOe3EvPqIegFmF+C8gVy0OfAaWQPMR7gF1OQKqGoBjq90HPMP01BUjPOqGFksC4emE48tWQAH0YmvOgF3DST6xieJgHAWxPAHMuNhrImIdvoNOKNWIOcE+UXE0pYAnkX6uhWsgVXDxHdTfCmrEEmMB2zMFimLVOtiiajxiGWrbU52EeCdyOwPEQD8LqyPH9Ti2kgYMf4OhSKB7qYILbBv3CuVTJ11Y80oaseiMWOONc/Y7kJYe0xL2f0BaiFTxknHO5HaMGMublKwxFGzYdWsBF174H/QDknhTHmHHN39iWFnkZx8lPyM8WHfYELmlLKtgWNmFNzQcC1b47gJ4hL19i7o65dhH0Negbca8vONZoP7doIeOC9zXm8RjuL0Gf4d4OYaU5ljo3GYiqzrWQHfJxA6ALhDpVKv9qYeZA8eM3EhfPSCmpuD0AAAAASUVORK5CYII=",
 iconSize: [25, 41],
 iconAnchor: [12, 41],
 shadowAnchor: [12, 41],
 popupAnchor: [1, -34],
 shadowSize: [41, 41]
};

return {
iconCroplandContinuousIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousIrrigated: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHZElEQVR4nLWXe3BU9RXHP/d3H5ub7GY3yyObJkAIkKRAICA+AtGiFClVixTa8Q90cOxYGJBaax/4bMEBplbHR2oGZmoZpziNSLHO0BYRGpSstspAecgz09ik7CYksLvZV+7e3F//wKQsSSBO6ZnZmb2/Pef7+Z3zO7+zu4qUkv+3aQD66jmHpar4rru6I9vsV5tqFSklxsrZsmTi9We0nY0AjNeMlbPnOoaIFxWY7g7bum6A0ZrB57lxW03apRrgUwzVLaUklElfN0ieomLmaJqVtOcKKZRbTFMj6TgAPDb+VuKr9tD6YAOzTN+wBGeZPuKr9hBftYemRc8D0IODx6XRmyNKhWMoAUMV/QFLpn2L5/e+SCQV5bZAVf96kZ7D1pqHrwpb/LvlTC+pZpbpw5YSl6kiMrJaExlZ7c7VSMheAPJNL909cap+ny24tHgGS2d+h3B3Oz879sdrZtfjOHh1DSlwC6kqPiGUAU7PVi5kvre4/7nYPRqA1V9bPaTwzmVb+eDMB3yaimBxqfxI3EKxpc+jq6ScS5nEUlE8LjdLqxdT5S8bVKxIz+GR0ho2TV2Utf783hepKp7a/6zmqQhbFgrFkV7FVLG5dPN3HHmXH897DIAPwkcBmGF6aWhuJJqMEE1G2Lu0jo13rSPak8iCnOhqpiDX31+Bvgop+ooaOXVWIecyaeK99qA731rzMPMr53Ow9SC/OfQW2+7bDMCkLfdcte2nm/l88kkIAWAqYkgAwMuHGwC4o2IeNxdNYfOBLbyy/xU2znpgyJjLTQNIZnpxq9qQIL+Ry5N/Wc/c0lsQCBZOXsBY/zjq9tcNKexWNZKZS+csHF1pTidtDMSQAfdPvoe6b79Asa+YhuZGxvrHAdDQ3DhkjIEgnbRxNOWcAP4W6bbwqlqW0wzTS5GeA8DaT98gmoxQUzabu8fewtpdz/D9HY/yjZIbh4R4VY1ItwUKjUJk5PbOi2nLI1Q05b/35VAqyvLSWor0HBaMLOfXB7ZQt7+O1liI8hFlbF7yEoumfHNQgKYoeIRK58W0JTJyu7Dqg+/Q0yuTSZt8oWc5bzzzPstLa6kcUcYTd/6E+29cxu7O08wrvx2AbYe392e9vGgai0dOACBf6CQSGejplVZ98B0BIFXea+1I4lezIX2ggGc0bRdb8eb6WDlpHifDJ9l8YAujcv384fbHqS2czNbQEXZ2NgMwUjdoO59CqrwJXDptYcs13RdSdo4UmEIdAHr5cAPtsXZW7Pgh55MXOH3+DPfN/C4Fpo9VB+p4teWjfl+3qiF6obsraQtbrgNQ+r7jtTW1JwOj8io8ARetVmoAaNPURZSPmoQnx0NN2WzW7nomS7zPJhp5dIZThDviTfarTbX9mQCIjLOioz3heKWG+4pOA3j51G7mTJhDTdlsfvvx1kEBblUjRwo6wnFb2PKpfu2+N1Z9sNERnGlrTxBQXQMEQpk0x0PHiaajPHJw24DPAQKqi7b2BFLhuFUfbOxbz9qyyDgrOsLx90sK89TBJkBHrJ3kFaX0h5On9HRvyhQq/lzF/KwjMUFx5KOX+2RBrPpgo756zrG29sT0QMDk7BWQtN1DT7ITgOoD4cZpTaGZus34fKEaADGn16pQZGzZc7/sHBICoPTKRzvC8T0lhXnaYNmEomEWNDT/fdyZ6G03ebyi8Iu2z68pw44njX8ebvXvfPKnh07+de8vHnrjzeeAgQPLqg82Opqy9/NwfMDZFPuKOfv6jv0TmrtvuNM7oh8AMPnZXzFzy9sUqjpfz/drZ/ftffrd9T9fOCgEQFjOiq5QHDUDvsuE7tr5VNR67x81M/M8quuyEeSfPw1z3BTsaAcALkVhem6esW/za2+lolFlUIhVH2xxDLG7JRTnK18MSYBAS+ykW6hqoarjKs0nv6aM3KoAk9e9BoA5bgq3nzhF0bL5FKo6JopxuunDwJDzXVjOiu7OJL09Dv5L50pBOJkq0XNUgMqnnuGG1/9MyZKl6L5RWbGj5y4AoEgzjLZjRyuGhFj1wRapKjtaQnEC+sB7czW78MmB7A1fzVnplY/HulJWXzYJn6GdH8bv5XR7GIDztsWIsWPbrgqx6oMtUlPqT/07RkB38a9Kf1VXT5q445CJRQDIRC9kxWQi54kd/oy449DVk2b6wrublWv9CTJWzvZJRWmvLPcbCVMycVfz/uqDnbV3eAr6O8xVmk/epFLyysroCn7MxSMh9sej1s0PPnTfves37LwmBEBbU/uSkaP/oLqigBM9CZbWHW0piGTG3OrxqW6RXYy44xBMxKzcMWMan/7o0wVw2agfRjbhynK/y/TopLozjH77xL6Ks103eTXDKNIMAyBkW1YKac198HsP3Lt+w86++GFBAPRVczbpufqPZnx1hHboRJedSWZeiG3409rTTR8G2o4drQAomVp1qnzOrWHT680SHTakL5vCIrerPRyPKo4steqDkeHEXrW7LjerPhiRKo91nOtGCp4YLgAAKeWXemkraz7+sjHDLtf/Yv8BAW5R5yt8encAAAAASUVORK5CYII=" }, base),
iconCroplandContinuousRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHQ0lEQVR4nLWXbVBU1xnHf/fcl12Wy4uAgEgAUSOjEYimCJb6EjVO0pjO2LT6waYTM5OSjmlNmjFDk6apNdU0ZibTGmPbDEw7TqumGludptVosdWEICSMaaLEomgICO4uCyzL3d279/QDgbjhpbS1z6d7z33+z2//55z7nLtKY2Mj/+/QABY9v7FZqkrqTa/uyPaGLTWVGoDiyJKs6eZNZ3R/3J9fvv3BAq18+4PLHF0EM5Jcpj8WvWmANFWn0x2yVStWoAGpiiZMKSVeO3LTIAmKisvQNNuKLRNSUcpdbhVLSgA25NzO6a/v5k/3bWeuK+m/hkRxSDRUYoYoEI6uZOtCjDy8c/YSftOwl34ryIL0WSPjGZrBs8VrJw2xpUR3CYQtSzVhy9IEt8qgjAGQ6DIJRQZZd+y5ONHKzCJWFq3EN+Dj562n/r0TR2JqKt0CU0hVSRVCGZX0cMFiys3MkfupCVMAWLdw3aScRHGGLiSmUGyZ6tEEYWdocCAcxGMksOLW5cxKnj5mgQzNYH1OMY/OXDohSCSoiJjMEoqUKYpLJcbQwp+8+DceKNsAwLu+fwJQ5DI53t5E0OonaPWzZ8WTbKqsIhgdnBiiDM2QduMNwN6O99h74Ntxyevn3EV5wSLOXzvPH1qOs231UwAc6WgeFxByYrg+rSsAXIpCyImNK9jXcgyALxSUcVvGTA42H2Jf0z42zb13QifDoQFYtoNHqOOCknU3L7/1Kgtz5qOg8MUZFWSnTGN/0/5xC3uEimUPrbNwNKU1YsXQEeMK7ilcwpN3PkamOZXj7U1kp0wD4Hh707gaHUHEiuGoSocA3ukPRTFVNS6pyGWSoRkA7PrwKEGrn+LcEiqz57Pr9B6eO7GTiqy540JMVaU/FAWFOiFs+VqgLxzxKALthg1wIRxkTU4pGZpBRWo+B5oPsb9pP10DXvJSpvPUiidYWlg5JkBTFDyKINAXjghbvibqq2sPE3WkZcVIVLS45NqrDazJKaUgZToby7/Jl+fdw9uBK5Tl3QHAnz96c8T1mozZLE/NBSBR0Ri0bIg6sr669rAAkIJjXT0WyWo8ZBiUnphGV981THcS9+eV0eZr42DzIVLdyey84xuUphdyxHuRvwbaAUjVdLp7wkjBb+HTLSxi8juh3rDtkgpuMXoD7Gs5hn/Az09OvEjA6uNKz1VWF60i2ZXEjub97Os4N5LrESqKA6FeyxYxuRVAGT7jy1546EL6lIQ5iek616LhUaBHZy4lf0oeHsNDcW4Ju07viSs+HLfoCQR8YXz+0JmGLTWVI04AhO1U9fgGHVOqeIQ6Svy7K29TkltCcW4Jf3z/yJgAj1BxSYUeb8gWMfn0SO3hi/rq2jpHcLHLb5GuGqMKeO0Ird5LBMNBfnr+jVHPAdJVgy6/hVT4oL66tm54PG6lhe1U9XhDb2aludWxOkDPgA8rasWNpfnDLUY4NugSKlPcSsJl3+BMRcrNN+bEQeqra+sWPb/xH11+qyQ93UXIie+y4ViUiBUA4PZz/rqS9/0LDIcZyWLore2L2ZFShb4l39rkHRcCoDhyc483dDwrza2N5cYb9HH3yY6GgvaBJWVJqSJL1QFIrijEDoaMy80fpzX+4uX3Ot9t/NHSZ7ZuA0Y3rPrq2jpHU050+gZHrU2mOZWeo3WnZn1iLbwrJWMEADD3hztZ8Mvfk6XqrExO07obz/6gqeZXd48JARBRp6rXG0K1IUl8ZnZz3Su9+tmLFQvMJNV1QwtKW1VMQv487N5uYOjoKE00jQ8OHzwQCQaVMSH11bVtji7+0uENMVX7zE1258AFU9HULFXHVZBMckUhnvnZzN26G4CE/HksP9/CtA2ryFJ1ElCMznPN2eP2dxF1qkIBCycqSRFD05LuDw/mGm4VoOjpZ1hY8wa5X70fPXVq/LQuWw1Aju4y/Jda54wLqa+ubZNCOdjhDZGu6eOljRn+s6fjf/BEyYojnxjoDUeG3QSTdO36JD5lra5rAFy3I5hZWe0TQuqra9ukqrzS1j1AuqZzJS9pvi9sEXQcon0BAKK9/jhNNHCdvuYPCToOvrBFfkVl6+je/rkQtvNstD/ySDhkG2aCO+Wj2zJOmS2BSv2xH6uux7cB0PH6URJnF5BYWIjvrXr6LvdyJtgbKV37tfWGaUplMv+0yl546CXd0L57a34Sl6MW6w5ebksbiN3ypaRU1fzc0RB0HM4EeyNqZmbd2ld/vRrGeOPHc2PHolWhkO3K87ipu292QV7d1ZPBT7xlyapu5OguA6AjGo4MIiPz7v3KAwsffuT1Yf2knAAs2rFxh+bWvjdnRorWcrnXti37xb9v+ll157nmbP+l1jkAaYUzW6YVl14zTFPeqJ2UEwBFyh22ZW/uvD6o2ZY9oEi5wzBNmb+4sjN/cWXnhDMxWUh9dW1ACh7vuT6AFHy/vro2MFntpCEADVtqdkuFdxq21Oz+T3STXpP/Jf4Fhmz0h0/7aiIAAAAASUVORK5CYII=" }, base),
iconCroplandContinuousUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandContinuousUnknown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHSElEQVR4nLWWe3BUZxXAf/e7j2TDbnZZHtk0PBJoSUqBBpRCHlQQAVPrUCsqOqUD6FAQShE7OrQWCnQK49iZUuJkyIzKdKRjoEhHp1aktGFIFtQyYCElPKIBItm8YLPZR/bu3fv5R0hkE0LDiGfmztz73XPO75zzne/cq0gp+X+LBqCvKzkjVcVz373bssnaXVuqSCkx1hTLMQ/ef0bT5SBAnmasKZ5rGyKcPdzhbLXM+wYYrRlcyQhbatTK1QCPYqhOKSXNie77BhmmqDjSNc2MWnOFFMpsh0MjatsAbMybQ3jtEa6tqGKBO+eeHG8pKKNy1koA4ti40jSS6SJX2IbiM1TRp+hKc7Jy/1r8DbUUZ0/rW8/W09lbtGrIQEtK0hwqIiELhUjIQmeGRkQmAdha/wHHg1cpnljC+Y6GPqMlOdNZMuNb7JyyeEiQuG3j0jWkwCmkqniEUFIUts74Hv6GWva3Xexby3GOBmDdl9YNCWLSU34kTqFY0uPSVWJ2TyYb8+ZQlDebDScqB3WQrafzfG7R52alDlMRlswSii3dikPFoufkr5i1jLwReVxa9Ue2FJQBMN3hpqqhms5okM5okKNLytnxtW10xiN3hfRWSOt76EmEqb8buLkvFH6HBQULOHXtFL86vZ99S/cAsLexJkVva/0HfffhpIXD6GkoAeBQBOGkNWhEu85UAfDl/PnMyn6EPTWVvHXsLXZ88dm7ZtIrGkA0kcSpaoOCvEYGL/95O3NzZyMQlE1exDjveMqPlQ/q2KlqRBM95RG2rjR0Ry0MxKAGyyZ/nfKn3yDHk0NVQzXjvOMBqGqoHtTGQNAdtbA15boA/hrsMnGrWorSdIebbD0dgE2fvE1nNEjRhGKeHDebTe9v5rmDG/jqmJmDQtyqRrDLBIVqIRLyQPvNbtMlVDTlv+fldKyT5bmlZOvpLBo5iV/WVFJ+rJxroWYmjZjAnm++yeJHnrgjQFMUXEKl/Wa3KRLygDAr/O8RT8po1CJT6CnKOy59yPLcUgpGTOClhT9h2cxnONx+kfmT5gGw78yBvqyXZ0/jGyMnApApdCKRBMST0qzwvycApMpfrrVG8aqpkF6QzzWappvXcGd4WPPQfOoD9eypqWRUhpffz3uR0qzJ7G3+lEPtPWNopG7Q1BZDqrwDt1pYWHJ9142YlS4FDqEOAO06U0VLqIXVB39EW/QGF9susXTGtxnu8LC2ppzdjSf6dJ2qhkhCV0fUEpbcBqD0fuO19aX1vlHD8l2+NK6ZsQGgnVMWM2nUQ7jSXRRNKGbT+5tTnPfKg8Yw2gMxAq3hWmt3bWlfJgAiYa9ubYnYbqnh7NdpALsuHKZkYglFE4r5zcm9dwQ4VY10KWgNhC1hyZ/1+e69MSv81bbgUlNLBJ+aNsBBc6KbuuY6Ors7ef7UvgHvAXxqGk0tEaRCnVnhr+5dTwlZJOzVrYHwh2Oyhql3mgCtoRai/UrpDUQv6N3JmEOoeDMUx2etkYmKLTfcrpMCMSv81fq6knNNLZFHfT4Hl/tBuq048Wg7AIU1gepptc0zdIu8TKEaACE7aeYrMvTMaz9vHxQCoCTlhtZA+MiYrGHanbJp7gywqKrhb+MvdT7+mMstslLb3mhJJryHXv7p6fqPj279/tvvvAYMHFhmhb/a1pSjVwLhAXuT48nh8q8PHpvY0PWFhe4RfYC03Ey8C6Yx9rmnyCscy1cyvdrlj46+8oftr5bBbS2cEs6a4lzgX1OnjqZFmASTiZ717mTn0l+ccTzu8hjzdm0lq2wZjZVbyV21pc82EWzj7999gqsNHZyMhsM76i5l3nH0mhX+RtsQhxubwzxwa0gC+BpD9U6hqlmqjp7pAUB3e1Nsdc8oMgsnk6XqOFCMi7XHfYPOd2Haq7vaoyTjNt6efWV4IBobo6cPHAn9JD3LB0C2ZhhN587mDwoxK/yNUlUONjaH8ekDz83dxDuzNDXguykrSfliqCNm9mYT8Rha263/5frXtnFqZRlNB98lEWxLsWutPgxAm2UyYty4prtCzAp/o9SUigv/DuHT07ha4J3aEe8mbNvEG0OETvyT6NkAn23+IQCxK3V8/HA+zb89Qti26Yh382jZkw13hQCIhP1q/GbcjHUl8Dgz3JeLHjh2PBxMxm/ryhtHPiV2pQ7N3fMDGJcSfyRkLly99mmH2y3v2ML9RVtf+qaRrr9QmD+c8/EIS8rPNg4PJsbOcXlUp+iJM7NoAlY4Sus/ruOPhMyMsWOrXznxySIY5Jz0F2NNsUcqSqBgkjfN4dKJdSUY/e75j/Ivdzzm1gwjWzMMgGbLNGNIc+6KHzz71PbXD/XaDwkCoK8t2aln6D+e/vAI7fT5DisRTbwRev1Pmy7WHvc1nTubDzBmytQLk0rmBBxud4rTIUN6s8nKdqa1BMKdii1zzQp/cCi2n7vxvWJW+INSZWPr9S6k4KWhAgCQUt7Tpa0pOnmvNkMu1/8i/wGGmE5hXod/ewAAAABJRU5ErkJggg==" }, base),
iconCroplandDoubleIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleIrrigated: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHLElEQVR4nLWXf2xT1xXHP+++H44TO3YcIM4SIAmQZPwM6VrIDzYoo4y1E93KNjRBBevUgaCUsWoTLaUDKoqmVSolawTSOlSJaoEyqk2soy0sEYlhWxFZgRJ+REubrHF+QZzYTvL8/O7+CMkISSDd2JEs2fedcz7+nnvuubYipeT/bRqAvrGkVqqK975nt2WTta+mVJFSYqwvlplT7z+j6XonQLZmrC9eaBsinJ7idLVa5n0DTNAMPk0MW2rUytIAr2KoLiklzbHe+wZJUlScCZpmRq2FQgplvtOpEbVtALZkLyC84QMa11awxJPxX0P6sHE7NOIJIkvYhuI3VDH40O1w8cPDGwjU11CcPntwPV1P4GDR02OGWFLicKqImCwQIiYLXIkaERkHYEfde5zu/IziKSVc7qgfDFqRMZcVhd9lz8zlY1Ni27h1DSlwCakqXiGUIQ47Cn9AoL6Gw21XB9cyXBMA2Pi1jWOCmPSXH4lLKJb0unWVHrtfyZbsBRRlz2fzmQOjJkjXE3gmq+ieqtQkFWHJNKHY0qM4VSz6T/7aeavJTs3m2tN/5KX8ZQDMdXqoqK8kFO0kFO3k5IoyXnl0J6G+yF0hAxXSBj/0C2HW74Zv7rMF32dJ/hLONZ7jN+cPc2jlfgAONlSPCgjHLZxGf0MJAKciCMetUQP21lYA8HDeYualz2B/9QFer3qdV77y5F2VDJgGEI3FcanaqCCfkcgLf97Fwqz5CATLpi9lkm8yZVVloyZ2qRrRWH95hK0r9b1RCwMxasDq6d+i7DuvkuHNoKK+kkm+yQBU1FeOGmMg6I1a2JryuQD+2tlt4lG1IU5znR7S9QQAtn70FqFoJ0U5xTw2aT5bj2/nx0c3843MB0eFeFSNzm4TFCqFiMkj7Td7TbdQ0ZT/nJfzPSHWZJWSriewdFwuv64+QFlVGY1dzeSm5rD/iddYPuObIwI0RcEtVNpv9poiJo8IszzwLn1xGY1aJAt9iPMr1z5kTVYp+ak5PP/Iz1j94CpOtF9lce4iAA7VHhlUvSZ9Nt8eNwWAZKETicSgLy7N8sC7AkCqvN/YGsWnDoUMgPzuCTTdbMST6GX9tMXUBevYX32A8Yk+fr/oOUrTpnOw+WOOtfePoXG6QVNbD1LlbbjVwsKSm7pv9FgJUuAU6jDQ3toKWrpaWHf0J7RFb3C17RorC79HitPLhuoy9jWcGfR1qRoiDt0dUUtYcieAMnDHa5tK6/zjk/LcfgeNZs8w0J6Zy8kdPw13gpuinGK2Ht8+JPmATTWSaA/2EGwN11j7akoHlQCImL2utSVie6SG645OA9h75QQlU0ooyinmt2cPjghwqRoJUtAaDFvCktsGcw+8McsDlbbgWlNLBL/qGJagOdbLpeZLhHpDPHPu0LDnAH7VQVNLBKlwySwPVA6sD/nKImavaw2GP8xMS1JHmgCtXS1E7yilLxi9ovfGe5xCxZeoOD9pjUxRbLn5dp8hELM8UKlvLLnY1BKZ4/c7uX4HpNfqoy/aDkBBdbBydk1zoW6RnSxUA6DLjpt5iuxa9fIv20eFAChxubk1GP4gMy1JG0lNcyjI0or6v02+FvrqQ26PSLvV9slFOVjhqPHP2kbfsRd+fr7uLyd3PPXW2y8DwweWWR6otDXl5KfB8LC9yfBmcP3No1VT6rsfeMSTOggAmP7Sryg88A5pqs7Xk33a9VMnX/zDrl8sGxECIEx7XUdzGDUG3tsSPXpsW8h8/x9FhUlu1XHbCPItmY1z8gysUCsADkVhTmKScWr/G4d7QiFlRIhZHmiwDXGioTnMl24NSQB/Q1edS6hqmqrjyEomuSiHxFl+pu98AwDn5BksunyF9FVLSFN1nCjG1ZrT/lHnuzDtdd3tUeJ9Nr7+fSUlGO3J1BNUgPxt23ngzffIfGIFunf8kNgJC5cCkK4ZRtPFC3mjQszyQINUlaMNzWH8+vBzcze78feh1/LoNxWgxOVzXR095oCaiNfQ2sbwe7m3JQhAm2WSOmlS010hZnmgQWpK+ZV/deHXHXyW75vV0ddL2LaJdXUCEAvdGBIT62yjq/YTwrZNR18vc5Y9Vq/c60+Qsb7YKxWlJT/XZ0SckqnH66sKzrWXPuxOGewwR1YySdOySMrJoSNwlpsfN1MVDpnz1j618vFdu4/dEwKgbSp9zUjQny3IS+FyX4QVZRcaUjpjExe4vapLDC1G2LYJRLrMxIkTK18889FSuG3Uj0FNMD/X53C6dXq6Y0x45/KpvOsdD3k0w0jXDAOg2TLNHqS5cO2Pnnx81+5jA/FjggDoG0r26In6T+d+OVU7f7nDikVjr3bt/tPWqzWn/U0XL+QBZM6cdSW3ZEHQ6fEMSTpmyICatHSXoyUYDim2zDLLA51jib1rd91uZnmgU6psaf28Gyl4fqwAAKSUX+ilrS86+0Vjxlyu/8X+DWizNm/MeJvzAAAAAElFTkSuQmCC" }, base),
iconCroplandDoubleUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHR0lEQVR4nLWWbVBU1xnHf+fcuy/AAisgICKsLx2oUcCaIFpGk8Yk1ca246TVTpN2tDPGdkzHto6Zbdo0Oqaa1sykHWNs2nG/dFJsorU10zYSDZmYiAQSgvWFpCgYwovAssCye3f37j39gFAIrNLWPp/uPef5P7/73Oec5xxRX1/P/9t0gGXPbG5UmnDf9uiWaq/bebhSBxCWKs2Z7brtjOsfDxVW7N3k0Sv2brrbsslgVqrD5Y/HbhsgQ7PR6QyZmhH36IBb6NKllKLXjN42SJLQcNh13TTid0slRIXDqWEoBcDDeUs48/WD/PXLe6lwZf/XkBgWKXaNuF16pGUTuTYpxyaT7Unsqt5HU/sHlGQtGBvP0u08VbJ+2hBTKWwOiTRVmZSmKktyaoRVHIAXW9/h/aEuSvJLuTrQPiZanV3M6uLVPDZ/1fQysRQpuoaSuKTShFtKMcFha/EXaWr/gOr+a2NjM5NmALBh6YbpQbBGHhQuKUzlTtYlEWtk8OG8JSzOW8z+pmMJA2TpdjbmldwyK5mkIeMqRwql0oVDI85I4dctWsts92yOr3+OLZ4VABQ7XFS3NxA0hggaQxy693G2VW4lGAvfHCJG/pA+/gVgw8mnJzlvLLqfCs8yLnVd4s/N1ex54AkATnQ0JgSErDiOG3ElgEMIQlY8oaCq+SQAd3nKWZQ1n6ONx6hqqGLbwgdvmsmo6QCGaZEstYSgNJuT59/5HUvzFiMQfH7ucnLTZ3Gk4UjCwMlSwzBH6iwtXbREjTg2ZELB2nkrefwLPyDbNZPq9gZy02cBUN3ekFBjQxI14lia6JDAuaFQDJemTXAqdrjI0u0AHLj4KkFjiJL8UipzF3PgzCGePrWf5TkLE0JcmsZQKAaCGilN9XJgMBJNFhJ93AK4HAmyLq+MLN3Ocnchf2w8xpGGI3QP91KQPpsn7t3BqnmVUwJ0IUgWksBgJCpN9bKs9fqOE7OUYcRJEfoEZ9+1OtblleFJn83mim/zpTvWcjbQRnnBnQD8/cPXx7Jel/UZ7nHnA5AidMKGCTFL1Xp9xyWAkpzs7jdI0yZCRkGZKRl0D3bhcqbyUEE5rX2tHG08htuZxv47H6Escx4nej/ijcBIG3LrNq73R1CSl+DGEpZx9f3QQMR0KIFTTl4AVc0n8Q/7+fmpZwkYg7T1X+OB4vtIc6Syr/EIVR1NY77JUkNYEBowTBlXuwHE6Blf/svvXM6ckVSUkmmjKxaZBHps/ioKZxSQbE+mJL+UA2cOTQg+anNsSQT6IvT5Q2/X7TxcOZYJgDStrf19YculNJKlNkn8h7azlOaXUpJfyl/On5gSkCw1HErQ3xsyZVz9ZCz26EOt11djST7q9htkavZJAXrNKC29VwhGgvzi0t8mzQNkana6/QZKcKHW66sZHZ9QaWlaW/t7Q6/nZDi1qTpA/3AfRsyYMJbhjzTbI/GwQ2rMcIqkq33h+UKp7eN9JkBqvb6aZc9s/ke33yjNzHQQsiZ22Ug8RtQIALCkyV9Tet7/ObvF3DQ5smsH42a0TDC48tFtvQkhAMJS2/t7Q9U5GU59qmx6g32sOd1R52kfXlme6pY5mm38tL07Hsuo/83z73e+V79r1ZO79wCTG1at11dj6eJUZ194Um2yXTPpf7XmzQWfGEvvT88aAzg8aWTcV8KcR7/K3LI5rE7L0K/Xv/vThsO/XQPjlvB4q9i7yQNcXbAggz4RY8gyRz4zag18s+qfSStTZ9jv+dUuctY8QuuLu/Bs+dmYNhbo4d1vrOVaSx9nh4eCG196JW3K1lvr9bVaNvlaR2+Imfq/s8ntHL7sErqWo9mwpbkBsKVnTNDa3DNJK1tIjmYjCWHvbGrMTdjfZczaGgoYWDFFuhz5LZn+SDjf7py8iT5lzpxcAPJsDrv/SktRQkit19eqpDja0RsiU7clcpvSMu6a2J0Tn1SAsNSO4YFIdDSbYKpN77lxlb28ZzcNm9fQfvQVYoGeCbrrNa8B0GNGceXktN8UUuv1tSpNvNB6fZhM3UZbQerivohB0LKItA4yePYKofNdXHzyewCE2y7wxmeL6Px9NUHLoi9iULi8suWmEABpWk/FhqLRSMjEleRM/3BR1ptvDQXikRt3ZwB/dRPhtgvo6SN354hSvB0ciJat/9p6u8ulbgmp9foCShMvtPeEydR0zi3LXuVP0T4+PdgfD964EAJc3LWD97Y8RNCyqBkKRLXs7JqlW777J0iwTz5tFXs3uZUQXZ6CNIcjWScSMimouXa6+JPB8jTNZs+zOewAHbFINIyK3vHgV741Cpg2BGDZvs37dKf+o6K56Xrz1QHTNMxn39r2a29nU2Ou/0pLEUDGvPnNs0rKuuwulxqvnXzeJjCh1D7TMLd39oR10zCHhVL77C6XKlxR2Vm4orLzZtpb1mTUar2+gJL8sL9nGCX5ca3XF5iudtoQgLqdhw8qwbm6nYcP/ie6adfkf7F/AQwXA9magG+tAAAAAElFTkSuQmCC" }, base),
iconCroplandDoubleUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandDoubleUnknown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleIrrigated: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABXdJREFUeNq8V2tsVEUU/u5rt9vu0qWyfVjU8mipaA2gprQ0sUiAoDFGgsgPUfSHabXgI8T4VvAH/DFRqCEQDf1TEiT4CCFSIwkkBfEHKYqN5bFQaEt3tw+63d273d279zpnSjds7t52a6qT3J07d+ac73xnzpw5KxiGgf+6CQSiNK24YEiCe8a160avtvdMHQexNdYacxfOPEbv1RHq5skMoF63ieGS2Q5nQIvPGEChbMON3LAmqVqZzMZuwSY5iVF/YmzGQPIECY4cWY6rWr1oiMJyh0OGqut88tPKdeh55TA2eiqmrZhkD1S/yt9j0OGyy0jmiGWibhOKbZKYWrij62fMzi0wKShRctBS81rWgBrzjN0hQUwYS0T6cebKiBjJSYU2lC7FhmXPY/fDz2YFEmOecSkyDBFOkUJXFIUphUqdhbxveqIpK5A4xt0Pg4EImuF2KRKiejJrV5DrtpbVTMlKymPu0owiUdCNfIH5ToP1yV/qyMdh7ykE1RH+nNzQjF1P70QwFpkUZMJDcmpwFxHn16vTFr+55AWsrlyN8z3n8W3Hd2jdtJ9/b+luT1tHQTPRwkkNDtt4QPFfhyDyj1btqwuHef/kolWoLnkI+9sPYM/pPdj12EtZuZczURNJOCXZEqjAlosPT3yO+rLlzCoR6xavxf0FD6D5dLOlYtJHejkTXRG8Y6oGG0RLgc2Ln0Hz+i9Q6i7le0MA1OjdqpE+0qvLwi1JrL6vWpKlqoJZdowkE2mbLQgCwrqG3/2dePnBp7CwsBwDQzdx/O8TOHLxJzzqWYT24WsZQYoVO4aHYlCjiWOSvGyurmr6+nlFTmmIgdyJbvi0GLYuqIc3dAtr51Sgy3cJf/R24NpID6qKKvHxmvdQkJOPb7razHvAjJvLwvzqzdG4GNd3iPF9Z39ELGmojNosUUlbvOvKr9hSVofKe+bjgzXvYvPjL6Jt8DJWVazk860XjqRYbyl5BM/NWcDHpCcSYV5hekk/3whDwi89ARUFkmKyioCKXYXovd2D/Fw3GstXMVZdPMI8LMd9v3I76ooWo6X/T/ww6OUycxQbegeipPdQKoTZqdwWGo5qOSzROEQpYwj7R/1oOPo2BtRhXB64gk3LNmK2w4032puxt/u3tKgSWVCFhlSN6d2Zun65H7fVdRV78ha5iu3oiUdNQJRCKjzlcOW4UDO/Fu8f/yRN+URbaMvDoC8KXyB8hq7eFBP+ktAbAv6Inm/I3BoTm0ttWLFgBQc4eK4lIwDJkTcCvjCx+CilO5U19509pYu40uuPoFiymxTQrdnZ34ngWBBbz7dmDlsmR/KGgE7SZwJJsfGFk2RNJjYBti8dNzssT/gECyFpvJWmN+0OYOjMir+s2IyxszOkDlqy8PaH6ISfvJuFCYRHArOCrLFi0x/0mb65WehL7FgE/RGNHb4GU8o33Wi0N8yaG76wiQ3lruvBPhPIvex0d/eHoSsisejOWEGakltjbRnrrldVFcIvxtNymilDSzZ4dAUXLwZ4IZcJJGPqpYWs4Gsj68jKyRolQs5CFo5lArAE4RPMt6FBFcmYzq21YkHztI6yhqUuy2qDWcUqmaNkJVk7BYuDViwmBbkTadtHh6LxTGxoPBZLguYZi3cmLSgmrZ2IjSzsu9Q3msaG7gsaX+0eBc2zdSP/GuROFvgsdjsWj4YSrFIfB/KwnsaJcDxO81PqmLISZFaStd5bbG/Y3wGFVTYedvhonA2LrEAm2DCrYyFmfbk9D6FxFrFsWGQNwq0V8KW3L6QpbD+op3E2LLIG4ZGmG7sTkUTyRl8YCTURoXHWxTOllWwfqan2daWhxqB+OnLTAqFHbqw5N10Z4f/4H/+PAAMAZdcbF+U/NqsAAAAASUVORK5CYII=" }, base),
iconCroplandSingleRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAF10lEQVR4nL2Xb2wbZx3HP89zd7bjOLFTJ2nXhjRrYAuFJpE2uhQiOlinSYUiNNDGG4Q2JFShbZSp6mTGiwgBLVCkvShtQSiWEIKEqdWg04CWiLwonRc1U8Sf/mEaSzsrbRIncWrnfOf78/DCTUhmO/VQ4Xl1d8/v9/3c557ndDpx8eJF/tdDB3joB09PKE3E7nq6r9Jjhwb7dQDhq56NWyJ3nTHzbm5r3+GnOvS+w0897Bsy39wQjMx7zl0DbNAMboRMV7O8Dh2ICV1GlFJk3OJdg9QJjWBA113Le1gqIfqCIQ1LKQC+1vFxXvvcYR5taq85cHuwgfNPHOf8E8cZ3P0NABx86gMaXkB2SN8QmwwpVxp+NnmBxlC0LKhZDzDQ/fi6sIOvDXDfxvvZHmzAVQojKJGu6pXSVb11IY2C8tYN2NPaxZ6uPTzbubsmO8dX1OsaShKRShMxKcUdm1rqmgB48oEnq9Yc3TvAm9ff5JKdw8EvXVREpHBVLKxLbN+v6Q6h9Oi+tLm7zOoXY7/kg62dK+eyTkN6aqMUSkVFUMNDVQ3tCkY4lx4nb+XIWzlOPvICz/TvJ+8U1tS9s5imMRSlL9JagojSExL6F3aozg/HmXVtTL/yugx0P05fx0NcvnmZ3149x3cfexGAz58+sO62vy9Yz6VLGSRAUIiqAIChq2cB+FjHTj7a3MmpidMMjQ/xzPbPVu1ZPXQAy/UJS60qqNEI8ZMLP+eBzTsQCD5x7y42Re9heHy4anBYalhuaZ2lr4u3i5aHgazasHfbJ3nh09+kNdLCufQ4m6L3AHAuPV61x0BStDx8TUxJ4I2c6RDRtDVFXcEIzXoAgGOXXiVv5ehu66F/0w6OnT/J90aOsmvj9qqQiKaRMx0QjErpqpezt+xiWEh08Z/35YqdZ9/mXpr1ALtiW/nNxGmGx4eZXsrQHt3Ci48cZPe2/ooAXQjCQpK9ZRelq16WqUTyFRxfWZZHvdDXFCevj7Fvcy8d0S083fcVPvORvbyevcbO9gcB+MM//7Riva/5Q3wq1gZAvdApWC44vkolkq9IACU5O71g0aithSyD4vUbmL51k0iogS+272RybpJTE6eJhRo5+uCX6Y1v40zmLf6cTQMQ0w1mFmyU5FdAabWlp54zF203qAQhWb4Bhq6eZX5pnu+P/JisdYtrC9d5rOtRGoMNHJkYZmjqryu1YakhfDAXLVd66jsAYvkbv/NHX70Sb6q7vz5ucNOxy0DPdu5ma1M74UCY7rYejp0/uSZ8eXzAqCM7ZzM3b/5l7NBg/4oJgHT9/QtzBT+iNMJSK2v+9bXX6Wnrobuth9/97UxFQFhqBJVgIWO60lPfXslePkglkqO+5K3peYu4FigLyLhF3s78i7yd54eXf182DxDXAkzPWyjBP1KJ5GgZZMUmY3pBJSraLCzNceXmlYqA1RbCVwfW5K4+SSWSo0rw92o2tuewaGWrWqQzJr4uRlZblEEAhK8OLGRMt5pNJj9Xdq1B6mgu5OcLrnT8/e+dL4OkEslRXxcjN+YKZTatkRam8rNlkBY9wFTGxNflSCqRnHzvfPnbB0jH37+YMd9piYVokDo53wXg6xd+WlYblQa+ozCzFhLKLCqa3LaZ9A35x6mMSYtevjarR1w3ShaaOFPJoipk2cbMWviOIiqNijVrLDz1XNWsahOpRHJSSXFqKmMS1ytDVlkkq1msCwEQvjq4tGgXK9lEpUHR8VlatIvSU8+vl7MuJJVITipNnJicWVpjowtBXDd4d2oJpYkTqUQy+19DAKTrDzi5YtE2XTbc3tIxzcA2XdyCU5SuP3DHjDsVpBLJrNLEifRsgbimowtJk9RJzxZqsqgJAiUbt+DYpunSboQwSxZ2LRY1Q27f7UvpGdPVhSA9Y7rAS7VY1AwBEEodcS3XuzFbwLXcJaHUkVp7a4akEsmskjy/MLuEknyrVov3BQEYOzR4XAneGDs0ePz99In/x3/8vwHgs5Z0zk/VZwAAAABJRU5ErkJggg==" }, base),
iconCroplandSingleRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandSingleUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFkUlEQVR4nL2XXWxbVx3Af+fcc23HcWKnTtquDWnWCi0aLIm00aUQ0cE6Jg3KA0LaXhDakFA1bdOYpk5mPFQIaIEh7aGsBaH6DZJNrTY6baMlWh5G50WNFPHVlmmQblbaJE7iNPb1te+95/CQDyWznXpQ+D/d4//H7/7uOVdXFhcvXuR/HQrg3p8+NmEskbjl07XJjh0+NagAhDZ923bGbjlj5qOlXQNHH+1WA0cfvU/bstDeEo7NB94tA2yxbK5FHN9yg24FJISSMWMMOb9yyyBNwiIcUsp3g/ukEWIgHLFwjQHgu92f542vH+WBtq7/CuKhaQ5ZBCHZLbUttttSriV/PXmB1ki8qqldhTjS+42GIb4x2GGJ9E2/lL7pb4pYlEywadOBrT0c6DnAk3v2N2aiDc3Kwkhi0lgiIaW4aVNHUxsAD9/9cGMQ9PKFISaFbxJRJSlr3VAzLD+6R3b03tRKNlnIwGyTwpi4CFsEmLrFPeEY57PjFNwlCu4SJ+9/jicGD1HwSptDxPITUusXqzH48uMb1o/c8RUGuu/l0vVLvHblPD968HkAzk5N1AU4OiC8MlcChIXA0fU3fujKOQA+172Xz7bv4fTEGYbGh3jizq9tarIaCsD1NVFp1QW12hF+eeE33L3jLgSCL9y+j+3x2xgeH647OCotXH95n6VW4oOKG2Aj6zY8tPuLPPfl77E11sH57Djb47cBcD47XrfHRlJxA7QlpiTw3pLjEbOsDUU94RjtKgTA8b+/TsFdorezj8Htd3H8nZP8eOQF9m27sy4kZlksOR4IRqX0zSv5G+VKVEjUugNwuVzg4I5+2lWIfYldvDxxhuHxYaaLObriO3n+/mfZv3uwJkAJQVRI8jfKFembV2QmlX4VTxvXDWgWakNx+sMxDu7opzu+k8cGvs1XP/MQ7+avsrfrHgDe+scf16wPtn+aLyU6AWgWipLrg6dNJpV+VQIYybnpBZdWayNkFZRs3sL0jevEIi18s2svk3OTnJ44QyLSygv3fIv+5G7O5t7n7XwWgISymVkoYyS/hZUjLAPzlLNY9sNGEJHVB2Doyjnmi/P8ZOQX5N0bXF34kAd7HqA13MKxiWGGpv68VhuVFkKDs+j6MjA/BBCr3/i9P//O5WRb0x3NSZvrXrkK9OSe/exq6yIaitLb2cfxd05uGL4an7KbyM+VmZt3/jR2+NTgmgmA9PWhhbmSjhmLqLSqmn939V36Ovvo7ezj9385WxMQlRZhI1jIOb4MzA/WZq9eZFLpUS15f3reJWmFqgbk/Aof5P5JoVzgZ5ferMoDJK0Q0/MuRvC3TCo9WgVZs8k5QdiImjYLxTkuX79cE7DeQmjz9Ia56xeZVHrUCP5az6YceCy6+boW2ZyDVmJkvUUVBEBo8/RCzvHr2eQKc1W/tUiF5UNhvuRLTx/6eL4KkkmlR7USI9fmSlU2W2MdTBVmqyAdKsRUzkErOZJJpSc/nq9++wDp6UOLOedfHYkILVKxpH0AHr/wq6rauLTRnsHJu0iosqhpsmIzqW35h6mcQ4eq3pv1kVT2soUlztayqAtZtXHyLtozxKVds2aDRWCeqjurXiKTSk8aKU5P5RySqjZknUW6nsWmEAChzbPFxXKllk1c2lQ8TXGxXJGBeWazOZtCMqn0pLHEicmZ4gYbJQRJZfPRVBFjiROZVDr/H0MApK+PeEuVStnx2bJypBOWTdnx8UteRfr6yE1n3Kwgk0rnjSVOZGdLJC2FEpI2qcjOlhqyaAgCyzZ+ySs7jk+XHcFZtig3YtEwZOVuX8zOOL4SguyM4wMvNmLRMARAGHPMd/3g2mwJ3/WLwphjjfY2DMmk0nkjeWZhtoiRfL9Ri08EARg7fOolI3hv7PCplz5Jn/h//I//NwdqerRrqOQqAAAAAElFTkSuQmCC" }, base),
iconCroplandSingleUnknown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABWtJREFUeNq8V2tsFFUU/ua122136VLZPixqebRUtAZQAy1NLBIgaIyRIPJDFP+YVgs+QoxvBX/AHxOFGoLR0D+YIMFHCJEaSSApiD9IUWwsj4VCW7q7fdDt7s52d2dnvOeWbtjMTjto9Sazd+/ce853vnPPPfeMYBgG/usmEIjSvPycIQneadeuG73anlP1HMTRVGfMnj/9GL2XR6ibIzOABt0hRstmutwhLTltAMWyA9fyo5qkahUyG3sFh+QmRv2psWkDKRAkuPJkOalqDaIhCstcLhmqrvPJj6rXouelg9jgq/pXIAno8DhlpPPEClF3CKUOScxMbu/6CTPzi0xCZUoeWmtftg2iMc84XRLElLFIpB93voyYkZ5UaH35Yqxf8ix2Pfi0PSbMMx5FhiHCLVLoiqIwpVC5u5j3zY812wJJYtz9MBiIoBlejyIhrqdtu4Jct6WidkpWUgFzl2aUiIJuFArMdxqsT/5iVyEO+k8grI7w5/j6Fux8cgfCidikIBMekjOD24i4v1iVtfi1Rc9hVfUqnO05i687vsWBjfv4+9budkuAaFqDyzEeUPzXJYj8pVX7/NxB3j++YCWWlj2Afe1fYvfJ3dj5yAu23MuZqKk03JJsCVTkyMd7xz5BQ8UyZpWItQvX4N6i+9ByssVSMekjvZyJrgj+MVWDA6KlwKaFT6Fl3aco95bzvSEAavTfqpE+0qvLwg1JXHrPUkmWaopmODGSTmVttiAIiOoafgt24sX7n8D84koMDF3H0b+O4dD5H/GwbwHah6/kBClVnBgeSkCNp45I8pLZuqrp6+aUuKUhBnIruhHQEtgyrwH+yA2smVWFrsAF/N7bgSsjPagpqcYHq99GUV4hvupqM+8BM242C/PL10eTYlLfLib3nv4BibShMmozRCVr8c5Lv2BzRT2q75qLd1e/hU2PPo+2wYtYWbWCzx84dyjDenPZQ3hm1jw+Jj2xGPMK00v6+UYYEn7uCakokhSTVQRU6ilG780eFOZ70VS5krHq4hHmYznuuxXbUF+yEK39f+D7QT+XmaU40DsQJ73fZEKYncqtkeG4lscSjUuUcoZwcDSIxsNvYEAdxsWBS9i4ZANmurx4tb0Fe7p/zYoqkQVVZEjVmN4dmeuX+3FrfVepr2CBp9SJnmTcBEQppMpXCU+eB7Vz6/DO0Q+zlE+0+Y4CDAbiCISip+jqzTDhf1J6YygY0wsNmVtjYnOhDcvnLecA+8+05gQgOfJGKBAlFu9ndGey5t7TJ3QRl3qDMZRKTpMCujU7+zsRHgtjy9kDucOWyZG8IaCT9JlAMmwC0TRZk4tNiO1Lx/UOyxM+wUJIG69n6c26Axg6s+JPKzZj7OwMqYOWLPz9ETrhx29nYQLhkcCsIGus2PSHA6Z3Xhb6EjsW4WBMY4ev0ZTyTTca7Q2z5logamJDuetquM8Ecjc73d39UeiKSCy6c1aQpuTWVFfBuqs1NcUIismsnGbK0JIDPl3B+fMhXsjlAsmZemkhK/jayDqycrJGiZCzkIUjuQAsQfgE821kUEU6oXNrrVjQPK2jrGGpy7LaYFaxSuYwWUnWTsFivxWLSUFuRdq20aF4MhcbGo8l0qB5xuLNSQuKSWsnYiMLey/0jWaxofuCxpe7R0HzbN3IPwa5lQU+TtxMJOORFKvUx4F8rKdxKppM0vyUOqasBJmVZK3/Btsb9jmgsMrGxw4fje2wsAUywYZZnYgw6yudBYiMs0jYYWEbhFsr4DN/X0RT2H5QT2M7LGyD8EjTjV2pWCp9rS+KlJqK0dh28Uxpxe4jNde9ojTWGtTfidwdgdAjN9WeuVMZ4f/4jv9bgAEA7E8W5DXKeKMAAAAASUVORK5CYII=" }, base),
iconCroplandTripleIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleIrrigated: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAGFElEQVR4nL2XbWxbVx2Hn3Pu9UscJ3brvC0NadaMLRSaBDa6FCI6WKdJhQo0kMYHEFoRKELbVKaqkxkfAoKtgyINqawFoVqaJkg2tRoUAWuICFLZvKgpoYO03QtLOyvNi5M4sXN9r319Dx/chHi2Uw8Vziffc/7/33Ofe87VlcW5c+f4Xw8d4O6n948rTQRverqjYqOHTvTqAMJRXY1b/DedMftucmvPUw+16T1PPXSP45KpuhqPfyGXvWmAzZqLa17D1sxcmw4EhS79SiniduamQaqEhset67aZu0dXQvR4vBqmUgB8pfmj9PV+g2VziYMvP8mElbxh4HZPDb/4/NMAvDFzmf1/+SlZHKrdGgtu2SYdl2hySVnQ9L2hw1yI/Z2PhW5bm6vT3fR3PrAh7ODv+7m98Q62e2qwlcLlkUhbdUtpq+4qr0Za5QB4fupv3BpooaGmkfPzb60F7GnoYE/HHh5p313R48o6impdQ0n8UmkiKKUoKmoKNBWY1FdtAuDBOx8sG3xkbz/nr55nwkqSxclPKvxS2Cro0yWWk5/8ZtsnuBB/i+mlaXzuqpJhdbqbLzd3Flk9N/o8tzW0r13LKg2ZU41SKBUQHo0c+Y03MmmO7O2n2uPn7LXXAejw+BmKjZEyk6TMJMfvfZyHe/tIZdMFkHeWYtR6A/T4G/IQkX9CQv/iDtX+oRBztoXh5EreeX/nA/S03c3F6Yv85vIQP7j/CQC+cOrAhsf+dk81ExNxJIBHiLIAgIHLZwD4eNtOPlLXzsnxUwyMDfDw9s+V7Vk/dADTdvBJrSyo1uXlZ6/8kjubdyAQfPLWXTQFbmFwbLBssE9qmHZ+n6Wji7czZg4XsmzD3m2f4vHPfJsGfz1DsTGaArcAMBQbK9vjQpIxcziamJLAa0kji1/TCoo6PH7qdDcARyd+R8pM0tnSRW/TDo6ePc4Ph4+wq3F7WYhf00gaWRCMSGmrFxPLVsYnJLr4z/tyyUqxr7mbOt3NruBWXhg/xeDYIDMrcVoDW3ji3oPs3tZbEqALgU9IEstWRtrqRRkNR14i6yjTzFEt9ILiyNVR9jV30xbYwv6er/HZD+/l1cQVdrbeBcAf3/jTmvW+ug/y6WALANVCJ23akHVUNBx5SQIoyZmZRZNarRCyCgpVb2ZmeRq/t4Yvte5kcn6Sk+OnCHprOXLXV+kObeN0/E3+nIgBENRdzC5aKMmvgPxuy5x61FiybI8SeGXxARi4fIaFlQWeHP4JCXOZK4tXub/jPmo9NRweH2Rg6sJarU9qCAeMJdOWOfV9ALH6jd/5469fCm2quqM65GI6axWBHmnfzdZNrfjcPjpbujh69nhB+Or4gKuKxLzF/ILx19FDJ3rXTACk7fQtzqcdv9LwSa2o+ddXXqWrpYvOli5++/rpkgCf1PAowWLcsGVOfXcte/VHNBwZcSRvziyYhDR3UUDczvB2/F+krBQ/uviHonWAkOZmZsFECf4ZDUdGiiBrNnEj51GipM3iyjyXpi+VBKy3EI46UJC7/iIajowowT/K2Vi5LEtmoqxFLG7g6GJ4vUURBEA46sBi3LDL2cRT80VzNVJHsyG1kLZl1ul773oRJBqOjDi6GL42ny6yafDXM5WaK4LU626m4gaOLoej4cjke9eL3z5AZp2+pbjxTn3QS43USTo2AN965edFtQHpwskqjISJhCKLkibXbSYdl3x5Km5QrxfvzfoR0l15C02cLmVRFrJqYyRMnKwiIF0lawoscurRslnlFqLhyKSS4uRU3CCkl4ass4iUs9gQAiAcdXBlycqUsglIF5msw8qSlZE59dhGORtCouHIpNLEscnZlQIbXQhCuot3p1ZQmjgWDUcS/zUEQNpOfzaZyViGzebrRzqoubAMGzudzUjb6b9hxo0KouFIQmniWGwuTUjT0YVkk9SJzaUrsqgIAnkbO521DMOm1eXFyFtYlVhUDLl+t8/EZg1bF4LYrGEDz1RiUTEEQCh12Dbt3LW5NLZprwilDlfaWzEkGo4klOSxxbkVlOQ7lVq8LwjA6KETzyrBa6OHTjz7fvrE/+N//L8BBEGzOMpYkX0AAAAASUVORK5CYII=" }, base),
iconCroplandTripleRainfed: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandTripleUnknown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAG+UlEQVR4nLWXbVBU5xXHf89z774Ay4KALCIBfOlAjQKtCaJlNGlMMtrYdpx0YqeTdrQzxnZMx7aOmW3SNDq2mjb50IxJbNpxv3RSbKJNa2baSDRk8uJKIGW0vpAURUN4EXZZYNm9u3v3Pv2AUDawQCf2fHr23vM/v3uec59zz4qWlhb+36YDrHp6W5vSRO4tj26pruY9R+p1AGGpas9C1y1n3PhkpKzuwNZyve7A1rssmwwXZDtcwWTilgHyNBs9zoipGclyHcgVunQppRgw47cMkiE0HHZdN43kXVIJUedwahhKfe7A28vX8MTyrwOQwCLLrpG0y3Jp2USRTcpZAxTodp6q2jxnoKkUNodEmqpGSlPVZDg1oio5o2h9YSXrK9fz6JJ1c4IkLEWWrqEkLqk0kSulmFU0P2MeAA+tfGhuEKyxhcIlhalyM3VJzLLmJIaxrdtSXDVrVjJDQyaVRwqlcoRDI0n6wlc6XDR2tRI2RggbIxy+5zF21u8gnIjODBFjO6RP/pHOtlTcR135Ki71XuKv7Y3sv/9xAE50t6X4vdT5/sQ6YiVx3IwrARxCELHSF76h/SQAd5bXsrxgCcfajtPQ2sDOZQ/M+HDjpgMYpkWm1NKC3DYnz7//B1YWr0Ag+Mqi1RTlLOBo69G0gTOlhmGO1VlauuiIG0lspD8rGxev5bGv/phC13wau1opylkAQGNXa1qNDUncSGJpolsCZ0ciCVyaluJU6XBRoNsBOHTxdcLGCFUl1dQXreDQu4f55alnWO1Zlhbi0jRGIgkQNElpqldCw7F4ppDok16Ay7Ewm4prKNDtrM4t489txznaepS+0QFKcxby+D27Wbe4flqALgSZQhIajsWlqV6Rfq/vNRKWMowkWUJPcfZdb2ZTcQ3lOQvZVvc9vnb7Rs6ErlFbegcA//jozYmsNxV8gbtzSwDIEjpRw4SEpfxe32sSQElO9g0auLVUyDgoPyuPvuFeXM5sHiytpTPQybG24+Q63Txzx8PU5C/mxMDHvBXqAiBXt3FjMIaSvAw3X2GZVD+KDMVMhxI4p2mWDe0nCY4G+dWpZwkZw1wbvM79lffidmRzsO0oDd3nJnwzpYawIDJkmDKp9gGI8W987W++fzl/XkZFVr6N3kRsCujRJesom1dKpj2TqpJqDr17OCX4uN1myyAUiBEIRt5r3nOkfiITAGlaOwYDUculNDKlNkX8p2tnqC6ppqqkmr+dPzEtIFNqOJRgcCBiyqR6YiL2+MLv9TVZko/7ggb5mn1KgAEzTsfAFcKxML++9Pcp9wHyNTt9QQMluOD3+prGr6dUWprWjsGByJuePKc2XQcYHA1gJIyUa3nBWLs9low6pMY8p8i4GoguEUrtmuyTAvF7fU2rnt72r76gUZ2f7yBipXbZWDJB3AgB8KVzwabq88Ev2y0WueXYqR1OmvEawfDaR3YOpIUACEvtGhyINHrynPp02QyEA2w43d1c3jW6tjY7V3o02+Tb9r5kIq/ld8//s+fDlr3rnty3H5jasPxeX5Oli1M9geiU2hS65jP4etPbSz81Vt6XUzABcJS7ybu3itse+SaLam5jvTtPv9Hywc9bj/x+A0x6hSdb3YGt5cDVpUvzCIgEI5Y59phxa+g7Df/OWJs9z373b/fi2fAwnS/tpXz7Lya0iVA/H3x7I9c7ApwZHQlveflV97St1+/1dVo2+Ub3QIT5+n+zKeoZvewSuubRbNjcuQDYcvJStLbc+bhrluHRbGQg7D3n2orS9neZsHZEQgZWQpEjx7YlPxiLltidUw/RZ8zpKQKg2OawB690VKSF+L2+TiXFse6BCPm6LZ3btJZ3Z2p3nnGqE5baPToUi49nE8626f03R9nL+/fRum0DXcdeJRHqT9HdaHoDgH4zjsvj6ZoR4vf6OpUmXuy8MUq+buNaafaKQMwgbFnEOocZPnOFyPleLj75QwCi1y7w1hcr6PljI2HLIhAzKFtd3zHrfCpN66nESDwei5i4Mpw5Hy0vePudkVAyNml2DjaeI3rtAnpOIQAxpXgvPBSv2fytzXaXS80K8Xt9IaWJF7v6o+RrOmdXFa4LZmmfnB4eTIYnDYQX9+7mw+0PErYsmkZCca2wsGnl9h/8BdKck89a3YGtuUqI3vJSt8ORqROLmJQ2XT9d+elwrVuz2YttDjtAdyIWj6Litz/wje+OA+YMAVh1cNtB3an/tGJRjt5+dcg0DfPZd3Y+5+0511YUvNJRAZC3eEn7gqqaXrvLlTKOTv3epjGh1EHTMHf19Ed10zBHhVIH7S6XKltT31O2pr5nJu3sf0xumt/rCynJTwb7R1GSn/m9vtBctXOGADTvOfKCEpxt3nPkhf9FN+eafB77Dy+A6KAeQ9pEAAAAAElFTkSuQmCC" }, base),
iconCroplandUnknownIrrigatedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownIrrigatedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFh0lEQVR4nL2XX2xb1R3HP+fcc23HcRq3TtrSZmnWChExSCLBSjqilT8dSLDyME2CFzQB0lRNgBhCRR48VNM2ug0kHjpapql+g2SoFaxIG+2i5QGKiRop4s/agthSsNImcRKnsa+vfe89Zw/5owTbidk6ztO5Pr/f93M/95xry+LcuXP8v4cCuO23j44aS8Svebo2meGDx/sUgNCme8v22DVnTH45v6P3hUc6VO8Lj9yhbZlvaQrHZgLvmgE2WTaXI45vuUGHAuJCyZgxhqxfvmaQBmERDinlu8Ed0gjRG45YuMb8z8E/7fgez9/0AAAemsaQRRCSHVLbYqst5boBLSrEoa4f1Q30jcEOS6RveqT0TU9DxKJogjWb9m3uZF/nPp7YtbcuiKcNjcrCSGLSWCIupVi3qbVhIwAP3vJgfRD0wsQQk8I38aiSlLSuqxkWHt1D27rWtZINFjIwW6QwplmELQJqb3xnOMaZzAh5d568O8+xu5/l8b4D5L3i2hCx8ITUyota46Eb7qG34zbOXznPWxfP8Kt7nwPg1Pjoqro/jp1dnjs6ILyYKwHCQuDo2hvff/E0AN/t2M1NLbs4MXqS/pF+Hr/xh2ve3NJQAK6viUqrJmiDHeEPZ//ELdtuRiC4/dt72Np8HQMjAzWDo9LC9Rf2WWolPi+7ATa135X7dn6fZ+/6OZtjrZzJjLC1+ToAzmRGavbYSMpugLbEuAQ+mHc8Ypa1qqgzHKNFhQA48s+3ybvzdLV107f1Zo68e4xfD77Ini031oTELIt5xwPBkJS+eSN3tVSOColacQAulPLs39ZDiwqxJ76DP4+eZGBkgIlClvbm7Tx39zPs3dlXFaCEICokuaulsvTNGzKdTL2Jp43rBjQKtao49cUw+7f10NG8nUd7f8L937mP93OX2N1+KwB/+/Tvy9b7W67nzngbAI1CUXR98LRJJ1NvSgAjOT0x67LBWg1ZAiUaNzFx9QqxSBM/bt/N2PQYJ0ZPEo9s4MVbH6YnsZNT2c/4Ry4DQFzZTM6WMJLXYPEIy8A86cyV/LARRKp8WfZfPM1MYYbfDL5Ezr3KpdkvuLfzB2wIN3F4dID+8Q+Xa6PSQmhw5lxfBuaXAGLpN3737x+7kNjYcENjwuaKV6oAPbFrLzs2thMNRelq6+bIu8dWhS+Nb9kN5KZLTM847w0fPN63bAIgfX1gdrqoY8YiKq2K5tcvvU93Wzddbd385aNTVQFRaRE2gtms48vAPL+cvTRJJ1NDWvLZxIxLwgpVBGT9Mp9n/0W+lOd35/9asQ6QsEJMzLgYwSfpZGqoArJsk3WCsBFVbWYL01y4cqEqYKWF0OapVbkrL9LJ1JARfFzLphR4zLm5mhaZrINWYnClRQUEQGjz1GzW8WvZZPPTFZ81SYXlQ36m6EtPH/jqegUknUwNaSUGL08XK2w2x1oZz09VQFpViPGsg1ZyMJ1MjX11vfLtA6SnD8xlnX+3xiM0ScW89gH42dlXK2qbpY32DE7ORUKFRVWTRZsxbct3xrMOrapyb1aOhLIXLCxxqppFTciSjZNz0Z6hWdpVa1ZZBObJmlm1FtLJ1JiR4sR41iGhqkNWWKRqWawJARDaPFOYK5Wr2TRLm7KnKcyVyjIwT6+VsyYknUyNGUscHZssrLJRQpBQNl+OFzCWOJpOpnL/NQRA+vqQN18ulxyfTYtHOm7ZlBwfv+iVpa8PrZuxXkE6mcoZSxzNTBVJWAolJBulIjNVrMuiLggs2PhFr+Q4Pu12BGfBolSPRd2Qxbt9OTPp+EoIMpOOD7xcj0XdEABhzGHf9YPLU0V81y8IYw7X21s3JJ1M5Yzk6dmpAkbyi3otvhYEYPjg8VeM4IPhg8df+Tp94pv4H/8fpFR4Nq6mVaIAAAAASUVORK5CYII=" }, base),
iconCroplandUnknownIrrigated: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABU1JREFUeNq8V1tsFFUY/s7M7G637dKltqWlXirQgkUNoKYUmgg2SMAYolblQZT4YNoIqISYiEYUH+DFBKGGQGLoCyZI8BJCACMJJAXxgZSojYVSKbRlt9sL3e7ubHd3dsbzn7Irm9nZDlqdZHfmzMz5Lv/5z3/OMMMw8F8fCv05Ni2/bMjMO+3outGv7TvfwMiJs2WZcf+86efovzZGp4cVTrBCd0rhipnuwoAWnzaCMsWJG/lhTVa1KgqXlznlQnLkS0xMG0kBk+HOU5S4qq2QDIktdbsVqLr+r4F3LFiDg3VviusYdHhcCpJ5UpWkO1m5U5amBKhw5KGt/i3bhBqPjMstQ0oYiyT6K8xXEDGSOTs1VS5G05KXsfvRdbZIYjwyHocCQ0KhRKkrSWzKTpWFZeK86elNtkjiuBN+g5MwzfB6HDKietJ2KCh0m6vqp3QlF/BwacYsielGEeOx02A98xe7i3Ck5yyC6pj4nWlqxa7ndiIYi+QkSUVISTdyGHln0atYtWAVLvVdwlcd3+Dw+gPifltve8Z7n3adTF+HkxrczsmEEv9uJombVscXl4+I8zPzG1FXsRAH2g9i77m92PXk6/Zrl5pIolBWLImKnfn48NRnWFG1lKuSsKZ2NR4sfgit51otgQmPcIUT3cF6JlQNTljPlQ21z6P1xc9R6a0UY0MEdNC11UF4hKsr7JYs1T1QJyvyY8UzXBhLJjIGmzGGsK7hl8FOvPHIWswrq8bQyE2c+OMUjv72A54onY/20T+zkpQ7XBgdiUGNJo7TZDw6fHsi7pFkKOzv+dIRDWJjVYNI19UlNfiSjwOFp2/ch5r75uDAS3uwbuHa7GPAcQiPcAlfiu+/8D1iSUPl1mZIjoyXd3X/JIgWcNDtz76PDU+9htPDV9FYs1I8P3z5aNr1xorH8ULJXNEmnEiER4XjEr4YCEPGj30BFcWyw6SKiMo9Zei/3YeifC9aqhvR5e8SGVaaX4xvV25Dw6xatPl+xXfDPaJPicOJ/qEo4X6dTmE+K7eERqNaHi80bm4zWwoPjg+i+dh7GFJHcXWoG+uXvIKZbi/ebm/Fvt6fM7JK4kkVGlE1jruT7rHUGq9saegqLy2Y7yl3oS8eNRFRCakprYYnz4P6OcvwwYmPM8BTxzxnAYb9UfgD4fO09KadiIuE3hwYjOhFhiLUmNxcOY3lc5cLgkMX27ISUD+KRsAfJhcfpbHTVXP/hbO6hO7+wQjKZZcJgFbNTl8nghNBbL50OHva8n7U32DoJDwTSdqNP5wkNdncBPi4dNzssJzhKRcsabybgZuxBnB2ruJ3KzcTWgwj6rClix5fiGb4mbtdmEhEJnAVpMbKjS/oN93z8tSX+bQIDkY0Ka43m0q+aUWjseFqbvjDJjdUu64HB0wks3lV6PWFoTskctGbtQqbmLmaEV/4+uySfKEyVdNWndxhrtCyE8mYjtCwSoqbs+JlXZ+5Gr7hO03qSGWugwqhcKGw49lcWJKk3JA6Uklqs64zd7vgVcMSy3K3wVXxncwxUklqp3BxyMpFTpI7mbZtfCQaz+aG2hOxJOg5d7E154Yi596J3Chs/5WB8Qw3tF5Q+1rvOOg5f2/sH5PcqQKfxG7H4tFQgu/UJ4lK+ZnaiXA8Ts+nxJhyJ8hVktqeW3xs+OeAg+9sSnlaU9uOC1skKTdcdSzE1Ve7ChCadBGz48I2iVDLsKdnIKQ5+HjQmdp2XNgmEZmmG7sTkUTyxkAYCTURobbdvrZJxNjI2Bq4FaLPge12XUzu7Pnyey8/paX+4r32Yf/Hd/xfAgwA3pDQ63Vj/WsAAAAASUVORK5CYII=" }, base),
iconCroplandUnknownRainfedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHI0lEQVR4nLWXe2xT5xXAf/e7j8TBjh3ziNMECKEllPIIDDryaAdjwOg60XZsYxJU7KEWBqVsqzbRrqw8VNC6TqWkskDahqpSKaWMalKnMUobSmLYBoIVUp7ZQsmI8wLH8SO+vr7f/gjJMIkD3diRLPten3N+55x7zvFnRUrJ/1s0AH1N5SmpKp677t2WzdaO+ipFSomxqkIW3Xv3Gc2XQgDjNGNVxRzbEJGCPIezzTLvGmCUZnA5J2KpMatYAzyKoTqllLQke+4aZJii4sjWNDNmzRFSKLMdDo2Ybf/XDmc6PERWHySy+iD1i18BIIGNK0sjlS2KhW0oPkMVt3VUoGezu/ypIXUef2sF04rKmOnwYElJlkNFJGWZEElZ5szRiMrUkA6WFE5nyYxvsm3y4jvKLmHbuHQNKXAKqSoeIZTbGhU6RwGw5ktrMursX7abjy9+zPF4CJMb5Zc4hWJJj0tXidtDZ3KzFOjZPFNcPiCrVw79mimFk/uv1WEqwpL5QrGlW3GoWGSe/OkONzWNtXTFQnTFQhxaUs3Wr22iKxFN0zvb2Uhejpf57kIA+iqk9V8MkcizZd9m/sT5nLhygt+cfIc9S3cCsLupDoDj8RDON+YD8M6NdwCH0dtQAsChCCIpKyNk+6kaAL5cOo8vFjzAzrpdvH74dbbOfDJzZDeJBhBLpnCqWkaQ18jhhT9tZk7xbASCRZMWMsY7lurD1RkdO1WNWLK3PMLWlcaemIVB5llZPunrVD/xKoWeQmoaaxnjHQtATWNtRhsDQU/MwtaUqwL4S6jbxK1qaUrTHW4K9GwA1h9/k65YiPKSCh4dM5v172/g6X3r+GrRrIwQt6oR6jZBoVaIpNzbcb3HdAkVTfnPvJyMd7GiuIoCPZuFIybwRt0uqg9XcyXcwoThJez8xmssfuCRQQGaouASKh3Xe0yRlHuF6Q+8RyIlYzGLXKGnKW+9+AEriquYOLyE5xf8lOWzlnGg4wLzJswFYM+pvf1ZryiYyuMjxgOQK3Si0SQkUtL0B94TAFLlz1faYnjVdEgfyOcaRfP1K7hzPKy6bx7ngufYWbeLkTlefj/3OaryJ7G75RP2dzQCMEI3aG6PI1XehhstLCy5tvta3MqWAodQB4C2n6qhNdzKyn0/oj12jQvtF1k641vkOTysrqtmR9PRfl2nqiFS0N0Zs4QlNwEofb/x2tqqc76Rw0pdviyumPEBoG2TFzNh5H24sl2Ul1Sw/v0Nac775F5jGB3BOMG2SL21o76qPxMAkbRXtrVGbbfUcN7SaQDbzx+gcnwl5SUV/O7Y7kEBTlUjWwraghFLWPLn/b77Ppj+QK0tuNjcGsWnZg1w0JLsoaGlga6eLp45sWfA9wA+NYvm1ihSocH0B2r77qeFLJL2yrZg5IOi/GHqYBugLdxK7JZSeoOx83pPKu4QKt4cxfFpW3S8Yst1N+ukQUx/oFZfU3mmuTU6zedzcOkWSI+VIBHrAKCsLlg7tb5lhm4xLleoBkDYTpmligwv2/LLjowQACUl17UFIweL8odpg2XT0hVkYU3jX8de7Hr4QZdb5Ke3vdGaSnr3v/Czk+c+OrTx+2++vQUYuLBMf6DW1pRDl4ORAc+m0FPIpd/uOzy+sfsLC9zD+wFZxbl4509l9NOPMa5sNF/J9WqXPjz04h82v7QIbmrhtHBWVRQD/5wyZRStwiSUSvbe70l1Lf3VKcfDLo8xd/tG8hctp2nXRoqf+kW/bTLUzt++8wifNXZyLBaJbG24mDvo6jX9gSbbEAeaWiLcc2NJAviawuecQlXzVR091wOA7vam2eqekeSWTSJf1XGgGBfqj/gy7ndh2iu7O2KkEjbe3udKXjAWL9KzB66EWyQ73wdAgWYYzWdOl2aEmP5Ak1SVfU0tEXz6wLkZSryzqtIDHkpZScnnwp1xsy+bqMfQ2m+cl89t2cSJ7y2ied+7JEPtaXZttQcAaLdMho8Z0zwkxPQHmqSm+M//K4xPz+Kzid4pnYkeIrZNoilM+Og/iJ0O8umGHwIQv9zAR/eX0vLWQSK2TWeih2mLHm287flUJO2XEtcTZrw7iceZ475Ufs/hI5FQKnFTV147+Anxyw1o7t4DYEJKAtGwuWDl6iccbrcctIVvFW1t1WtGtv5sWWkeZxNRllSfbsoLJUc/5PKoTtEbZ255CVYkRtvfrxKIhs2c0aNrXzx6fCFkmJNbxVhV4ZGKEpw4wZvlcOnEu5OMevfsh6WXOh90a4ZRoBkGQItlmnGkOee7P3jysc0v7++zvyMIgL66cpueo/9k+v3DtZNnO61kLPlq+OU/rr9Qf8TXfOZ0KUDR5CnnJ1Q+FHS43WlO7xjSl01+gTOrNRjpUmxZbPoDoTuxvf0fkxti+gMhqfLjtqvdSMHzdwoAQEr5uV7aqvJjn9fmjsv1v8i/ATM3QLt5U+ZIAAAAAElFTkSuQmCC" }, base),
iconCroplandUnknownRainfedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownRainfedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAHMElEQVR4nLWXbVBU1xnHf/fcuy/AsosLsogIKLZQE4HWBDFlNGlMMto46TjpxE4n7UhnjO2Yjm0dM9u0qTq2apt8SMYkNu24M51Mikm0ac20jUSDk6SuBCyj9QVTFAzhRWBZ2GX37u7de/oBoWxglbb2/2X3nPv8n/95znPOc5+rtLS08P+GBrB8X32bVJWc2+7dlN3N2w/WaQCKKas88x23XeP6J6GS2j0bS7XaPRvvNS0inJdtcwSSidsm4FYt9NojhqonSzUgR9GEQ0rJoBG/bSIZiorNqmmGnrxXk4pSa7Or6FL+1w6X2LJ55ZF9AFzub6f+5PMkMMmyqgSsolSYFqXAIsQtHeVpVnZUrr+pzbY/7+DznnKW2LIxpMRiEwhDVgthyOoMu0pUJm/qYHV+BasrVvNk2apZRZcwJVmaihQ4hFSVHCGUW5LmZswB4LFlj6W1eXbtDs5cO8OFWIgE5vikxCEUQ+ZkaoKYac5qhTC+dRsKK6dF9bvmV1mcXzY5FhkqIik9QpHSpdhUkqRPfIXNQWN3K2E9RFgPceD+p9hSt5lwIppid3WkG6fdRa0jf1xEGd8hbeogHTaUP0ht6XIu9l3kj+2N7H7oaQCO9rQBcCEWou717wHQeOMXwHbDr5gYRMz0iW9oPwbA3aU13JlXxuG2IzS0NrBlycM3XdwENADdMMkUalohp8XOi3/7LcsKl6Kg8OWFKyhwzeNQ66G0jjOFim6M51mYmtIR15NYSH9X1i5ayVNf+QH5jrk0drdS4JoHQGN3a1qOBUFcT2KqSo8ATociCRyqmmJUYXOQp1kB2H/hbcJ6iMqiKuoKlrL/gwP8/PizrPAsSSviUFVCkQQoNAlhyDeCo7F4piLQphyAS7Ew6wqrydOsrMgp4fW2IxxqPUT/2CDFrvk8ff82Vi2qm1FAUxQyFUFwNBYXhnxD+L2+t0iYUteTZClairHvWjPrCqspdc2nvvbbfPWOtZwKdlFTfBcAf7387mTU6/I+x305RQBkKRpR3YCEKf1e31sCQAqO9Q/rONVUkQmh3Cw3/aN9OOzZPFpcQ+dQJ4fbjpBjd/LsXY9TnbuIo4Mf816wG4AczcL14RhS8BrcOMIiKb8fGYkZNqlgn6FYNrQfIzAW4BfHnyOoj9I1fI2HKh7Aactmb9shGnrOTtpmChXFhMiIboik3AWgTLzja371nUu5czLKs3It9CVi04SeLFtFyZxiMq2ZVBZVsf+DAynOJ7DAkkFwKMZQIPJh8/aDdZORAAjD3Dw8FDUdUiVTqNPIv+86RVVRFZVFVfzp3NEZBTKFik0qDA9GDJGUP5n0PfHH7/U1mYKP+wM6uap1moNBI07H4BXCsTC/vPiXac8BclUr/QEdqXDe7/U1TcynZFoY5ubhwci7HrddnakCDI8NoSf0lDl3INZujSWjNqEyx65kXB2KlilSbp1qkyLi9/qalu+r/0d/QK/KzbURMVOrbCyZIK4HAfji2UBT1bnAl6wmC51i/NaOJo14tcLoyie2DKYVAVBMuXV4MNLocdu1maIZDA+x5kRPc2n32Mqa7BzhUS1TH1v7kwl3y69f/HvvmZadq57ZtRuYXrD8Xl+TqSnHe4ei03KT75jL8NtNJxd/qi970JU3KWArdeJ+oJIFT3yNhdULWO10a9dbPvpp68HfrIEpR3gqavdsLAWuLl7sZkhJEDKN8WXGzZFvNvwzY2X2HOt9z+/Es+ZxOl/ZSemmn01yE8EBPvrGWq51DHFqLBTe8NqbzhlLr9/r6zQt4p2ewQhztX9HU9A7dsmhaKpHtWBx5gBgcblTuJacuTirl+BRLWSgWHvPthWkre8iYW6OBHXMhMQlxrclNxCLFlnt0y/RZ2D3FABQaLFZA1c6ytOK+L2+TimUwz2DEXI1SzqzGeG+O7U637SrU0y5bWwkFp+IJpxt0QZutLKXdu+itX4N3YffJBEcSOFdb3oHgAEjjsPj6b6piN/r65Sq8nLn9TFyNQtdxdlLh2I6YdMk1jnK6KkrRM71ceGZ8eYh2nWe975QTu+rjYRNk6GYTsmKuo5b9qfCMHckQvF4LGLgyLC7Lt+Zd/L9UDAZm9I7BxrPEu06j+Yab4ViUvJheCRevf7r660Oh7yliN/rC0pVebl7IEquqnF6ef6qQJb6yYnR4WR4SkN4Yec2zmx6lLBp0hQKxtX8/KZlm777B0hzTz6L2j0bc6Si9JUWO222TI1YxKC46dqJik9Ha5yqxVposVkBehKxeBQZv+PhR741ITBrEYDle+v3anbtR+ULXVr71RHD0I3n3t/ygrf3bFtB4EpHOYB7UVn7vMrqPqvDkdKOTn/fpoEi5V5DN7b2DkQ1QzfGFCn3Wh0OWXJPXW/JPXW9N+Pe+sPkBvxeX1AKfjg8MIYU/Njv9QVny521CEDz9oMvSYXTzdsPvvSf8Gadk/8F/wLjPvwPpPDHlgAAAABJRU5ErkJggg==" }, base),
iconCroplandUnknownRainfedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownRainfedVisited: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownRainfed: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABXdJREFUeNq8V2tsU1Uc/91H23VrWZnb2BjqBDaQhwJiYLBEcJlEjCEoKh9A+WRGeKiEmIhGDX6AhGgQRggmhn0QEyCIhhCZugTIUEwkI+rCY1QG22jXrWNd29u1vb3X8z9bK/X2doVMT3Lvueeec36Pc/7nnHsFXdfxXyeZbpbNSy/rkuAad3RN71b3X6gVyIl14xJ9yvTx5+i+MUjZYzIjWKZZxVD5RLvDp8bGjaBUtuJWfkiVFLWShsslWCUHOfLEh8eNpECQYM+T5ZiiLhN1UVhst8tQNO2BARfaXQht+pFfF1bt4e+i0OC0yUjkiZWiZhXKrJI4JlC5JQ9NNW9mbbP6qw14cso8TqqykbHZJYhxfZ5IN0e+jLCeyAqwpmI+1ix4BbvnrMrJXZSNjNMiQxfhECl0RVEYs1OFo5Tnm5/ZbNrm5LomnO84j98ig4hhdPh1RiKoustpkRDREjnPAQ3dlsoag6s9LZ9hbsWcVFkqYMOl6pNEQdMLBTZ2KsxX/nx7IY66zyKgDPKrZU0jdr2wE4FoOK3dFb8bE/OLUF9YwcvJEZJThSxG3pr3Gupn1uNS1yV82XYMR9Ye4u+bOlt5TsPjOFDPn4+N5pTs1pGA4ne7ICKUUE1JPr98lOfPzqjDovLZONT6Bfad24ddC1/Pfe9S4gk4JNmUqMiaj/fPfIJllYuZKhHPz1qBR4oeReO5RlNgwiNc7kSzCO5hRYUV5mtl/awX0fjSp6hwVfC5IQJK9GyWCI9wNVm4I4mLHl4kydLcogk2DCbiaZMtCAJCmopfe9vxxuMrMb20Cn3+2zh95QyO//EdniqZgdaBvzKSlFlsGPBHoUTip2gxHu+/OxxzihJk4Z/10hYJYENlLQ/XFcXVOMDmgYana8iD6oem4tDLe7Fq9srMc8BwCI9wCV+MHfz5W0QTusKsTRAtaY13dfzEiWYy0B3PvYv1T69Dc/911FUv5/VHLh9Pud5Q/gRWF0/jZcIJh9moMFzC5xOhS/ihy6egSLIYVBFRmbMU3Xe7UJjvwsaqOlz1XuURVsLWxDfLt6N20iw0eX7HyX4371NssaK7L0K4X6dCmK3KrcGBiJrHNho7s5kphHuHetFw4h30KQO43teBtQtexUS2EW5qbcT+zl/SokpkQRX0KyrD3UnvhOQZL2+tvVpWUjDDWWZDVyxiIKItpLqkCs48J2qmLsF7pz9MA0+m6dYC9Hsj8PpCF+joTTnhD3Gtwdcb1gp1masxuLnWjKXTlnKCwxebMhJQPxoNnzdELj5IYScf2ASd1UR0dPeGUSbZDAB0arZ72hEYDmDLpSOZw5b1o/66gHbCM5Ck3HhDCVKTyY2PzUvb7TbTFZ50IST0t9Nw7y0QO1Pxp5mbYTUKv9Jv6sLtCdIKb7nXhYGERwJTQWrM3HgCXsM7Fwt9iS2LQG9YFWNaw7/rDSR8bpiaW96QwQ3tXTcDPQaSyWxX6PSEoFlEctGZcRc2MDM1fk/o5uTifK4yuafVf/+RcYeWrEhENQT7FVLckBEv00tSwz74mkkdqcyWaCPkLmThVCYXpiRJN6SOVJLajOfMvS7YrmGKZVZBqtiXzAlSSWrHcHHYzEVWktFI2z7kj8QyuaHycDQBqmcutmXDyUrC3cjCwWs9Q2lu6Lyg8o3OIVA9azf4wCSju8DH0bvRWCQYZ1/qI0QlLKdyPBSLUf2YGGM1IJWk1n2HzQ37HbCwL5sSFtZUzsVFTiRJN0x1NMjUV9kKEBxxEc3FRc4kXK2Ave6eoGph80E5lXNxkTMJjzRN3x0PxxO3ekKIK/EwlXPtmzMJnxsJ23x3gvQ7sCNXFyNf9uz4vZ9L3lhz8X77CP/Hf/zfAgwA63XjaZP4vsgAAAAASUVORK5CYII=" }, base),
iconCroplandUnknownUnknownThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconCroplandUnknownUnknownVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFeUlEQVR4nL2XX2wcRx3HPzM7e2efz/ElZydpYhyTCNUq1LbUkjrCIoUGKhXygpDaF4TavkSorUpVpTrKQ4SABihSH0ITJJR7A5sqUSFIQIKFH0p7tWLJ4k+TtGpx2pMT22f7HN/t7d3OzvDgP7J7d/YVGeZpd+f3+372szN7pxVXr17lfz0UwAM/eWLCOiKx7enGZsdOnh9UAMLYvj3749vOmPlo6cDAS493q4GXHn/QuLLQ3hqNz4fBtgF2OS63mjzt+GG3AhJCybi1lpyubBukWThEI0ppP3xQWiEGok0OvrXbBgAIMLREHMKI7JbGFXtdKbdsalcRTvV+o2GIthY3KpHa9kupbX9zk0PJhps2Hdvdw7GeYzx96GhDkMBYWpSDlcSldURCSrFlU0fzTgAeve/RxiCY5QNLXAptEzElKRvTUDMsP7rH9vVuaSWbHWRo90hhbZuIOoTUX/ieaJwr2XEK/hIFf4lzD73AU4MnKASlzSFi+Qmp9Sf1xmN3f5WB7ge4dvsav7txhR8+/CIAl6Ym6vZ4JiS6kisBokLgmfoLP3TjMgCf7z7M59oPcWHiIkPjQzx1z9c3vbnVoQB8bYhJpy5oh9vEL978FfftuxeB4AufPsLetrsYHh+uGxyTDr5eXmdplHi/4oe41H9XHjn4RV748nfZHe/gSnacvW13AXAlO163x0VS8UOMI6Yk8PaSFxB3nA1FPdE47SoCwJl3/kDBX6K3s4/Bvfdy5o1z/GjkZY7suacuJO44LHkBCEal1Pa1/J1yJSYkat0GuF4ucHxfP+0qwpHEAX47cZHh8WGmizm62vbz4kPPc/TgYE2AEoKYkOTvlCtS29dkJpV+ncBY3w9pEWpDcfrDMY7v66e7bT9PDHybr332Ed7K3+Rw1/0A/Ondv6xZH2//DF9KdALQIhQlX0NgbCaVfl0CWMnl6QWfHc5GyCoo2bKL6Tu3iTe18s2uw0zOTXJh4iKJph28fP+36E8e5FLuPf6azwKQUC4zC2Ws5NewsoVlaJ/xFss6agVNNX4sh25cZr44z49Hfk7ev8PNhQ95uOcr7Ii2cnpimKGpv6/VxqSDMOAt+lqG9gcAYvU//vDPnrye3Nl8d0vS5XZQrgI9fegoB3Z2EYvE6O3s48wb5zaEr45Puc3k58rMzXt/Gzt5fnDNBEBqc2JhrmTi1iEmnarm39x8i77OPno7+/j9Py7VBMSkQ9QKFnKelqH9/lr26kEmlR41kvem532STqQqIKcrvJ/7gEK5wE+v/bFqHiDpRJie97GCf2VS6dEqyJpNzgujVtS0WSjOcf329ZqA9RbC2Gc35K4/yaTSo1bwz3o25TBg0c/XtcjmPIwSI+stqiAAwthnF3KermeTK8xVXWuVCkdDYb6kZWBOfHy+CpJJpUeNEiO35kpVNrvjHUwVZqsgHSrCVM7DKDmSSaUnPz5f/fYBMjAnFnPevzsSTbRKxZLRAHznzV9W1bZJFxNYvLyPhCqLmiYrNpPGlX+eynl0qOq1WT+Syl22cMSlWhZ1Ias2Xt7HBJY26das2WAR2mfqZtWbyKTSk1aKC1M5j6SqDVlnka5nsSkEQBj7fHGxXKll0yZdKoGhuFiuyNA+t1nOppBMKj1pHXF2cqa4wUYJQVK5fDRVxDribCaVzv/XEACpzalgqVIpe5pdK1s64biUPY0uBRWpzaktM7YqyKTSeeuIs9nZEklHoYRkp1RkZ0sNWTQEgWUbXQrKnqfpcpvwli3KjVg0DFm521eyM55WQpCd8TTwSiMWDUMAhLWnta/DW7MltK+LwtrTjfY2DMmk0nkreW5htoiVfK9Ri08EARg7ef5VK3h77OT5Vz9Jn/h/fMf/B+uMdEDhmfPVAAAAAElFTkSuQmCC" }, base),
iconCroplandUnknownUnknown: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABTdJREFUeNq8V1tsFFUY/s7M7G633aVLbUtLvVToRYsaQA0UmggSJWIMUavyIMqTabWgEqIRjRp8gBcThBqCMaEvmJAGvCARjCSQFMSHpkRtBEqlpZfdbreX7e7O3mZnPP+0W9jMTncw1ZPszp6ZPd/lP//5zxmmaRr+6ybRl61l7WVNZJ55R1e1QeXghQZGTuzNa7S7q+afY/D6JF3ulzjBOtUuhMsXOl1+JTFvBKWSHf35YUWUlUoKl4fZRRc58iZj80ZSwEQ48yQpISvrBE1gq51OCbKqzmuo4lDhdkhI5QmVgmpnZXZRyDmo3JaHtvo3LJMoPDIOpwghqS0X6MuVLyGipeYc1FixAo0rX8K+hzZbc8Ij47ZJ0AS4BEpdQWA5B1W4SvVryxMtlkgSmAm/xkmYonncNhFRNWU5FBS67ZX1OV2JBTxcirZIYKpWyHjsFJiv/BXOQhzrPYegPKl/zja2Yu+zexCMR+YkSUdIuL1j1t5e/gp+3PI1Ogc68eYP7+Peovv0+219HaZjwikFTibcIqEO3TRrX1w+pl+frN2AVeXLcLjjKxw4fwB7H3vNeu2Skym4RMmUqMiejw9Pf4Z1lau5KgHP1G3U3bSebzUFJjzC1Z2oNtYbkxXYYb5WttY9h9YXPkeFp0Kfm3S46LdZIzzCVSU2LAqr7lklSuLDRQscmEwlMyabMYawquC3kW68/uAmVJVWY3TsJk79dRrtf3yPR0tq0TH+d1aSMpsD42NxyNHkSVqM7YGJWMItiJDYrQToigaxrbJBT9eNxTX4ks8DhWdgyouau5bg8Iv7sXnZpuxzwHEIj3AJX0gcuvgd4ilN5tYWCLaMP+/t+UUneoCD7n76PWx9/FWcCVzDhpr1+vOjl9tnXW8rfwTPFy/V+4QTifCocFzC1ydCE/HzgF9GkWgzqCKiMncpBicGUJjvQXP1BlzxXdEzrCS/CCfW70LDojq0eX/Ht4FefUyxzY7B0SjhfnNrnSjajtB4VMnjhcbJbWZL4ZGpETQdfxej8jiujfZgy8qXsdDpwVsdrTjY92tGVgk8qUJjssJx99A9lt7jpR0NV8pKCmrdZQ4MJKIGIiohNSXVcOe5Ub9kDT449XEGeLpV2QsQ8EXh84cv0NY760T/kVSb/CMRtVCTdDUGN1fPYO3StTrBkUttWQloHEXD7wuTi49msWer5qGL51QBPYMjEZSJDgMA7Zrd3m4EY0Fs7zyaPW35OBqvMXQTnoFk1o0vnCI12dz4+bx03ewyXeFpFyylvZOBm7EHcHau4k8zNzEljjE5YOqi1xuiFX72dhcGEj0TuApSY+bGG/QZ7nl46ot8WQRHIoqQUJsMJd+wo9HccDX9vrDBDdWuG8EhA8liXhX6vGGoNoFc9GWtwgZmrmbMG76xuDhfV5muaU/99ImxQot2pOIqQgGZFDdlxcu6P3M1/MB3htSRyrkaFULdhcROZnNhSpJ2Q+pIJanNus/c7oJXDVMs09MGV8VPMsdJJanN4eKImYs5SWYybdfUWDSRzQ31Y/EU6Dl3sXPOA8WcZydyI7FDV4emMtzQfkH9631ToOf8f5P/mmSmCnwan4gnoqEkP6lPE5XwK/WT4USCnufEyHkS5CpJbe8wnxv+OmDjJ5sSntbUt+LCEknaDVcdD3H11Y4ChKZdxK24sEyiq2XY3zsUUmx8PuhKfSsuLJPomaZq+5KRZKp/KIyknIxQ3+pYyyT63IjY6R8O0evAbqsupk/2fPu9k4/UXH/pTsew/+M9/h8BBgDTNMrgY48xwQAAAABJRU5ErkJggg==" }, base),
iconNotCroplandThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconNotCroplandVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAFL0lEQVR4nL2Xy29UVRzHP+fcc+60tIUWiiggrUBUIKRN0MTEBkl8BFRiQmKi/wErgsPMxrggrkh4yAqW7tSEmBCwEY1VCLggYYHxVaMkLS1EhL7m3Dt07uMcF9MZOkynDAT9rebM7/H5fc8zV1y5coX/2hTAkaOfXJVSdD7u4s4xfiC7f0CVB65v6bKux81ganKy5/CRY73q8JFjOzxPBq2tre1xFD82gPY1gdJJnMS9CuiUUrU754jj6LFBPE+ilFJxEu9QAvGS1gpnbcOEJW1t9KzrYfXqJ/G1Jopjbt78m9HroxTDcMEcay1Ka7w46lXSk09KKRcM1Nqnv7+P/r6tdb71z/Qy8PJLXP3pZ65e/aluFpwD5XlYa/uVtbZfK02a1irR2mfPnndY2tEBwPj4DUZGx5iYnGDF8hX09jzN2rVr6O/bypo1TzE4eK4G5JzFUwohRLuSUnQiRV2n27cPVAHT0zN8N/RDtcg/t27x+++/8cSqVex84zVWdnezffsAQ0Pf35su55BCALRLa12n8hTWptWArq7lrH+mF4AojunsXMZbb+1Ea7+mkX9u3eLct99Vp6+ra3mNXykPa+0q6Zxb5nkSN8+5ceMGAIaH/+DMmUFKpRIru7sbgoaH/6jJu2flGZLzBxXrXlHuaGR0jKmpSc5+9XUV9P5779Z1PDI6VpMHYNMU6cl7EOlJbJpyv5WiEgBTU5N8/sUpbt+5QyaTYffbu2pAlbhGJgHSNEV63qKBcRwxOHiuIaiusOeRzjUupZTX0iSp7AQAgiAAoGfduqZAlbhKHoAUgjRJEELclMDlUinCU6oaUJnjTc8/y5K2tsVBu99k8+bna/IAPKUolSKEEOeltfbU7N27UfnUl9WMjV1nfPwGmUyGN15/tW5HVUATk1NkfB9fa8bHbzA2dn0uQiClZPbu3chae0rmc9nTSZK4JE5Q6t66XLh4qWZH9ff3Vdegq2s5W7Zsor1tSRmaJFy4eKmaq5RHEickSeLyuexpBSCk+LZYDHd3dHSQJAkAxTDk7Fdf88orA6zs7ubFF7bx4gvb6hb49p07XLhwqeaiVEpjTAEEn8Hcy2it3VcsFnctXbpMCSmrN/LU1CSnT59hw8YN9Pb0sGb1U2QyGWYKBSYmJhkZHeXaX9dqoOVd6iiGxcThPgYQlTf+6LHjw23t7c+1trQQRY/+rrS0tBAWi4RB8OOB7P4BqJ54sNbuDYyxnqceeGYamfQ8hJAExiTW2o+q/1d+5HPZ80KIP4MwwNf6kSC+1gRhAPBrPpc9XweBqppUCPnQauarcM7tr/HNH8zRf3kUNb7WBMYghBiar6IOAuCc2x8YkzyMGm8uLgiCxFq7935/HWRubYaCoHk1vp/BGIOQYiify448EALltTGmUNNlI1NK4ZwlDEMWUtEQks9lR6SU3xhj8P3MohCtfYwxSCnPLqSiIQTKasIwxDmLmndDL6JiX6NaDSH5XHZECPGlMabuFr5fhRDi00YqFoUAOOdyxbAYLaRGKUWaJpT9LrtYnUUh+Vx2REhxcmZ65j41Aq19ZmZmEFKczOey048MAbDWHpydnY3iOEap8pbWWhPHMVEpiqy1Bx9U44GQfC47LaQ4aUwB7WsEAqUVxhSaUtEUBMpqolJUiqOYltZW4igmKkWlZlQ0DZnr9rgxhURIgTGFBDjejIqmIQAOdygqRakxhiiKQoc71Gxu05B8LjuNIGsKBYAPm1XxUBCA3IEPTgjE5dyBD048TJ74P77j/wWlT5eqZT9qlgAAAABJRU5ErkJggg==" }, base),
iconNotCropland: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABNVJREFUeNq8V1toHGUUPnPZ3Vy26W5sLhWr2Wg2UdoQ0zwUG7D6IJQQffBKaVARiiCkaeyT9KH45IP2BuJLMWhrFFoFLVUUhD40mkItFfMQN9bGtrTd1Ow1G3cnO7ue78/OdPY+W6IHZmf/nfOf73znP5cdKZvN0n8tEkDG9r19WZZlz1obZ9s3Dh96f1CAjO4dz7a2ta05g4VgEDefEgrHdqiq8sKGlhYnQ5Miy2ty1dfX03IikdZ1/YzKSB5FUd1glEql1oyFoijkcDhUTdN2qJIkbXM6nZTR9bIb1jU1kd/vJ1/Hg+RyuYQzV+evUSAQoHgsVnJPJpMh2GXdDpUR2/nQSyrC4ODgdtr+xLaiZ4892kNDO5+hqZ+m6fz5qaIoIDKqqjKY3qfiA4h6ARMA7NnzBnk9q0l35c+rNPv7HAX5MNs4SXq6u+jhTp9wwOd7iE6cmMwDAhPV4SCOlFtF6kolmAwPD5kAfy+G6PTpr0wjN65fp18uXqQHNm2iXa+8SPdv3Cj0oWOCMBNZkvDVLTOiB7SsTFpaW0U4IClNow33NdPIyC7BzioAm/zilBk+7LOKQ9jNtDFIdj0fDFnrvnfLZnG/dOkyfTzxKSWTSeFtOSDoWffdLXXBhGTrwpD29tXCnA3M0Z2FBZr45KQJtHf0rSKPoWfdB9HTaZHGJggW+LFQYBgCoKPHPqSbt25RXV0dvf7q7jwgQ6+cCJA0UFW1oiIOHRlUDqioGNleOue4rCjylfTKipEJQqKRqLh3+7tsARl6xj5hmO0Ju7J0E0wugC5yujDGW/v7RLVXBHpthAYG+vP2QWAPdrlOzsmcYqcSiYQmDinH5o+5OVF8MPLyS88XZZQBFFy4Q3X8zMXFDH3sMxIJ9mAX9pUL0z/Pnv32uwONDQ0qKKJSIfN/XaPH+3rJ6/XSwNZ+QsH+k0yhs4oQ9fZuoa5HOkXr0DgsJz/7nLRcsXJjFHai0Wj62NFDu8Vpc9x+iMfjwx6u8BXeAEHjQ+o+9+yQSN2nn3pSXIWCsH39zdm8RulgZpFwGIQmRehETuuZ0aWl+E5vc7PKmWB2ZKTu8eMTtJmLrKfbT52+DhHCEBu4fTvIvSxAM7/NFGUV5hI7neYm+a45fiH7xvfPNq33dHPYquZ9JWng/fGlJYpFI1MYvXcrfpXNm9FIOANPqtVMpdrA2bEdnoiZA3l/JAwx2Kxzu2l5efmeWTDIr0cOf9CXV/EFbHR4UysbKwtuumNFbcUQTrdzfJuJcaYg92sR6EcjERTfjzk7pUFWJ1p2DN7UwkbN6aEuEI2SDbKQDbyJRaO22bg4rSPMgusNLOarghhnE+ZasHpZTlDdWa5uhLgUi7Ig8Ia78/fwDl5WEif3Luix/plSLMqCGGzgHbx0WDp0BRajFYdWOTYc4y/hpbOgCxeyYL2JciwqguQybT/3IK0UG6wxsvGc9carjt8qbD5aXFzMZ8PtFWv8juesF7lnkNzZHOQWw/+bNdHCjcLDmhsphtLBajaqgsBLeIv5gAnJNWTOCzssbIEYbNjrFMZuQ2OjGL9Y22FhGyTn7RH2Po03ANyxtsPCNkjuVeA99l5HyqZSyQTWdvfaBoHXfBzj4VAIy3fssjBfVmq5+CV2utY90v/xHv+vAAMAxEX68QbHKZoAAAAASUVORK5CYII=" }, base),
iconRedSelectedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedVisitedThumbsDown: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedVisitedThumbsUp: _.assign({ iconUrl:"data:image/png;base64,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" }, base),
iconRedSelectedVisited: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAEgklEQVR4nL2XTWwUZRiAn/ebv27ZLNuCoMYohosHEzgYYwIHQop/Fy/ExIMHuVgSQliiF+KBeJHoATAKesJEkUQgKfEgyrCpRA5oC7ZpvZgmS0KN2O122/2dmd35PCzUrvvT2ab6XSYz7zvv8z7fz25GxsbG+K+HCfDpvqFfLZHkeheva33v4DV3twng63DH3i2D683g6v3cUyeH9m4zTw7t3bNBjOITA31xnQ/WDSBJi805u5YN/G0mkOy3jTgh6Jy3bhD6FAnbNLOBv0dZqBcGLQvt19fW8aCD2h5vDQSauGMyYFjbVNwwHrUNteaG+w+/RfyDT7BefKY5UNdsMk1KYX2nKoX1nZsdC6phzwDnwBDm8y8DEN6fbw7WQvocAwPiyhJJOtK7gdoep2//IQCq509Tn5hriutAN64QV77WSccxwettTWJvDzcanvoJ/8qdtjmPG4qqDreqQIcbNytB9zBb5q4nMZ/dDUDl88865olqTJFaeRN1OK+9DkAweolwptg+qVIDW/0DwVaNhyu7GHRIfPMFzoGhtha6mKd6eSRSUwrA8+sQM5sC9kvPIfEkffsP4byxq9XixkhnC4CY2agLqJiomaxXR6zmKfMu3KT65UcA9L35LsaOR5rWwvvO7dq9WELWq+OI+kMBt2YrPsSMlkTvwk1qP18FoP/IMZx9rzYsuq3FsonBbMVHwaiq6PBiplD1JWZCmw1Q/vgcuphHbX16+eCtuhZKkJhJplD1Kzq8qFJueqQUBHrOryFxsyVf5zyq508v30exkLjJXLVGKQh0yk2PKABL5IephRK0gQD4V+4QjF5qHLybN7pbAJKwmFosYYp8DQ/+Gas6PHy3UHnF35IwLduANr/I5Q+/WrU40NhVCjKL5Vod/T482MIpN52xNDOTC2VkoxWtWCeLAYvJfAVL5FbKTWeWIQAVHQ7/liuEfr/RcmYij5iJbymmc4VaVYfvPXy8DEm56VFT8/vkQhkZWJuNDFhMLpRRmumUmx5tgcCyTd23VO82Kyx8HR5ZGWqCpNz0qGim1mIjAxYTcyVsLddXWrRAAHwdHpnOFWq92MgGk4IB0/lCrazrw/+Ot0BSbnrU1nJ9Yr4U2UY2OYxniziirj/cUV0hAGVdH57MLVEwGl12BSQslnTIzGKJdhYdISk3nekX4/vxbBHZ5HSHJG3Gs0X6RH3bzqIjBBo2M4sllnSIJNpP20qLqg4Pd6rVEZJy0xlL1OXxbBFJ2l0tHFHnOll0hQAEOnwns1j229lIwmKpViezWPY9HR7tVqcrJOWmM7bI2bE/C802SpCkzY9/LWGLnE256fyaIQAVHR6/W6r4s14N2dgASdJm1quRLXt+RYfHV6uxKiTlpvO2yNnb8wVkwAZLIQmL2/OFSBaRINCwyZY9b7YSoB6LMVsJyJY9L4pFZEjKTecVcmo8W6hhCuPZQk0hp6JYRIYABIQn5ite/ZdsiYWqXwoIT0R9NzIk5abzlsjRiewiBhyLatETBODgNfeMgdw6eM0908t78n98x/8NKTwjRGEuzhYAAAAASUVORK5CYII=" }, base),
iconRedSelected: _.assign({ iconUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAApCAYAAADAk4LOAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABDBJREFUeNq8V0tsG0UY/md2vGunTpyXkwYVEYQ4IHGAC0KCQxGn9g6IihuXgqCgUkUCKh5FAoRKBVwKEhUnKiFAKlSigBQIQgkkXDikUitUpYJiJ85ra68fu96d4f/HTWrHa3ttAivZs5OZ+b/v+18TM6UU/NcPI5CXx9O/m4wP7rZxX6lrb6zkHtQgL6RH1KFbx3ddwdm/Vmi4XSDA/gEunDvG+pJq1d09F6UtmMhZftZ1JwXOB/stkYRAgcpVdk9GnwHDlikQZD/HWNw/ZpmgKkFvjMfiwO9ONS94ElKJGKSFOclThtgbN3jPhJPvvAipz74F87F7d0Yd9sYEFKR/D6eviYQJUOpeSeKlRyD28CH9Lq+tNC5WJfQlBAhgSXLXYJyxrgHIRYmn3tTvpVNT4M9mGtYVukuDo1juKjmYQEToMibJ10/UvLLwDbhnfg7dM2kYUJLBOHelTE1wDiqIXvmxg3eCuO+gfndefaV1Uhg1D/H6SeRYPPlMLYHOnQa5eD18U9EHiBs3QfSE/rgjNYcu/qKDG6ZC5deg9NGZaPGjr3IFAfaIhgXr8YeADYzq4MafO9Cs4uuPW6ugB+1puwSS5MaVbNkHZjbWSuX9C1A6eaRWvMc+APHALQ2xKH/6RfsiRXtkN8F5hizPLxWxZyVF00YCqk6frWXTyQ8h/ugTnWOxnX4CyK4BbIY7Mvj8kl30GLkrJAGcqbe0//m+u7YLr2Ms0A7ZI7tkn7+7un4u73kqg/5jA7Gm/dQ0qdi2W1IEFWQnU6oC2SX7OhBY9d/Pr+YBUrHQQ1RsZFwX3oXznZvmsAnz6wWIMaZ9rQOBVXnksu0ccPcNCZPSOaT6nWdPRSsidFMFqV/aKPh4M57YTmGUdNVU7MpcztEs/u1lNbdWJO/Mk92bxUgFKoPDv+U2pdsvmmom8oPnXIvDQm7TR+8cbyjGG2pmYor9odUgm55V4HlDwUWy1wRSpyYgNl2rqVNRkfL5prZSr4YrWOxFDe2fzeQhrvh0vYomEF3lyILYdKOG6sLGrQtrto837eHQBrlTDbGZXS5EVsPG4zCTvQ4JZkxvZVRbEHqIzdzKhmYX1gUaAIZM2FQSFtfzEKaiJQix6efiO2JHLNuCjFpaRR83zoepaAmypYbYEUti20kFdY22l1YrNRbnX2o1o1ZbFXhnfNJKRVsQ3RilPIY9yAtTo1VUA+pRXlnKox2v37ZqGD/94592oxq6L3D+1d8bQOu4z+4Z5EYXeO1ywfGWKlVgIzUgGmmedcoerUf6R6KDGpvY/rRs1+oG727q1DSPoiISyJYaZO0uFT3gt+0BGmkeRUVkEGKL/N+bydo+KaGR5lFURAbRd7uSby8Xy8EP2ARXS5UizSN3T/rNGPVzfCz99NHRYUVjN+e6AqHPVHrk127PsP/jd/w/AgwAtoGzEPyHsdUAAAAASUVORK5CYII=" }, base),
};
}]);;
app.factory('locationFactory', ['mappings', '$http', '$rootScope', '$filter', '$q', '$timeout', 'icons', 'log', 'awsUrlSigning', function (mappings, $http, $rootScope, $filter, $q, $timeout, icons, log, awsUrlSigning) {

    var _url = {
            all: window.location.hostname === '127.0.0.1' ? '/static/locations.0.1.0.p0.json' : '//cdn.croplands.org/json/locations.0.1.0.p0.json',
            default: window.location.hostname === '127.0.0.1' ? '/api/locations/' : '//api.croplands.org/api/locations/'
        },
        _lastGet,
        _cf = crossfilter(),
        l = {
            cf: {},
            markers: [],
            filters: {}
        };

    function updateSingleLocationInMarkers(data) {
        data = angular.copy(data);

        //Clear existing filters
        _.each(l.filters.list, function (filter) {
            l.cf.dims[filter.dim].filterAll();
        });

        // Filter by id
        l.cf.dims.id.filter(data.id);

        // Remove old results if they exist
        if (l.cf.dims.id.top(Infinity).length) {
            _cf.remove();
        }

        // Add to crossfilter
        _.map(data.records, function (record) {
            record.r = record.id;
            record.layer = 'locations';
            record.id = record.data_id;
            record.lat = data.lat;
            record.lon = data.lon;
            delete record.data_id;
            l.addIcon(record);
            return record;
        });

        log.info('Updated ' + data.records.length + ' record(s) for location #' + data.id, true);
        _cf.add(data.records);


        // Replace existing filters
        l.cf.dims.id.filterAll();
        _.each(l.filters.list, function (filter) {
            filter.func.apply(this, filter.arguments);
        });

        l.returnMarkers();


    }

    // Crossfilter Dimensions
    l.cf.dims = {
        id: _cf.dimension(function (d) {
            return d.id;
        }),
        year: _cf.dimension(function (d) {
            return d.year;
        }),
        cropland: _cf.dimension(function (d) {
            return $filter('mappings')(d.cropland, "cropland");
        }),
        crop: _cf.dimension(function (d) {
            return $filter('mappings')(d.crop_primary, "crop");
        }),
        water: _cf.dimension(function (d) {
            return $filter('mappings')(d.water, "water");
        }),
        intensity: _cf.dimension(function (d) {
            return $filter('mappings')(d.intensity, "intensity");
        }),
        spatial: _cf.dimension(function (d) {
            return {lat: d.lat, lon: d.lon};
        })
    };

    //Crossfilter Groups
    l.cf.groups = {
        id: l.cf.dims.id.group(),
        year: l.cf.dims.year.group(),
        cropland: l.cf.dims.cropland.group(),
        crop: l.cf.dims.crop.group(),
        water: l.cf.dims.water.group(),
        intensity: l.cf.dims.intensity.group()
    };

    // Filters
    l.filters.byPolygon = function (bounds, filterAll, echo) {
        // Filter markers from previous polygon or clear previous polygon and then filter
        if (filterAll === true || filterAll === undefined) {
            l.cf.dims.spatial.filterAll();
        }
        // Custom filter function
        l.cf.dims.spatial.filterFunction(function (d) {
            return  ((bounds.southWest.lng <= d.lon) &&
                (bounds.northEast.lng >= d.lon) &&
                (bounds.southWest.lat <= d.lat) &&
                (bounds.northEast.lat >= d.lat));
        });
        if (echo) {
            l.returnMarkers();
        }
    };
    l.filters.year = function (start, end, echo, save) {
        save = save === undefined ? true : save;
        if (save) {
            var args = [].slice.call(arguments);
            args[3] = false;
            l.filters.list.push({name: start, dim: 'year', func: l.filters.year, arguments: args});
        }

        end = end || start;
        l.cf.dims.year.filterRange([start, end + 1]);
        if (echo) {
            l.returnMarkers();
        }

    };

    l.filters.years = function (years) {
        l.cf.dims.year.filterFunction(function (d) {
            return years[d].selected;
        });
    };

    l.filters.cropland = function (cropland, echo) {
        // Takes an array of cropland using the land use integer number
        l.cf.dims.cropland.filterFunction(function (d) {
            return cropland[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };
    l.filters.crops = function (crops, echo) {
        // Takes an array of crops using the crops integer number
        l.cf.dims.crop.filterFunction(function (d) {
            return crops[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.intensity = function (intensity, echo) {
        // Takes an array of intensities using the intensity integer number
        l.cf.dims.intensity.filterFunction(function (d) {
            return intensity[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.water = function (water, echo) {
        // Takes an array of water use types using the integer number
        l.cf.dims.water.filterFunction(function (d) {
            return water[d].selected;
        });
        if (echo) {
            l.returnMarkers();
        }
    };

    l.filters.reset = function () {
        _.each(l.cf.dims, function (dim) {
            dim.filterAll();
        });
    };

    l.clearAll = function () {
        l.filters.reset();
        _cf.remove();
    };

    l.clear = function (dim) {
        l.cf.dims[dim].filterAll();
        _.remove(l.filters.list, function (filter) {
            return filter.dim === dim;
        });
        l.returnMarkers();
    };

    // Return filtered markers
    l.returnMarkers = function () {
        l.markers = l.cf.dims.year.top(10000);
        log.info('Markers Filtered');
        $rootScope.$broadcast("locationFactory.markers.filtered");

    };
    // Download All Markers
    l.getMarkers = function () {
        // Remove all existing locations
        l.clearAll();
        awsUrlSigning.getParams().then(function (params) {
            var file0 = $http({method: 'GET', url: '//cdn.croplands.org/json/locations.0.1.0.p0.json' + params, transformRequest: function (data, headersGetter) {
                var headers = headersGetter();
                delete headers['authorization'];
                return headers;
            }}).
                success(function (data) {
                    l.addMarkers(data);
                });
            var file1 = $http({method: 'GET', url: '//cdn.croplands.org/json/locations.0.1.0.p1.json' + params, transformRequest: function (data, headersGetter) {
                var headers = headersGetter();
                delete headers['authorization'];
                return headers;
            }}).
                success(function (data) {
                    l.addMarkers(data);
                });
            var file2 = $http({method: 'GET', url: '//cdn.croplands.org/json/locations.0.1.0.p2.json' + params, transformRequest: function (data, headersGetter) {
                var headers = headersGetter();
                delete headers['authorization'];
                return headers;
            }}).
                success(function (data) {
                    l.addMarkers(data);
                });

            $q.all([file0, file1, file2]).then(function () {
                $rootScope.$broadcast("locationFactory.markers.downloaded");
                l.returnMarkers();
            }, function () {
                log.warn("Could not download locations.", true);
                l.returnMarkers();
            });
        }, function () {
            log.warn("Could not download locations.", true);
        });


    };

    l.addIcon = function (location) {
        if (location.cropland) {
            var iconString = "iconCropland";
            iconString += $filter('mappings')(location.intensity, "intensity");
            iconString += $filter('mappings')(location.water, "water");
            if (icons[iconString] === undefined) {
                log.error('No icon exists for class');
            }
            location.icon = icons[iconString];
        } else {
            location.icon = icons.iconNotCropland;
        }
    };


    l.addMarkers = function (data) {
        _.map(data, function (location) {

            //Take digits of integer and map to values
            location.year = Math.floor(location.v / Math.pow(10, 9));
            location.cropland = Math.floor(location.v / Math.pow(10, 6)) % 10;
            location.water = Math.floor(location.v / Math.pow(10, 1)) % 10;
            location.intensity = location.v % 10;
            location.crop_primary = Math.floor(location.v / Math.pow(10, 4)) % 100;

            l.addIcon(location);

            delete location.v;

            return location;
        });
        _cf.add(data);

    };

    // Download Single Marker with Details
    l.getSingleMarker = function (id, callback, attemptsRemaining) {
        l.changeMarkerIcon(id);

        $http({method: 'GET', url: _url.default + String(id)}).
            success(function (data, status, headers, config) {
                _.map(data.history, function (d) {
                    d.data = JSON.parse(d.data);
                });

                data.records = _.sortBy(data.records, function (record) {
                    var index = -(record.year * 100 + record.month);
                    return index;
                });

                updateSingleLocationInMarkers(data);
                callback(data);
            }).
            error(function (data, status, headers, config) {
                if (status === 500) {
                    log.warn('Error retrieving location');
                    $timeout(function () {
                        if (attemptsRemaining === undefined) {
                            attemptsRemaining = 3;
                        }
                        if (attemptsRemaining > 0) {
                            l.getSingleMarker(id, callback, attemptsRemaining);
                        }
                    }, 1000);
                }
                // called asynchronously if an error occurs
                // or server returns response with an error status.
            });
    };

    l.changeMarkerIcon = function (id) {
        l.cf.dims.id.filter(id);
        _.map(l.cf.dims.id.top(Infinity), function (record) {

            // Get existing marker type and append visited
            _.forOwn(icons, function (val, key) {
                if (record.icon === val) {
                    // If already marked visited
                    if (key.indexOf('Visited') > -1) {
                        return record;
                    }
                    if (icons[key + "Visited"]) {
                        record.icon = icons[key + "Visited"];
                    }
                    else {
                        log.warn("No visited marker exists for: " + key, true);
                    }
                    return record;
                }
            });

            return record;
        });
        l.cf.dims.id.filterAll();

    };

    l.getTotalRecordCount = function () {
        return _cf.size();
    };

    l.getFilteredRecordCount = function () {
        return l.cf.dims.year.top(Infinity).length;
    };

    l.save = function (location, callback) {
        var data = {}, method, id, url = '/api/locations', allowedFields = ['id', 'lat', 'lon', 'records'];

        data = angular.copy(location);
//        // Remove keys users cannot change

        _.each(Object.keys(data), function (key) {
            if (!_.contains(allowedFields, key)) {
                delete data[key];
            }
        });

        // Post or Patch
        if (data.id) {
            method = 'PATCH';
            id = data.id;
            url += "/" + id.toString();
        } else {
            method = 'POST';
        }

        // Modulo back if out of bounds
        data.lon = data.lon % 180;
        data.lat = data.lat % 90;

        // Send to Server
        $http({method: method, url: url, data: data}).
            success(function (data) {
                data.records = _.sortBy(data.records, function (record) {
                    var index = -(record.year * 100 + record.month);
                    return index;
                });
                updateSingleLocationInMarkers(data);
                callback(data);
            }).
            error(function (data, status) {
                callback(null);
            });
    };

    /*
     Returns a csv string of the currently filtered locations.
     */
    l.getCSV = function () {
        var records = l.cf.dims.year.top(Infinity);
        var csv = [
            ["location_id, record_id, lat, lon, year, cropland, water, intensity, crop_primary"]
        ];
        _.each(records, function (record) {
            var recordString = [record.id,
                record.r,
                record.lat,
                record.lon,
                record.year,
                mappings.cropland.choices[record.cropland].label,
                mappings.water.choices[record.water].label,
                mappings.intensity.choices[record.intensity].label,
                mappings.crop.choices[record.crop_primary].label
            ].join(",");
            csv.push(recordString);
        });
        return csv.join('\r\n');

    };
    return l;
}]);;
app.service('log', ['$log', '$timeout', function ($log, $timeout) {
    var _log = [];
    var _prefix = '[GFSAD] ';

    var save = function (message) {
        _log.push({date: Date.now(), message: message});
    };

    this.info = function (message, log) {
        $log.info(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.warn = function (message, log) {
        $log.warn(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.error = function (message, log) {
        $log.error(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.debug = function (message) {
        $log.debug(_prefix + message);
    };
    this.getLog = function () {
        return _log;
    };
}]);
;
app.factory('mapService', ['wmsLayers','leafletData', function (wmsLayers,leafletData) {
    var map = {
        allowedEvents: {
            map: {
                enable: ['moveend', 'click'],
                logic: 'emit'
            },
            marker: {
                enable: ['click'],
                logic: 'emit'
            }
        },
        bounds: {
            northEast: {
                lat: 90,
                lng: 180
            },
            southWest: {
                lat: -90,
                lng: -180
            }
        },
        center: {
            lat: 0,
            lng: 0,
            zoom: 2
        },
        layers: {
            baselayers: {
                googleHybrid: {
                    name: 'Satellite',
                    layerType: 'HYBRID',
                    type: 'google',
                    visible: true
                },
                googleTerrain: {
                    name: 'Terrain',
                    layerType: 'TERRAIN',
                    type: 'google',
                    visible: false
                },

                googleRoadmap: {
                    name: 'Streets',
                    layerType: 'ROADMAP',
                    type: 'google',
                    visible: false
                }
//                gee: {
//                    name: 'Test',
//                    type: 'xyz',
//                    url: 'https://earthengine.googleapis.com/map/aca34630891943bc330cb89289c2f184/{z}/{x}/{y}?token=692acc79df36e0c19c3d08791ffdcc98'
//                }
            },
            overlays: {
                gfsad1000v00: wmsLayers.gfsad1000v00,
                gfsad1000v10: wmsLayers.gfsad1000v10,
                locations: {
                    name: 'Locations',
                    type: 'markercluster',
                    visible: true,
                    layerOptions: {
                        showCoverageOnHover: false,
                        chunkedLoading: true,
                        disableClusteringAtZoom: 10,
                        removeOutsideVisibleBounds: true
                    }
                }

            }
        },
        paths: {
            selection: {
                opacity: 0.75,
                weight: 2,
                type: "rectangle",
                created: false,
                cropped: false,
                visible: false,
                dashArray: '3, 3',
                color: '#428bca',
                fillColor: 'rgba(150,200,255,0.9)',
                latlngs: [
                    {lat: 0, lng: 0},
                    {lat: 0, lng: 0}
                ]
            }
        },
        markers: []

    };

    map.zoom = function (lat, lon, zoom) {
        if (zoom) {
            map.center.zoom = zoom;
        }

        leafletData.getMap().then(function (theMap) {
                var bounds = theMap.getBounds();
                map.center.lng = lon;
                map.center.lat = lat + (bounds.getNorth() - bounds.getSouth())/ 4;
            });

        map.center.lat = lat;
        map.center.lng = lon;
        console.log(map.center);
    };
    map.zoomIn = function () {
        this.center.zoom += 1;
    };
    map.zoomOut = function () {
        this.center.zoom -= 1;
    };

    return map;
}])
;;

app.constant('mappings', {
    cropland: {'label': 'Cropland',
        'style': 'primary',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Not cropland is...'},
            {'id': 1, 'label': 'Cropland', 'description': 'Cropland is...'},
            {'id': 2, 'label': 'Forest', 'description': 'Forest is ...'},
            {'id': 3, 'label': 'Grassland', 'description': 'Desert is ...'},
            {'id': 4, 'label': 'Desert', 'description': 'Desert is ...'},
            {'id': 5, 'label': 'Urban', 'description': 'Urban is ...'}
        ]},

    water: {'label': 'Water Source',
        'style': 'danger',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'No irrigation specified...'},
            {'id': 1, 'label': 'Rainfed',
                'description': 'Rainfed is ...'},
            {'id': 2, 'label': 'Irrigated',
                'description': 'Irrigated is ...'}
        ]
    },
    intensity: {'label': 'Intensify of Cropping',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Single', 'description': 'Single is...'},
            {'id': 2, 'label': 'Double', 'description': 'Double is...'},
            {'id': 3, 'label': 'Triple', 'description': 'Triple is...'},
            {'id': 4, 'label': 'Continuous', 'description': 'Continuous is...'}
        ]
    },    source: {'label': 'Source of data',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Site Visit', 'description': 'Single is...'},
            {'id': 2, 'label': 'Satellite', 'description': 'Double is...'},
            {'id': 3, 'label': 'Third Party', 'description': 'Triple is...'},
            {'id': 4, 'label': 'Other', 'description': 'Continuous is...'}
        ]
    },
    confidence: {'label': 'Confidence',
        'style': 'success',
        'choices': [
            {'id': 0, 'label': 'Low', 'description': 'Continuous is...'},
            {'id': 1, 'label': 'Moderate', 'description': 'Single is...'},
            {'id': 2, 'label': 'High', 'description': 'Double is...'}
        ]
    },
    crop: {'label': 'Crop Type',
        'choices': [
            {'id': 0, 'label': 'Unknown', 'description': 'No crop type specified.'},
            {'id': 1, 'label': 'Wheat', 'description': ''},
            {'id': 2, 'label': 'Maize (Corn)', 'description': ''},
            {'id': 3, 'label': 'Rice', 'description': ''},
            {'id': 4, 'label': 'Barley', 'description': ''},
            {'id': 5, 'label': 'Soybeans', 'description': ''},
            {'id': 6, 'label': 'Pulses', 'description': ''},
            {'id': 7, 'label': 'Cotton', 'description': ''},
            {'id': 8, 'label': 'Potatoes', 'description': ''},
            {'id': 9, 'label': 'Alfalfa', 'description': ''},
            {'id': 10, 'label': 'Sorghum', 'description': ''},
            {'id': 11, 'label': 'Millet', 'description': ''},
            {'id': 12, 'label': 'Sunflower', 'description': ''},
            {'id': 13, 'label': 'Rye', 'description': ''},
            {'id': 14, 'label': 'Rapeseed or Canola', 'description': ''},
            {'id': 15, 'label': 'Sugarcane', 'description': ''},
            {'id': 16, 'label': 'Groundnuts or Peanuts', 'description': ''},
            {'id': 17, 'label': 'Cassava', 'description': ''},
            {'id': 18, 'label': 'Sugarbeets', 'description': ''},
            {'id': 19, 'label': 'Palm', 'description': ''},
            {'id': 20, 'label': 'Others', 'description': ''}
        ]
    },
    lat: {
        'label': 'Latitude'
    },
    long: {
        'label': 'Longitude'
    }

});;
app.factory('user', [ '$http', '$window', '$q', 'log', function ($http, $window, $q, log) {
    var _user = {};

    function getUser() {
        return _user;
    }

    function getHeader() {

    }

    function loadFromToken(token) {
        _user = JSON.parse($window.atob(token.split(".")[1]));
        _user.token = token;
        $window.localStorage.user = JSON.stringify(_user);
        $http.defaults.headers.common.authorization = 'bearer ' + _user.token;
    }

    function reloadUser() {
        var deferred = $q.defer();
        $http.get("/api/user").then(function (response) {
            console.log(response);
        }, function (error) {
            console.log(error);
        });
    }

    function isLoggedIn() {
        if (_user.expires && _user.token) {
            var secondsToExpiration = _user.expires - Math.floor((new Date).getTime() / 1000);
            console.log(secondsToExpiration);
            return secondsToExpiration > 300;
        }

        return false;
    }

    function changePassword(token, password) {
        var deferred = $q.defer();
        $http.post("/auth/reset", {
            token: token,
            password: password
        }).then(function (response) {
            deferred.resolve(true);
        }, function (error) {
            deferred.resolve(false);
        });
        return deferred.promise;
    }

    function login(email, password) {
        log.info("[User] Logging in...");

        var deferred = $q.defer(),
            data = {email: email, password: password},
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post("/auth/login", data, headers).then(function (r) {
                log.info("[User] Successfully logged in.");
                // Load user if token is present, may require confirmation before logging in
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function register(data) {
        var deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post("/auth/register", data, headers).then(function (r) {
                log.info("[User] Successfully registered.");
                // Load user if token is present, may require confirmation before logging in
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function forgot(email) {
        var data = {email: email},
            deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post("/auth/forgot", data, headers).then(function (r) {
                log.info("[User] Sending reset email.");
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function reset(password, token) {
        var data = {password: password, token: token},
            deferred = $q.defer(),
            headers = { Accept: 'application/json', 'Content-Type': 'application/json'};

        $http.post("/auth/reset", data, headers).then(function (r) {
                log.info("[User] Changing password.");
                if (r.data.data.token) {
                    loadFromToken(r.data.data.token);
                }
                deferred.resolve(r.data);
            },
            function (r) {
                if (r.data) {
                    deferred.reject(r.data);
                }
                else {
                    deferred.reject();
                }
            }
        );

        return deferred.promise;
    }

    function logout() {
        log.info("[User] Removing user token.");

        if ($window.localStorage.user) {
            $window.localStorage.removeItem('user');
        }

        _user = {};
        delete $http.defaults.headers.common.authorization;
    }

    function getFromStorage() {
        var user = JSON.parse($window.localStorage.user);
        loadFromToken(user.token);
    }

    // initialization
    function init() {
        // Check if user information is available in local storage
        log.info('Checking for existence of user token.');
        if ($window.localStorage.user) {
            getFromStorage();

        }

        // Watch for changes to other tabs
        angular.element($window).on('storage', function (event) {
            if (event.key === 'user') {
                getFromStorage();
            } else {
                _user = {};
            }
        });
    }

    init();


    return {
        changePassword: changePassword,
        isLoggedIn: isLoggedIn,
        login: login,
        logout: logout,
        register: register,
        forgot: forgot,
        reset: reset
    };

}]);;
// current application version
app.constant('version', '0.1.0');
;
app.value('wmsLayers', {
    gfsad1000v00: {
        name: 'Global Cropland Extent (GCE) 1km Crop Dominance',
        type: 'wms',
        url: 'https://mapsengine.google.com:443/10477185495164119823-00161330875310406093-4/wms/',
        visible: false,
        infoVisible: false,
        layerOptions: {
            layers: '10477185495164119823-00161330875310406093-4,10477185495164119823-10559428504955428209-4',
            format: 'image/png',
            minZoom: 0,
            opacity: 0.7,
            attribution: '<a href="https://powellcenter.usgs.gov/globalcroplandwater/sites/default/files/August%20HLA-final-1q-high-res.pdf">Thenkabail et al., 2012</a>'

        },
        legendVisible: false,
        legend: [
            {label: 'Irrigated: Wheat and Rice Dominant', color: '#0000FF'},
            {label: 'Irrigated: Mixed Crops 1: Wheat, Rice, Barley, Soybeans', color: '#A020EF'},
            {label: 'Irrigated: Mixed Crops 2: Corn, Wheat, Rice, Cotton, Orchards', color: '#FF00FF'},
            {label: 'Rainfed: Wheat, Rice, Soybeans, Sugarcane, Corn, Cassava', color: '#00FFFF'},
            {label: 'Rainfed: Wheat and Barley Dominant', color: '#FFFF00'},
            {label: 'Rainfed: Corn and Soybeans Dominant', color: '#007A0B'},
            {label: 'Rainfed: Mixed Crops 1: Wheat, Corn, Rice, Barley, Soybeans', color: '#00FF00'},
            {label: 'Minor Fractions of Mixed Crops: Wheat, Maize, Rice, Barley, Soybeans', color: '#505012'},
            {label: 'Other Classes', color: '#B2B2B2'}
        ]
    },
    gfsad1000v10: {
        name: 'Global Cropland Extent (GCE) 1km Multi-study Crop Mask',
        type: 'wms',
        url: 'https://mapsengine.google.com:443/10477185495164119823-00161330875310406093-4/wms/',
        visible: false,
        infoVisible: false,
        layerOptions: {
            layers: '10477185495164119823-00161330875310406093-4,10477185495164119823-16382460135717964770-4',
            format: 'image/png',
            minZoom: 0,
            opacity: 0.7,
            attribution: '<a href="http://geography.wr.usgs.gov/science/croplands/docs/Global-cropland-extent-V10-teluguntla-thenkabail-xiong.pdf">Teluguntla et al., 2015</a>'
        },
        legendVisible: false,
        legend: [
            {label: 'Croplands, Irrigation major', color: '#FF00FF'},
            {label: 'Croplands, Irrigation minor', color: '#00FF00'},
            {label: 'Croplands, Rainfed', color: '#FFFF00'},
            {label: 'Croplands, Rainfed minor fragments', color: '#00FFFF'},
            {label: 'Croplands, Rainfed very minor fragments', color: '#D2B58C'}

        ]
    }
});;
app.filter('mappings', ['mappings', function (mappings) {
    return function (key, field) {
        key = key || 0;
        return mappings[field].choices[key].label;
    };
}]);;
app.filter('monthName', [function () {
    return function (monthNumber) { //1 = January
        var monthNames = [ 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December' ];
        return monthNames[monthNumber - 1];
    };
}]);;
app.filter('prepend', [function () {
    return function (key, field) {
        return field + key;
    };
}]);;
app.filter('unsafe', ['$sce', function($sce) {
    return function(val) {
        return $sce.trustAsHtml(val);
    };
}]);;
app.controller("accountFormCtrl", ['$location', '$scope', 'log', '$window', function ($location, $scope, log, $window) {
    var path = $location.path().split('/');
console.log(path);
    if (path[1] === 'account' && path[1]) {
        $scope.$emit('user.' + path[2], true);
    } else {
        $window.location.href = '/';
    }

}]);;
app.controller("dashboardCtrl", ['$scope', 'user','$timeout', function ($scope, user, $timeout) {

    $scope.login = function () {
        user.login('justin.poehnelt@gmail.com', '7o7.4$Ya').then(function () {
            $timeout(function () { user.getUser(); },100);
            $timeout(function () { user.getUser(); },90000);
            $timeout(function () { user.getUser(); },150000);
            $timeout(function () { user.getUser(); },500000);
        });
    };

    $scope.login();
}]);;
app.controller("mapCtrl", ['$scope', 'mapService', 'locationFactory', 'leafletData', '$timeout', '$window', '$location', 'mappings', 'log', function ($scope, mapService, locationFactory, leafletData, $timeout, $window, $location, mappings, log) {
    var selectionAreaMouseDownSubscription,
        selectionAreaClickSubscription,
        selectionAreaMousemoveSubscription;

    $location.moveCenter = function (lat, lng, zoom) {
        this.search(_.merge(this.search(), {lat: Math.round(lat * Math.pow(10, 5)) / Math.pow(10, 5), lng: lng, zoom: zoom}));
    };

    $location.setId = function (id) {
        this.search(_.merge(this.search(), {id: id}));
    };

    $location.removeId = function () {
        this.search(_.omit(this.search(), 'id'));
    };

    $location.getId = function () {
        return parseInt(_.pluck(this.search(), 'id'), 10);
    };

    $location.getCenter = function () {
        var parameters = this.search();
        if (parameters.lat && parameters.lng && parameters.zoom) {
            return {lat: parseFloat(parameters.lat),
                lng: parseFloat(parameters.lng),
                zoom: parseInt(parameters.zoom, 10)
            };
        }
    };

    ///////////
    // Utils //
    ///////////
    function disableMapDragging() {
        leafletData.getMap().then(function (map) {
            map.dragging.disable();
        });
    }

    function enableMapDragging() {
        leafletData.getMap().then(function (map) {
            map.dragging.enable();
        });
    }

    function stopPropagation(e) {
        L.DomEvent.stopPropagation(e);
    }


///////////////////////
// Listen for Events //
///////////////////////

    $scope.$on("locationFactory.markers.filtered", function () {
        log.info('Mapping ' + locationFactory.getFilteredRecordCount() + ' Locations', true);

        $scope.markers = locationFactory.markers;

        $scope.busy = false;
        $timeout(function () {
            $scope.busyDialogVisible = false;
        }, 10000);
    });
    $scope.$on("locationFactory.markers.downloaded", function () {
        log.info('Finished downloading location data.', true);
    });

    $scope.$on("locationFactory.markers.error", function () {
        log.info('Error downloading location data. Trying again...', true);
        $timeout(function () {
            locationFactory.getMarkers();
        }, 2000);
    });

    $scope.$watch(function () {
        return mapService.center;
    }, function (center) {
        $scope.center = center;
    }, true);

    $scope.$on('leafletDirectiveMarker.click', function (e, args) {
        // Args will contain the marker name and other relevant information
        $scope.loadMarker($scope.markers[args.markerName]);
    });

    $scope.$watch('center', function (center) {
        $location.moveCenter(center.lat, center.lng, center.zoom);

        // If marker is no longer contained in bounds of map, drop from url parameters.
        if ($scope.location.id && $scope.location.lat && $scope.location.lon) {
            leafletData.getMap().then(function (map) {
                if (!map.getBounds().contains(L.latLng($scope.location.lat, $scope.location.lon))) {
                    // remove open marker since no long displayed
                    $location.removeId();
                    delete $scope.location.id;
                    $scope.location.visible = false;
                }
            });
        } else {
            $location.removeId();
            delete $scope.location.id;
            $scope.location.visible = false;
        }
    });

    $scope.$watch('location', function (location) {
        if (location.visible && location.id > 1) {
            $location.setId(location.id);
        }
        else {
            $location.removeId();
        }
    }, true);

    $scope.$watch('busy', function () {
        if ($scope.busy) {
            $scope.busyDialogVisible = true;
        }
    });

    $scope.$on('location.record.edit.open', function (e, record) {
        $scope.record = record;


        // if coming from location panel, won't have lat/lon since that is not part of the
        // underlying data that gets downloaded
        if (record.lat && record.lon) {
            mapService.zoom(record.lat, record.lon, 15);
            console.log(mapService.center);
        }
        $timeout(function () {
            $scope.showRecordEditForm = true;
        }, 200);
        $scope.$broadcast('location.record.edit.close', record);

    });
    $scope.closeRecordEditForm = function () {
        $scope.showRecordEditForm = false;
        $scope.$broadcast('location.record.edit.close');
    };
///////////////////////
// Button Actions    //
///////////////////////
    $scope.selectArea = function (e) {

        // put selection back to 0,0
        $scope.paths.selection.latlngs[0] = {lat: 0, lng: 0};
        $scope.paths.selection.latlngs[1] = {lat: 0, lng: 0};

        // no selection has been created and no filtering of markers
        $scope.paths.selection.created = false;
        $scope.paths.selection.cropped = false;


        // toggle selection area control
        $scope.selectionAreaActive = !$scope.selectionAreaActive;

        // if selection active
        if ($scope.selectionAreaActive) {
            // get first corner
            selectionAreaMouseDownSubscription = $scope.$on('leafletDirectiveMap.mousedown', function (e, args) {
                disableMapDragging();

                $scope.paths.selection.latlngs[0] = {
                    lat: args.leafletEvent.latlng.lat,
                    lng: args.leafletEvent.latlng.lng };
                $scope.paths.selection.latlngs[1] = {
                    lat: args.leafletEvent.latlng.lat,
                    lng: args.leafletEvent.latlng.lng };

                // remove mousedown event listener
                selectionAreaMouseDownSubscription();
                // adjust selection mouse moves
                selectionAreaMousemoveSubscription = $scope.$on('leafletDirectiveMap.mousemove', function (e, args) {

                    $scope.paths.selection.latlngs[1] = {
                        lat: args.leafletEvent.latlng.lat,
                        lng: args.leafletEvent.latlng.lng };
                });
            });

            // capture second corner
            selectionAreaClickSubscription = $scope.$on('leafletDirectiveMap.click', function (e, args) {
                selectionAreaClickSubscription();
                if (selectionAreaMousemoveSubscription) {
                    selectionAreaMousemoveSubscription();
                }

                enableMapDragging();

                $scope.paths.selection.latlngs[1] = {
                    lat: args.leafletEvent.latlng.lat,
                    lng: args.leafletEvent.latlng.lng };
                $scope.paths.selection.created = true;
                $scope.selectionAreaActive = !$scope.selectionAreaActive;
            });


        }
    };

    $scope.filterBySelection = function (e) {

        $scope.busy = true;

        log.info('Filtering ' + locationFactory.getTotalRecordCount().toLocaleString() + ' Records', true);
        $timeout(function () {
            var bounds = {}, rect = $scope.paths.selection.latlngs;
            bounds.southWest = { lat: Math.min(rect[0].lat, rect[1].lat), lng: Math.min(rect[0].lng, rect[1].lng)};
            bounds.northEast = { lat: Math.max(rect[0].lat, rect[1].lat), lng: Math.max(rect[0].lng, rect[1].lng)};
            locationFactory.filters.byPolygon(bounds, true, true);
            // put selection back to 0,0
            $scope.paths.selection.latlngs[0] = {lat: 0, lng: 0};
            $scope.paths.selection.latlngs[1] = {lat: 0, lng: 0};

            // no selection has been created and no filtering of markers
            $scope.paths.selection.created = false;
            $scope.paths.selection.cropped = false;
        }, 200);


    };


    $scope.changeBaseLayer = function (key) {
        leafletData.getMap().then(function (map) {
            leafletData.getLayers().then(function (layers) {
                _.each(layers.baselayers, function (layer) {
                    map.removeLayer(layer);
                });
                map.addLayer(layers.baselayers[key]);
            });
        });


    };
    $scope.toggleLayerInfo = function (layer, e) {
        e.preventDefault();
        stopPropagation(e);
        layer.infoVisible = !layer.infoVisible;
    };

    $scope.zoomExtent = function () {
        mapService.center.lat = 0;
        mapService.center.lng = 0;
        mapService.center.zoom = 2;
    };
    $scope.refreshLocations = function () {
        log.info('Loading Location Data', true);
        $scope.busy = true;

        locationFactory.getMarkers();
    };


    $scope.loadMarker = function (m) {
        log.info("Loading Marker, ID: " + m.id, true);
        // Save marker location
        $scope.location = _.clone(m, true);
        $scope.location.visible = true;

        // Save id in url parameter
        $location.setId($scope.location.id);

        // Call function to move to marker
        $scope.goToMarker(m);
    };


    $scope.goToMarker = function (m, e, ignoreBounds) {
        if (ignoreBounds) {
            // Zoom in if not already
            if (mapService.center.zoom < 13) {
                mapService.center.lat = m.lat;
                mapService.center.lng = m.lon;
                mapService.center.zoom = 16;
            } else {
                mapService.center.zoom += 1;
            }

        } else {
            // Pan map if marker not within bounds of map
            leafletData.getMap().then(function (map) {
                if (!map.getBounds().contains(L.latLng(m.lat, m.lon))) {
                    mapService.center.lat = m.lat;
                    mapService.center.lng = m.lon;
                }
            });
        }
    };


    $scope.resetGroundData = function () {
        log.info('Clearing Selection on Locations', true);
        $scope.busy = true;
        locationFactory.cf.dims.spatial.filterAll();
        locationFactory.returnMarkers();

    };

    $scope.downloadLocations = function () {
        var blob = new Blob([locationFactory.getCSV()], {type: "data:application/csv;charset=utf-8", endings: 'native'});
        var filename = "GFSAD-Locations-" + Math.round(new Date() / 1000) + ".csv";
        saveAs(blob, filename);
    };

    $scope.print = function () {
        window.print();
    };

    $scope.addLocation = function (e) {
        $scope.addLocationActive = true;
        var mapClickSubscription = $scope.$on('leafletDirectiveMap.click', function (e, args) {
            mapClickSubscription();
            $scope.loadMarker({lat: args.leafletEvent.latlng.lat, lon: args.leafletEvent.latlng.lng, id: 1});
            $scope.addLocationActive = false;
        });
    };

// Add to scope
    $scope.disableMapDragging = disableMapDragging;
    $scope.enableMapDragging = enableMapDragging;
    $scope.stopPropagation = stopPropagation;


//////////
// Init //
//////////

    function init() {
        var defaults = {
            tableOfContentsVisible: true,
            selectionAreaActive: false,
            addLocationActive: false,
            showHelp: false,
            showDownloadModal: false,
            busy: false,
            busyDialogVisible: false,
            mappings: mappings,
            location: {
                visible: false
            },
            filters: {
                visible: true,
                activeFilters: {}
            },
            table: {
                visible: false
            },
            events: {
                map: {
                    enable: ['mousedown', 'mousemove', 'click'],
                    logic: 'emit'
                },
                marker: {
                    enable: ['click'],
                    logic: 'emit'
                }
            },
            markers: [],
            center: mapService.center,
            paths: mapService.paths,
            layers: mapService.layers
        };

        // Load Url Parameters if Found
        var center = $location.getCenter();
        if (center.lat) {
            mapService.center.lat = center.lat;
        }
        if (center.lng) {
            mapService.center.lng = center.lng;
        }
        if (center.zoom) {
            mapService.center.zoom = center.zoom;
        }


        if ($location.getId()) {
            defaults.location.id = $location.getId();
            defaults.location.visible = true;
        }


        // See if browser can download files
        if (!!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/)) {
            defaults.canDownloadFiles = false;
        } else {
            try {
                defaults.canDownloadFiles = !!new Blob;
            } catch (e) {
                defaults.canDownloadFiles = false;
            }
        }

        // Apply defaults
        angular.extend($scope, defaults);

        // Get Locations
        $scope.refreshLocations();

    }

    init();

}]);;
app.controller("masterCtrl", ['$timeout', '$scope', 'user', 'log', '$location', '$window', function ($timeout, $scope, user, log, $location, $window) {
    $scope.login = false;
    $scope.register = false;
    $scope.forgot = false;


    function changeView(target) {
        var path = $location.path().split('/');
        if (path[1] === 'account' && path[2] !== target) {
            $window.location.href = '/account/' + target;
            return;
        }
        $scope[target] = !$scope[target];
    }

    $scope.goToLogin = function () {
        changeView('login');
    };

    $scope.isLoggedIn = function () {
        return user.isLoggedIn();
    };

    $scope.$on('user.login', function (event, show) {
        if (show) {
            changeView('login');
        } else {
            $scope.login = false;
        }

    });

    $scope.$on('user.register', function (event, show) {
        if (show) {
            changeView('register');
        } else {
            $scope.register = false;
        }
    });

    $scope.$on('user.forgot', function (event, show) {
        if (show) {
            changeView('forgot');
        } else {
            $scope.forgot = false;
        }
    });

    $scope.logout = function () {
        user.logout();
    };


}

])
;;
app.controller("notificationsCtrl", ['$scope', function ($scope) {
    console.log('hello');
}]);;
app.controller("profileCtrl", ['$scope', function ($scope) {
    console.log('hello');
}]);;
app.controller("resetCtrl", ['$location', '$scope', 'log','$window', function ($location, $scope, log, $window) {
    $scope.token = $location.search().token;

    if ($scope.token === undefined) {
        log.warn('Token not found');
        $window.location.href = '/';
    }
}]);;
app.controller("scoreCtrl", ['$scope', function ($scope) {
    console.log('hello');
}]);;
app.directive('account', ['version', '$location', function (version, $location) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {
            console.log($location.path());

            scope.isActive = function (route) {
                return route === $location.path();
            };
        },
        templateUrl: '/static/templates/account-menu.' + version + '.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/account-menu.' + version + '.html'
    };
}]);;
app.directive('blur', [function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            element.on('click', function () {
                element.blur();
            });
        }
    };
}]);;
app.directive('forgotForm', ['user', 'log', '$timeout', function (user, log, $timeout) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
            }

            scope.forgot = function () {
                scope.login.busy = true;
                user.forgot(scope.email).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.email = '';
                }, function (response) {
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    scope.busy = false;
                });
            };

            scope.login = function () {
                scope.$emit('user.forgot', false);
                scope.$emit('user.login', true);
            };

            scope.register = function () {
                scope.$emit('user.forgot', false);
                scope.$emit('user.register', true);
            };

            scope.close = function () {
                scope.$emit('user.forgot', false);
            };
        },
        templateUrl: '/static/templates/directives/forgot.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/forgot.html'
    };

}]);;
app.directive('gfsadFilter', ['version', 'locationFactory', 'log', '$q', '$timeout', 'mappings', function (version, locationFactory, log, $q, $timeout, mappings) {
    function reset(scope, callback) {
        log.info("Resetting Filters");

        _.each(scope.years, function (year) {
            year.selected = year.label === 2014;
        });

        _.each(scope.cropland, function (cropland) {
            cropland.selected = true;
        });

        _.each(scope.crops, function (crop) {
            crop.selected = true;
        });

        _.each(scope.intensity, function (intensity) {
            intensity.selected = true;
        });

        _.each(scope.water, function (water) {
            water.selected = true;
        });
        if (callback) {
            callback();
        }
    }

    function getSelectedFieldValues(field) {
        return _.pluck(_.where(field, {selected: true}), 'id');
    }

    function apply(scope) {
        log.info("Filtering Locations");

        scope.$parent.busy = true;
        $timeout(function () {
            locationFactory.cf.dims.year.filterAll();
            locationFactory.cf.dims.cropland.filterAll();
            locationFactory.cf.dims.crop.filterAll();
            locationFactory.cf.dims.intensity.filterAll();
            locationFactory.cf.dims.water.filterAll();

            scope.activeFilters = {
                years: getSelectedFieldValues(scope.years),
                cropland: getSelectedFieldValues(scope.cropland),
                crops: getSelectedFieldValues(scope.crops),
                intensity: getSelectedFieldValues(scope.intensity),
                water: getSelectedFieldValues(scope.water)
            };

            locationFactory.filters.years(_.indexBy(scope.years, 'label'));
            locationFactory.filters.cropland(_.indexBy(scope.cropland, 'label'));
            locationFactory.filters.crops(_.indexBy(scope.crops, 'label'));
            locationFactory.filters.intensity(_.indexBy(scope.intensity, 'label'));
            locationFactory.filters.water(_.indexBy(scope.water, 'label'));

            locationFactory.returnMarkers();

        }, 100);
    }


    return {
        restrict: 'EA',
        scope: {
            visible: '=visible',
            activeFilters: '=activeFilters'
        },
        link: function (scope) {
            scope.cropland = angular.copy(mappings.cropland.choices);
            scope.crops = angular.copy(mappings.crop.choices);
            scope.intensity = angular.copy(mappings.intensity.choices);
            scope.water = angular.copy(mappings.water.choices);
            scope.years = [];

            var currentYear = new Date().getFullYear();
            for (var i = 2000; i < currentYear + 1; i++) {
                scope.years.push({label: i, id: i});
            }


            // Listeners
            scope.$on("locationFactory.markers.filtered", function () {
                scope.countAll = locationFactory.getTotalRecordCount();
                scope.countFiltered = locationFactory.getFilteredRecordCount();
                scope.filters = locationFactory.filters.list;
            });

            scope.$on("locationFactory.markers.downloaded", function () {
                apply(scope);
            });

            // Scope Methods
            scope.reset = function () {
                reset(scope);
            };
            scope.apply = function () {
                apply(scope);
            };

            scope.allOptionsAreSelected = function (field) {
                if (field === undefined) {
                    return false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    if (!scope[field][i].selected) {
                        return false;
                    }
                }
                return true;
            };

            scope.toggleAllOptions = function (field) {
                var selected = true;
                if (scope.allOptionsAreSelected(field)) {
                    selected = false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    scope[field][i].selected = selected;
                }
            };

            // Initialized Default Filters
            reset(scope, function () {
                log.info("Applying filters to locations", true);
                apply(scope);
            });
        },
        templateUrl: '/static/templates/control.' + version + '.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/control.' + version + '.html'
    };

}]);;
app.directive('legend', ['version', function (version) {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
//        templateUrl: '/static/templates/legend.' + version + '.html'
        templateUrl: 'http://cache.croplands.org/static/templates/legend.' + version + '.html'
    };
}]);;
app.directive('locationRecord', ['mapService', function (mapService) {
    return {
        restrict: 'EA',
        scope: {
            record: '=record',
            showZoom: '=showZoom'
        },
        link: function (scope) {
            // do nothing
            scope.edit = function () {
                scope.$emit('location.record.edit.open', scope.record);
                scope.showEditForm = true;
            };
            scope.$on('location.record.edit.close', function (record) {
                if (record.id !== scope.record.id) {
                    scope.showEditForm = false;
                }
            });
            scope.zoom = function () {
                if (scope.record.lat && scope.record.lon) {
                    mapService.zoom(scope.record.lat, scope.recod.lon, 16);
                }
            };

            scope.thumbsUp = function () {
                console.log(scope.record);
            };
            scope.thumbsDown = function () {
                console.log(scope.record);
            };

        },
        templateUrl: '/static/templates/directives/location-record.html'
//        templateUrl: '/static/templates/directives/location-record.html'
    };
}]);;
app.directive('locationRecordEditForm', ['locationFactory', 'mappings', 'user', function (locationFactory, mappings, user) {
    return {
        restrict: 'EA',
        scope: {
            record: '=record'
        },
        link: function (scope) {
            // Build the options
            scope.landUseTypes = angular.copy(mappings.cropland.choices);
            scope.cropsPrimary = angular.copy(mappings.crop.choices);
            scope.cropsSecondary = angular.copy(mappings.crop.choices);
            scope.intensity = angular.copy(mappings.intensity.choices);
            scope.water = angular.copy(mappings.water.choices);
            scope.sources = angular.copy(mappings.source.choices);
            scope.confidence = angular.copy(mappings.confidence.choices);
            scope.years = [];

            var currentYear = new Date().getFullYear();
            for (var i = 2000; i < currentYear + 1; i++) {
                scope.years.push({label: i, id: i});
            }

            scope.canEdit = function () {
                if (scope.record.id === undefined) {
                    return true;
                }

                if (user.isLoggedIn()) {
                    return true;
                }
                return false;
            };


            scope.getRecordValues = function () {
                console.log(scope.record);
                // Select Options Based on Record

                scope.selectFieldValue(scope.landUseTypes, scope.record.cropland);
                scope.selectFieldValue(scope.cropsPrimary, scope.record.crop_primary);
                scope.selectFieldValue(scope.cropsSecondary, scope.record.crop_secondary);
                scope.selectFieldValue(scope.intensity, scope.record.intensity);
                scope.selectFieldValue(scope.water, scope.record.water);
                scope.selectFieldValue(scope.years, scope.record.year);

            };

            // Click Functions
            scope.selectFieldValue = function (field, id) {
                _.each(field, function (item) {

                    item.selected = (item.id === id);
                })
            };

            scope.$watch('record', function (record) {
                if (record !== undefined) {
                    scope.getRecordValues();
                }
            })

        },
        templateUrl: '/static/templates/directives/location-record-edit-form.html'
//        templateUrl: '/static/templates/directives/location-record-edit-form.html'
    };
}]);;
app.directive('locationRecordList', ['$window', function ($window) {
    return {
        restrict: 'EA',
        scope: {
            records: '=records',
            page: '=page',
            pageSize: '=pageSize',
            showZoom: '=showZoom'
        },
        link: function (scope) {
            scope.pagedRecords = [];
            if (scope.page === undefined) {
                scope.page = 0;
            }

            if (scope.showZoom === undefined) {
                scope.showZoom = false;
            }

            if (scope.pageSize === undefined) {
                if ($window.screen.height) {
                    scope.pageSize = Math.max(Math.floor(($window.screen.height - 800) / 30), 5);
                } else {
                    scope.pageSize = 8;
                }
            }


            scope.makePages = function () {
                scope.pagedRecords = [];
                if (!scope.records || !scope.records.length){
                    return;
                }
                for (var i = 0; i < scope.records.length; i++) {
                    // Build array if page is empty
                    if (i % scope.pageSize === 0) {
                        scope.pagedRecords[Math.floor(i / scope.pageSize)] = [ scope.records[i] ];
                    } else { // append to existing page
                        scope.pagedRecords[Math.floor(i / scope.pageSize)].push(scope.records[i]);
                    }
                }
            };

            scope.range = function (start, end) {
                var ret = [];
                if (!end) {
                    end = start;
                    start = 0;
                }
                for (var i = start; i < end; i++) {
                    ret.push(i);
                }
                return ret;
            };

            scope.setPage = function (page) {
                if (page !== undefined) {
                    scope.page = page;
                }
            };

            scope.previous = function () {
                if (scope.page > 0) {
                    scope.page--;
                }
            };

            scope.next = function () {
                if (scope.pagedRecords.length > scope.page + 1) {
                    scope.page++;
                }
            };

            scope.$watch('records', function () {
                scope.makePages();
            });

        },
        templateUrl: '/static/templates/directives/location-record-list.html'
//        templateUrl: '/static/templates/directives/location-record-list.html'
    };
}]);;
app.directive('log', ['log', 'version', function (log, version) {
    return {
        link: function (scope) {
            scope.list = log.getLog();
            scope.$watch(function () {
                return log.getLog();
            }, function (val) {
                scope.list = val;
            }, true);
        },
        templateUrl: '/static/templates/log.' + version + '.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/log.' + version + '.html'
    };
}]);
;
app.directive('loginForm', ['user', 'log', '$timeout', function (user, log, $timeout) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
                $timeout(function () {
                    scope.success = '';
                    scope.message = '';
                }, 4000);
            }

            scope.login = function (valid) {
                scope.login.busy = true;
                if (!valid) {
                    setMessage('Invalid Data', false);
                    return;
                }
                user.login(scope.email, scope.password).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.$emit('user.login', false);
                    scope.email = '';
                    scope.password = '';
                }, function (response) {
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    scope.busy = false;
                });
            };

            scope.forgot = function () {
                scope.$emit('user.login', false);
                scope.$emit('user.forgot', true);
            };

            scope.register = function () {
                scope.$emit('user.login', false);
                scope.$emit('user.register', true);
            };

            scope.loginClose = function () {
                scope.$emit('user.login', false);
            };
        },
        templateUrl: '/static/templates/directives/login.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/login.html'
    };

}]);;
app.directive('ndvi', ['version', '$http', '$log','$q', function (version, $http, $log, $q) {
    var URL = 'http://api.croplands.org/gee/time_series',
        series = {};
    var canceller = $q.defer();

    var colors = {
        2000: "#1f77b4",
        2001: "#aec7e8",
        2002: "#ff7f0e",
        2003: "#ffbb78",
        2004: "#2ca02c",
        2005: "#98df8a",
        2006: "#d62728",
        2007: "#ff9896",
        2008: "#9467bd",
        2009: "#c5b0d5",
        2010: "#8c564b",
        2011: "#c49c94",
        2012: "#e377c2",
        2013: "#f7b6d2",
        2014: "#7f7f7f",
        2015: "#c7c7c7",
        2016: "#bcbd22",
        2017: "#dbdb8d",
        2018: "#17becf",
        2019: "#9edae5"
    };

    function hashISODate(date_str) {
        // returns year and a period of the year where each month is divided into three parts with a 0 index
        var year = parseInt(date_str.substring(0, 4), 10),
            month = parseInt(date_str.substring(5, 7), 10) - 1,
            day = parseInt(date_str.substring(8, 10), 10),
            period;

        period = month * 3 + Math.min(2, parseInt(day / 10, 10)); // 3*[0-12] + [0-2]
        return [year, period];
    }

    function queryData(lat, lon, scope) {
        scope.ndviBusy = true;
        // reset series
        series = {};

        // add parameters to url
        var _url = URL + '?';
        if (lat) {
            _url += 'lat=' + String(lat) + '&';
        }
        if (lon) {
            _url += 'lon=' + String(lon) + '&';
        }
        _url += 'date_start=2012-01-01&';

        $http({method: 'GET', url: _url, timeout: canceller}).
            success(function (data) {
                series = {};
                _.each(data.results, function (item) {
                    var hash = hashISODate(item.date);
                    // if year not in series
                    if (series[hash[0]] === undefined) {
                        series[hash[0]] = {
                            points: '',
                            active: '',
                            color: colors[hash[0]]
                        };
                    }
                    // append data point to year series
                    if (item.hasOwnProperty('ndvi')) {
                        series[hash[0]].points += (String((hash[1] * 10) + 40) + "," + String(Math.abs(205 - (item.ndvi / 10000 * 210)))) + " ";
                    }
                });
                scope.series = series;
                scope.ndviBusy = false;
            }
        );
    }

    return {
        restrict: 'E',
        scope: {
            lat: '=lat',
            lon: '=lon'
        },
        link: function (scope) {
            scope.$watch(function () {
                return [scope.lat, scope.lon];
            }, function (pt) {
                if (pt[0] && pt[1]) {
                    canceller.resolve("new location");
                    queryData(pt[0], pt[1], scope);
                }
            }, true);


            scope.activate = function (year) {
                _.forOwn(scope.series, function (y, k) {
                    if (k === year) {
                        y.class = 'active';
                    } else {
                        y.class = 'inactive';
                    }
                });
            };

            scope.deactivate = function () {
                _.forOwn(scope.series, function (y) {
                    y.class = '';
                });
            };

        },
        templateUrl: '/static/templates/ndvi.' + version + '.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/ndvi.' + version + '.html'
    };

}])
;;
app.directive('passwordConfirm', ['$window', function ($window) {
    var obvious = ['crops', 'cropland', 'rice', 'usgs', 'nasa', 'corn', 'wheat', 'landsat', 'modis'];

    return {
        restrict: 'EA',
        scope: {
            valid: '=valid',
            minEntropy: '=minEntropy',
            password: '=password'
        },
        link: function (scope) {
            if (scope.minEntropy === undefined) {
                scope.minEntropy = 30;
            }

            // init values
            scope.entropy = 0;

            scope.passwordsMatch = function () {
                return scope.password === scope.confirm;
            };

            scope.passwordIsStrong = function () {
                return scope.entropy > scope.minEntropy;
            };

            scope.$watch('password', function (pass) {
                if ($window.zxcvbn === undefined) {
                    scope.entropy = 0;
                    return;
                }

                if (pass && pass.length >= 8) {
                    scope.entropy = zxcvbn(pass, obvious).entropy;
                }
                else {
                    scope.entropy = 0;
                }
            });

            scope.$watch(function () {
                return scope.passwordIsStrong() && scope.passwordsMatch();
            }, function (val) {
                scope.valid = val;
            });
        },
        templateUrl: '/static/templates/directives/password-confirm.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/password-confirm.html'
    }
        ;
}])
;
;
app.directive('photos', ['version', function (version) {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
        link: function (scope) {
            scope.$watch('items', function (val) {
                if (val && val.length > 0) {
                    scope.active = scope.items[0];
                }
                else {
                    scope.active = null;
                }
            });
            scope.src = function (url) {
                if(url) {
                    return "https://s3.amazonaws.com/gfsad30/" + url;
                }
            };

            scope.changeLeadPhoto = function (index) {
                scope.active = scope.items[index];
            };
        },
//        templateUrl: '/static/templates/photos.' + version + '.html'
        templateUrl: 'http://cache.croplands.org/static/templates/photos.' + version + '.html'
    };

}]);;
app.directive('properties', ['version', 'locationFactory', 'mappings', 'leafletData', 'icons', function (version, locationFactory, mappings, leafletData, icons) {
    var activeTab = 'help';

    function blur(e) {
        if (e) {
            $('#' + e.currentTarget.id).blur();
        }
    }

    function resetShapes(shapes, callback) {
        // remove various layers from map and delete reference
        leafletData.getMap().then(function (map) {
            _.forOwn(shapes, function (shape) {
                map.removeLayer(shape);
            });
            if (callback) {
                callback();
            }
        });
    }

    function buildShapes(shapes, latLng) {
//        var gridImageURL = "data:image/png;base64,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";
        var gridImageURL = "/static/images/icons/grid.png";

        shapes.marker = L.marker(latLng, {icon: new L.icon(icons.iconRedSelected), zIndexOffset: 1000});

        // Build rectangle
//        shapes.circle30 = L.circle(latLng, 15, {fill: false, dashArray: [3, 6], color: '#FF0000'});
        shapes.circle250 = L.circle(latLng, 125, {fill: false, dashArray: [3, 6], color: '#00FF00'});
//        shapes.box30 = L.rectangle(shapes.circle30.getBounds(), {fill: false, dashArray: [3, 6], color: '#FF0000'});
//        shapes.box250 = L.rectangle(shapes.circle250.getBounds(), {fill: false, dashArray: [3, 6], color: '#00FF00'});
        shapes.gridImage = L.imageOverlay(gridImageURL, shapes.circle250.getBounds());

        leafletData.getMap().then(function (map) {
//            shapes.box30.addTo(map);
//            shapes.box250.addTo(map);
            shapes.marker.addTo(map);
            shapes.gridImage.addTo(map);

        });
    }

    function init(scope) {
        // reset location data
        scope.location = {};

        // use same tab as before
        scope.activeTab = activeTab;

        // reset active row
        scope.activeRecordRow = null;

        // get children elements if id is present and make copy
        if (scope.id && scope.id !== 1) {

            // Mark panel as busy
            scope.busy = true;

            // Get detailed data
            locationFactory.getSingleMarker(scope.id, function (data) {
                // Save data plus original to detect changes
                scope.location = data;
                scope.copy = angular.copy(scope.location);

                // Location panel is no longer busy
                scope.busy = false;

                // Copy lat lon back for parent etc...
                scope.lat = data.lat;
                scope.lon = data.lon;

                resetShapes(scope.shapes, function () {
                    buildShapes(scope.shapes, [scope.lat, scope.lon]);
                });
            });
        } else {
            // if no id, just save location
            scope.location.lat = scope.lat;
            scope.location.lon = scope.lon;
        }

        if (scope.shapes === undefined) {
            scope.shapes = {};
        }

        if (scope.lat && scope.lon) {

            // Build needs to be in callback of reset otherwise it
            // overwrites that shape references need to remove from map

            resetShapes(scope.shapes, function () {
                buildShapes(scope.shapes, [scope.lat, scope.lon]);
            });
        }
        else {
            resetShapes(scope.shapes);
        }


    }

    return {
        restrict: 'E',
        scope: {
            lat: '=lat',
            lon: '=lon',
            id: '=locationId',
            visible: '=visible'
        },
        link: function (scope) {
            // add some other values to scope
            angular.extend(scope, {
                mappings: mappings,
                allowedYears: _.range(2000, new Date().getFullYear() + 1),
                allowedMonths: _.range(1, 13),
                busy: false,
                location: {
                    records: []
                }
            });

            // Some methods
            scope.close = function () {
                scope.visible = false;
            };

            scope.changeActiveTab = function (tab) {
                activeTab = tab;
                scope.activeTab = tab;
            };

            scope.addRecordRow = function (e) {
                blur(e);

                var d = new Date();

                // Add array if doesnt exist...
                if (scope.location.records === undefined) {
                    scope.location.records = [];
                }

                scope.location.records.push({
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    data_id: scope.location.id,
                    cropland: 0,
                    water: 0,
                    intensity: 0,
                    crop_primary: 0,
                    crop_secondary: 0
                });
            };

            scope.changeRecordRow = function (row) {
                // if already on this row, close it
                if (row === scope.activeRecordRow) {
                    scope.activeRecordRow = null;
                } else {
                    scope.activeRecordRow = row;
                }
            };

            scope.validateRecord = function (record, field) {
                if (field === 'cropland' && record.cropland === 0) {
                    record.crop_primary = 0;
                    record.crop_secondary = 0;
                }

                if (field === 'crop_primary' && record.crop_primary !== 0) {
                    record.cropland = 1;
                }
                if (field === 'crop_secondary' && record.crop_secondary !== 0) {
                    record.cropland = 1;
                }
                if (field === 'water' && record.water !== 0) {
                    record.cropland = 1;
                }
                if (field === 'intensity' && record.intensity !== 0) {
                    record.cropland = 1;
                }


            };

            scope.refresh = function (e) {
                blur(e);
                init(scope);
            };

            scope.saveMarker = function (e) {
                blur(e);
                scope.busy = true;
                locationFactory.save(scope.location, function (response) {
                    if (response) {
                        scope.location = response;
                        scope.copy = angular.copy(scope.location);
                    }
                    scope.busy = false;
                });
            };

            scope.disableSaveMarker = function () {
                return angular.equals(scope.location, scope.copy);
            };

            scope.zoom = function (e) {
                scope.$parent.goToMarker({lat: scope.lat, lon: scope.lon}, e, true);
            };

            // Watch for new location
            scope.$watch(function () {
                    if (scope.id === 1) {
                        return [scope.lat, scope.lon];
                    }
                    return scope.id;

                }, function () {
                    init(scope);
                }, true
            );
            scope.$watch('visible', function (visible) {
                if (!visible) {
                    resetShapes(scope.shapes);
                }
            });
        },
        templateUrl: '/static/templates/location.' + version + '.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/location.' + version + '.html'
    };


}]);
;
app.directive('registerForm', ['user', '$timeout', 'countries', function (user, $timeout, countries) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {

            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
                // Hide after a specific amount of time
                $timeout(function () {
                    scope.success = '';
                    scope.message = '';
                }, 4000);

            }

            // Get List of Countries
            scope.countries = countries;

            scope.register = function () {
                scope.busy = true;
                user.register(scope.registration).then(function (response) {
                    scope.busy = false;
                    setMessage(response.description, false);
                    scope.$emit('user.register', false);

                }, function (response) {
                    console.log(response);
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    scope.busy = false;
                });
            };

            scope.forgot = function () {
                scope.$emit('user.register', false);
                scope.$emit('user.forgot', true);
            };

            scope.login = function () {
                scope.$emit('user.register', false);
                scope.$emit('user.login', true);
            };

            scope.registerClose = function () {
                scope.registration = {};
                scope.$emit('user.register', false);
            };
        },
        templateUrl: '/static/templates/directives/register.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/register.html'
    };

}]);;
app.directive('resetForm', ['user', '$window', '$timeout', function (user, $window, $timeout) {
    return {
        restrict: 'E',
        scope: {
            token: '=token'
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
            }

            scope.reset = function () {
                scope.busy = true;
                user.reset(scope.password, scope.token).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.close();
                }, function (response) {
                    if (response.description) {
                        setMessage(response.description, false);
                    }
                    else {
                        setMessage('Something went wrong', false);
                    }
                    scope.busy = false;
                });
            };

            scope.close = function () {
                $window.location.href='/';
            };
        },
        templateUrl: '/static/templates/directives/reset.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/reset.html'
    };

}]);