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
        templateUrl: '/static/templates/directives/photos.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/photos.html'
    };

}]);