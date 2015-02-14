app.directive('passwordConfirm', ['$window', function ($window) {
    var obvious = ['crops', 'cropland', 'rice', 'usgs', 'nasa', 'corn', 'wheat', 'landsat', 'modis'];

    return {
        restrict: 'EA',
        scope: {
            valid: '=valid',
            minEntropy: '=minEntropy',
            password: '=password'
        },
        link: function (scope) {
            if (scope.minEntropy === undefined) {
                scope.minEntropy = 30;
            }

            // init values
            scope.entropy = 0;

            scope.passwordsMatch = function () {
                return scope.password === scope.confirm;
            };

            scope.passwordIsStrong = function () {
                return scope.entropy > scope.minEntropy;
            };

            scope.$watch('password', function (pass) {
                if ($window.zxcvbn === undefined) {
                    scope.entropy = 0;
                    return;
                }

                if (pass && pass.length >= 8) {
                    scope.entropy = zxcvbn(pass, obvious).entropy;
                }
                else {
                    scope.entropy = 0;
                }
            });

            scope.$watch(function () {
                return scope.passwordIsStrong() && scope.passwordsMatch();
            }, function (val) {
                scope.valid = val;
            });
        },
        templateUrl: '/static/templates/directives/password-confirm.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/password-confirm.html'
    }
        ;
}])
;
