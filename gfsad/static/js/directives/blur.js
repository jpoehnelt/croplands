app.directive('blur', [function () {
    return {
        restrict: 'A',
        link: function (scope, element) {
            element.on('click', function () {
                element.blur();
            });
        }
    };
}]);