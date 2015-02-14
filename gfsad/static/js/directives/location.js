app.directive('location', ['version', 'locationFactory', 'mappings', 'leafletData', 'icons', 'mapService', function (version, locationFactory, mappings, leafletData, icons, mapService) {
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

        // get children elements if id is present and make copy
        if (scope.id && scope.id !== 1) {

            // Mark panel as busy
            scope.busy = true;

            // Get detailed data
            locationFactory.getLocation(scope.id, function (data) {
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

                var d = new Date(), record;

                // Add array if doesnt exist...
                if (scope.location.records === undefined) {
                    scope.location.records = [];
                }
                record = {
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    lat: scope.location.lat,
                    lon: scope.location.lon,
                    data_id: scope.location.id,
                    land_use_type: 0,
                    water: 0,
                    intensity: 0,
                    crop_primary: 0,
                    crop_secondary: 0
                };
                scope.location.records.push(record);
                scope.$emit('location.record.edit.open', record);
            };


            scope.zoom = function () {
                mapService.zoom(scope.lat, scope.lon, 16);
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
        templateUrl: '/static/templates/directives/location.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/location.html'
    };


}]);
