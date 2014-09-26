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
        var route = JasaMarga.findRoute($scope.tollRoutes, $scope.gateIn.ruas_tol_id, $scope.gateIn.gt_sequence,
                            $scope.gateOut.ruas_tol_id, $scope.gateOut.gt_sequence);
        for (var i = 1; i < route.length - 1; i++) {
            var r = route[i];
            var icon;
            switch (r.kind) {
            case 'in':
                icon = OSM.inIcon();
                break;
            case 'out':
                icon = OSM.outIcon();
                break;
            default:
                icon = OSM.passXsIcon();
            }
            OSM.map().addLayer(new L.Marker(new L.LatLng(r.gate.lat, r.gate.long, true),
                                            {title: r.kind + ' ' + r.gate.ruas_tol_id + '-' + r.gate.gt_sequence + ': ' + r.gate.gerbang_tol_name,
                                            icon: icon}));
        }
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
