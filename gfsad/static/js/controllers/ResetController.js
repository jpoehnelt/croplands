app.controller("ResetController", ['$location', '$scope', 'log','$window', function ($location, $scope, log, $window) {
    $scope.token = $location.search().token;

    if ($scope.token === undefined) {
        log.warn('Token not found');
        $window.location.href = '/';
    }
}]);