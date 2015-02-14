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
        templateUrl: '/static/templates/directives/log.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/log.html'
    };
}]);
