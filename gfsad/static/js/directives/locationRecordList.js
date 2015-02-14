app.directive('locationRecordList', ['$window', function ($window) {
    return {
        restrict: 'EA',
        scope: {
            records: '=records',
            page: '=page',
            pageSize: '=pageSize',
            showZoom: '=showZoom'
        },
        link: function (scope) {
            _.sortBy(scope.records, function (r) {
                return r.year*100 + r.month;
            });

            scope.pagedRecords = [];
            if (scope.page === undefined) {
                scope.page = 0;
            }

            if (scope.showZoom === undefined) {
                scope.showZoom = false;
            }

            if (scope.pageSize === undefined) {
                if ($window.screen.height) {
                    scope.pageSize = Math.max(Math.floor(($window.screen.height - 750) / 20), 5);
                } else {
                    scope.pageSize = 8;
                }
            }


            scope.makePages = function () {
                scope.pagedRecords = [];
                if (!scope.records || !scope.records.length) {
                    return;
                }
                for (var i = 0; i < scope.records.length; i++) {
                    // Build array if page is empty
                    if (i % scope.pageSize === 0) {
                        scope.pagedRecords[Math.floor(i / scope.pageSize)] = [ scope.records[i] ];
                    } else { // append to existing page
                        scope.pagedRecords[Math.floor(i / scope.pageSize)].push(scope.records[i]);
                    }
                }
            };

            scope.range = function (start, end) {
                var ret = [];
                if (!end) {
                    end = start;
                    start = 0;
                }
                for (var i = start; i < end; i++) {
                    ret.push(i);
                }
                return ret;
            };

            scope.setPage = function (page) {
                if (page !== undefined) {
                    scope.page = page;
                }
            };

            scope.previous = function () {
                if (scope.page > 0) {
                    scope.page--;
                }
            };

            scope.next = function () {
                if (scope.pagedRecords.length > scope.page + 1) {
                    scope.page++;
                }
            };

            scope.$watch(function () {
                if (scope.records) {
                    return scope.records.length;
                }
                return 0;
            }, function () {
                scope.makePages();
            });



        },
//        templateUrl: '/static/templates/directives/location-record-list.html'
        templateUrl: '/static/templates/directives/location-record-list.html'
    };
}]);