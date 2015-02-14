app.directive('ndvi', ['version', '$http', '$log', '$q', function (version, $http, $log, $q) {
    var URL = 'http://api.croplands.org/gee/time_series',
        series = {};
    var canceller = $q.defer();

    var colors = {
        2000: "#1f77b4",
        2001: "#aec7e8",
        2002: "#ff7f0e",
        2003: "#ffbb78",
        2004: "#2ca02c",
        2005: "#98df8a",
        2006: "#d62728",
        2007: "#ff9896",
        2008: "#9467bd",
        2009: "#c5b0d5",
        2010: "#8c564b",
        2011: "#c49c94",
        2012: "#e377c2",
        2013: "#f7b6d2",
        2014: "#7f7f7f",
        2015: "#c7c7c7",
        2016: "#bcbd22",
        2017: "#dbdb8d",
        2018: "#17becf",
        2019: "#9edae5"
    };

    function hashISODate(date_str) {
        // returns year and a period of the year where each month is divided into three parts with a 0 index
        var year = parseInt(date_str.substring(0, 4), 10),
            month = parseInt(date_str.substring(5, 7), 10) - 1,
            day = parseInt(date_str.substring(8, 10), 10),
            period;

        period = month * 3 + Math.min(2, parseInt(day / 10, 10)); // 3*[0-12] + [0-2]
        return [year, period];
    }

    function queryData(lat, lon, scope) {
        scope.ndviBusy = true;
        // reset series
        series = {};

        // add parameters to url
        var _url = URL + '?';
        if (lat) {
            _url += 'lat=' + String(lat) + '&';
        }
        if (lon) {
            _url += 'lon=' + String(lon) + '&';
        }
        _url += 'date_start=2012-01-01&';

        $http({method: 'GET', url: _url, timeout: canceller, transformRequest: function (data, headersGetter) {
            var headers = headersGetter();
            delete headers.authorization;
            return headers;
        }}).
            success(function (data) {
                series = {};
                _.each(data.results, function (item) {
                    var hash = hashISODate(item.date);
                    // if year not in series
                    if (series[hash[0]] === undefined) {
                        series[hash[0]] = {
                            points: '',
                            active: '',
                            color: colors[hash[0]]
                        };
                    }
                    // append data point to year series
                    if (item.hasOwnProperty('ndvi')) {
                        series[hash[0]].points += (String((hash[1] * 10) + 40) + "," + String(Math.abs(205 - (item.ndvi / 10000 * 210)))) + " ";
                    }
                });
                scope.series = series;
                scope.ndviBusy = false;
            }
        );
    }

    return {
        restrict: 'E',
        scope: {
            lat: '=lat',
            lon: '=lon'
        },
        link: function (scope) {
            scope.$watch(function () {
                return [scope.lat, scope.lon];
            }, function (pt) {
                if (pt[0] && pt[1]) {
                    canceller.resolve("new location");
                    queryData(pt[0], pt[1], scope);
                }
            }, true);


            scope.activate = function (year) {
                _.forOwn(scope.series, function (y, k) {
                    if (k === year) {
                        y.class = 'active';
                    } else {
                        y.class = 'inactive';
                    }
                });
            };

            scope.deactivate = function () {
                _.forOwn(scope.series, function (y) {
                    y.class = '';
                });
            };

        },
        templateUrl: '/static/templates/directives/ndvi.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/ndvi.html'
    };

}])
;