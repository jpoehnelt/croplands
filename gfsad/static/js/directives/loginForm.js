app.directive('loginForm', ['user', 'log', '$timeout', function (user, log, $timeout) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {
            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
                $timeout(function () {
                    scope.success = '';
                    scope.message = '';
                }, 4000);
            }

            scope.login = function (valid) {
                scope.login.busy = true;
                if (!valid) {
                    setMessage('Invalid Data', false);
                    return;
                }
                user.login(scope.email, scope.password).then(function (response) {
                    setMessage(response.description, true);
                    scope.busy = false;
                    scope.$emit('user.login', false);
                    scope.email = '';
                    scope.password = '';
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

            scope.forgot = function () {
                scope.$emit('user.login', false);
                scope.$emit('user.forgot', true);
            };

            scope.register = function () {
                scope.$emit('user.login', false);
                scope.$emit('user.register', true);
            };

            scope.loginClose = function () {
                scope.$emit('user.login', false);
            };
        },
        templateUrl: '/static/templates/directives/login.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/login.html'
    };

}]);