app.filter('prepend', [function () {
    return function (key, field) {
        return field + key;
    };
}]);