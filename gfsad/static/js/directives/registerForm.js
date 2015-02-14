app.directive('registerForm', ['user', '$timeout', 'countries', function (user, $timeout, countries) {
    return {
        restrict: 'E',
        scope: {
        },
        link: function (scope) {

            function setMessage(message, success) {
                scope.success = success;
                scope.message = message;
                // Hide after a specific amount of time
                $timeout(function () {
                    scope.success = '';
                    scope.message = '';
                }, 4000);

            }

            // Get List of Countries
            scope.countries = countries;

            scope.register = function () {
                scope.busy = true;
                user.register(scope.registration).then(function (response) {
                    scope.busy = false;
                    setMessage(response.description, false);
                    scope.$emit('user.register', false);

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
                scope.$emit('user.register', false);
                scope.$emit('user.forgot', true);
            };

            scope.login = function () {
                scope.$emit('user.register', false);
                scope.$emit('user.login', true);
            };

            scope.registerClose = function () {
                scope.registration = {};
                scope.$emit('user.register', false);
            };
        },
        templateUrl: '/static/templates/directives/register.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/register.html'
    };

}]);