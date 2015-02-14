app.controller("GameController", ['$scope', 'mapService', 'locationFactory', 'leafletData', 'mappings', '$q', function ($scope, mapService, locationFactory, leafletData, mappings, $q) {
    var markers;

    // Apply defaults
    angular.extend($scope, {
        markers: {},
        layers: mapService.layers,
        center: mapService.center
    });

    $scope.landUseType = mappings.landUseType;

    $scope.$on("locationFactory.markers.filtered", function () {
        markers = _.shuffle(locationFactory.markers);
        getMarker();
    });

    function getMarker() {
        var m = markers.pop();
        $scope.markers = {m: {lat: m.lat, lng: m.lon, layer: 'locations'}};
        $scope.center.lat = m.lat;
        $scope.center.lng = m.lon;
        $scope.center.zoom = 16;
    }

    locationFactory.getMarkers();

    $scope.skip = function () {
        getMarker();
    };

}]);