angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope, $log, OSM, JasaMarga) {
    
    OSM.setUp();
    OSM.setGateInLayer(-6.890810115, 107.5758719, 'Pasteur');
    
    JasaMarga.tollRoute().success(function(data) {
        $scope.tollRoutes = data;
        $scope.gateIn = JasaMarga.getGate($scope.tollRoutes, 'JM5', 7);
        OSM.setGateInLayer($scope.gateIn.lat, $scope.gateIn.long, $scope.gateIn.gerbang_tol_name);
        $scope.gateOut = JasaMarga.getGate($scope.tollRoutes, 'JM6', 10);
        OSM.setGateOutLayer($scope.gateOut.lat, $scope.gateOut.long, $scope.gateOut.gerbang_tol_name);
    });
    
    $scope.calcRoute = function() {
        JasaMarga.findRoute($scope.tollRoutes, $scope.gateIn.ruas_tol_id, $scope.gateIn.gt_sequence,
                            $scope.gateOut.ruas_tol_id, $scope.gateOut.gt_sequence);
    };
})

.controller('FriendsCtrl', function($scope, Friends) {
  $scope.friends = Friends.all();
})

.controller('FriendDetailCtrl', function($scope, $stateParams, Friends) {
  $scope.friend = Friends.get($stateParams.friendId);
})

.controller('AccountCtrl', function($scope) {
});
