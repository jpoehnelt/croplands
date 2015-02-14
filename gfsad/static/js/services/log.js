app.service('log', ['$log', '$timeout', function ($log, $timeout) {
    var _log = [];
    var _prefix = '[GFSAD] ';

    var save = function (message) {
        _log.push({date: Date.now(), message: message});
    };

    this.info = function (message, log) {
        $log.info(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.warn = function (message, log) {
        $log.warn(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.error = function (message, log) {
        $log.error(_prefix + message);
        if (log) {
            save(message);
            $timeout(function () {
                _log = _log.slice(1);
            }, 10000);
        }
    };
    this.debug = function (message) {
        $log.debug(_prefix + message);
    };
    this.getLog = function () {
        return _log;
    };
}]);
