app.controller("MapController", ['$scope', 'mapService', 'locationFactory', 'leafletData', '$timeout', '$window', '$location', 'mappings', 'log', function ($scope, mapService, locationFactory, leafletData, $timeout, $window, $location, mappings, log) {
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

    $scope.$on('location.record.edit.close', function () {
        $scope.closeRecordEditForm();
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
        $scope.$broadcast('location.record.edit.inactive');
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
        log.info("Loading Marker, ID: " + m.data_id, true);
        // Save marker location
        $scope.location = _.clone(m, true);
        $scope.location.visible = true;

        // Save id in url parameter
        $location.setId($scope.location.data_id);

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
        if (center && center.lat) {
            mapService.center.lat = center.lat;
        }
        if (center && center.lng) {
            mapService.center.lng = center.lng;
        }
        if (center && center.zoom) {
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

}]);