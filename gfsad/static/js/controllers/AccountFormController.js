app.controller("AccountFormController", ['$location', '$scope', 'log', '$window', function ($location, $scope, log, $window) {
    var path = $location.path().split('/');
    if (path[1] === 'account' && path[1]) {
        $scope.$emit('user.' + path[2], true);
    } else {
        $window.location.href = '/';
    }

}]);