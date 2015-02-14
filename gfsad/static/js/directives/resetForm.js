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