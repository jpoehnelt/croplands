app.directive('legend', ['version', function (version) {
    return {
        restrict: 'E',
        scope: {
            items: '=items'
        },
//        templateUrl: '/static/templates/directives/legend.html'
        templateUrl: 'http://cache.croplands.org/static/templates/directives/legend.html'
    };
}]);