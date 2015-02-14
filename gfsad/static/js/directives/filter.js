app.directive('filter', ['version', 'locationFactory', 'log', '$q', '$timeout', 'mappings', function (version, locationFactory, log, $q, $timeout, mappings) {
    function reset(scope, callback) {
        log.info("Resetting Filters");

        _.each(scope.years, function (year) {
            year.selected = year.label === 2015;
        });

        _.each(scope.landUseType, function (type) {
            type.selected = true;
        });

        _.each(scope.crops, function (crop) {
            crop.selected = true;
        });

        _.each(scope.intensity, function (intensity) {
            intensity.selected = true;
        });

        _.each(scope.water, function (water) {
            water.selected = true;
        });
        if (callback) {
            callback();
        }
    }

    function getSelectedFieldValues(field) {
        return _.pluck(_.where(field, {selected: true}), 'id');
    }

    function apply(scope) {
        log.info("Filtering Locations");

        scope.$parent.busy = true;
        $timeout(function () {
            locationFactory.cf.dims.year.filterAll();
            locationFactory.cf.dims.landUseType.filterAll();
            locationFactory.cf.dims.crop.filterAll();
            locationFactory.cf.dims.intensity.filterAll();
            locationFactory.cf.dims.water.filterAll();

            scope.activeFilters = {
                years: getSelectedFieldValues(scope.years),
                landUseType: getSelectedFieldValues(scope.landUseType),
                crops: getSelectedFieldValues(scope.crops),
                intensity: getSelectedFieldValues(scope.intensity),
                water: getSelectedFieldValues(scope.water)
            };

            locationFactory.filters.years(_.indexBy(scope.years, 'label'));
            locationFactory.filters.landUseType(_.indexBy(scope.landUseType, 'label'));
            locationFactory.filters.crops(_.indexBy(scope.crops, 'label'));
            locationFactory.filters.intensity(_.indexBy(scope.intensity, 'label'));
            locationFactory.filters.water(_.indexBy(scope.water, 'label'));

            locationFactory.returnMarkers();

        }, 100);
    }


    return {
        restrict: 'EA',
        scope: {
            visible: '=visible',
            activeFilters: '=activeFilters'
        },
        link: function (scope) {
            scope.landUseType = angular.copy(mappings.landUseType.choices);
            scope.crops = angular.copy(mappings.crop.choices);
            scope.intensity = angular.copy(mappings.intensity.choices);
            scope.water = angular.copy(mappings.water.choices);
            scope.years = [];

            var currentYear = new Date().getFullYear();
            for (var i = 2000; i < currentYear + 1; i++) {
                scope.years.push({label: i, id: i});
            }


            // Listeners
            scope.$on("locationFactory.markers.filtered", function () {
                scope.countAll = locationFactory.getTotalRecordCount();
                scope.countFiltered = locationFactory.getFilteredRecordCount();
                scope.filters = locationFactory.filters.list;
            });

            scope.$on("locationFactory.markers.downloaded", function () {
                apply(scope);
            });

            // Scope Methods
            scope.reset = function () {
                reset(scope);
            };
            scope.apply = function () {
                apply(scope);
            };

            scope.allOptionsAreSelected = function (field) {
                if (field === undefined) {
                    return false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    if (!scope[field][i].selected) {
                        return false;
                    }
                }
                return true;
            };

            scope.toggleAllOptions = function (field) {
                var selected = true;
                if (scope.allOptionsAreSelected(field)) {
                    selected = false;
                }
                for (var i = 0; i < scope[field].length; i++) {
                    scope[field][i].selected = selected;
                }
            };

            // Initialized Default Filters
            reset(scope, function () {
                log.info("Applying filters to locations", true);
                apply(scope);
            });
        },
        templateUrl: '/static/templates/directives/filter.html'
//        templateUrl: 'http://cache.croplands.org/static/templates/directives/filter.html'
    };

}]);