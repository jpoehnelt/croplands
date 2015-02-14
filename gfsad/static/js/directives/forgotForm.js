app.directive('forgotForm', ['user', 'log', '$timeout', function (user, log, $timeout) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
            }

            scope.forgot = function () {
                scope.login.busy = true;
                user.forgot(scope.email).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.email = '';
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

            scope.login = function () {
                scope.$emit('user.forgot', false);
                scope.$emit('user.login', true);
            };

            scope.register = function () {
                scope.$emit('user.forgot', false);
                scope.$emit('user.register', true);
            };

            scope.close = function () {
                scope.$emit('user.forgot', false);
            };
        },
        templateUrl: '/static/templates/directives/forgot.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/forgot.html'
    };

}]);