app.controller("MasterController", ['$timeout', '$scope', 'user', 'log', '$location', '$window', function ($timeout, $scope, user, log, $location, $window) {
    $scope.login = false;
    $scope.register = false;
    $scope.forgot = false;


    function changeView(target) {
        var path = $location.path().split('/');
        if (path[1] === 'account' && path[2] !== target) {
            $window.location.href = '/account/' + target;
            return;
        }
        $scope[target] = !$scope[target];
    }

    $scope.goToLogin = function () {
        changeView('login');
    };

    $scope.isLoggedIn = function () {
        return user.isLoggedIn();
    };

    $scope.$on('user.login', function (event, show) {
        if (show) {
            changeView('login');
        } else {
            $scope.login = false;
        }

    });

    $scope.$on('user.register', function (event, show) {
        if (show) {
            changeView('register');
        } else {
            $scope.register = false;
        }
    });

    $scope.$on('user.forgot', function (event, show) {
        if (show) {
            changeView('forgot');
        } else {
            $scope.forgot = false;
        }
    });

    $scope.logout = function () {
        user.logout();
    };


}

])
;