app.filter('mappings', ['mappings', function (mappings) {
    return function (key, field) {
        key = key || 0;
        return mappings[field].choices[key].label;
    };
}]);