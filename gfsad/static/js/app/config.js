var app = angular.module("app", ["leaflet-directive", "ngRoute", 'mgcrea.ngStrap']);
app.config(['$tooltipProvider', '$routeProvider', 'version', '$sceDelegateProvider', '$locationProvider', function ($tooltipProvider, $routeProvider, version, $sceDelegateProvider, $locationProvider) {
    $routeProvider
        // route for the home page
        .when('/', {
//            templateUrl: 'http://cache.croplands.org/static/templates/home.html',
            templateUrl: '/static/templates/home.html'
        }).when('/map', {
            templateUrl: 'http://cache.croplands.org/static/templates/map.html',
//            templateUrl: '/static/templates/map.html',
            controller: 'MapController',
            reloadOnSearch: false
        }).when('/account/login', {
            template: '',
            controller: 'AccountFormController'
        }).when('/account/register', {
            template: '',
            controller: 'AccountFormController'
        }).when('/account/forgot', {
            template: '',
            controller: 'AccountFormController'
        }).when('/account/reset', {
            templateUrl: '/static/templates/reset.html',
            controller: 'ResetController'
        }).when('/game', {
            templateUrl: '/static/templates/game.html',
            controller: 'GameController'
        }).otherwise({
            templateUrl: '/static/templates/404.html'
        });

    $locationProvider.html5Mode(true);
    $locationProvider.hashPrefix('!#');

    angular.extend($tooltipProvider.defaults, {
        animation: 'am-fade-and-scale',
        trigger: 'hover',
        placement: 'bottom',
        container: 'body'
    });
    $sceDelegateProvider.resourceUrlWhitelist([
        // Allow same origin resource loads.ot
        'self',
        // Allow loading from our assets domain.  Notice the difference between * and **.
        'http://cache.croplands.org/static/**']);
}]);

app.run([
    '$http',
    '$window',
    function ($http, $window) {
        $http.defaults.headers.post['X-CSRFToken'] = $window.csrfToken;
    }]);