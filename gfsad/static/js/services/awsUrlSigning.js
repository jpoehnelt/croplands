/**
 * Created by justin on 12/5/14.
 */
app.factory('awsUrlSigning', ['$http', 'log', '$window', '$q', function ($http, log, $window, $q) {
    var aws = {};
    var params, expiration;

    function getCurrentParams() {
        var deferred = $q.defer();
        $http.post('/aws/policy', {}).
            success(function (data, status, headers, config) {
                // this callback will be called asynchronously
                // when the response is available
                params = data.params;
                expiration = data.expires;
                deferred.resolve(data);
            }).
            error(function (data, status, headers, config) {
                // called asynchronously if an error occurs
                // or server returns response with an error status.
                deferred.reject(data);
            });
        return deferred.promise;
    }

    aws.getParams = function () {
        var deferred = $q.defer();

        if (expiration === undefined || params === undefined || expiration - Date.now() / 1000 < 30) {
            getCurrentParams().then(function () {
                log.info("Downloaded signed url parameters.");
                deferred.resolve(params);
            }, function () {
                log.warn("Could not get signed url parameters.");
                deferred.reject();
            });
        } else {
            deferred.resolve(params);
        }
        return deferred.promise;
    };


    // init
//    aws.getParams();

    return aws;
}]);