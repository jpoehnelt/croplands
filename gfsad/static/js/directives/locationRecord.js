app.directive('locationRecord', ['mapService','user', function (mapService, user) {
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
            scope.$on('location.record.edit.inactive', function () {
                    scope.showEditForm = false;
            });
            scope.zoom = function () {
                if (scope.record.lat && scope.record.lon) {
                    mapService.zoom(scope.record.lat, scope.record.lon, 16);
                }
            };

            scope.thumbsUp = function () {
                console.log(scope.record);
            };
            scope.thumbsDown = function () {
                console.log(scope.record);
            };


        },
//        templateUrl: '/static/templates/directives/location-record.html'
        templateUrl: '/static/templates/directives/location-record.html'
    };
}]);