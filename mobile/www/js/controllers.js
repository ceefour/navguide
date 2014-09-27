angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope, $log, OSM, JasaMarga, MoreData, Settings) {
    
    $scope.form = {};
    $scope.fuelEfficiency = 9.91; // 23.3 mpg
    $scope.vehicle = Settings.getVehicle();
    if ($scope.vehicle != null) {
        $log.info('Saved vehicle is', $scope.vehicle);
        $scope.fuelEfficiency = $scope.vehicle.fuelEfficiency;
    } else {
        MoreData.vehicles().success(function(data) {
            $scope.vehicle = data[0];
            $log.info('Setting default vehicle as', $scope.vehicle.vehicleId);
            Settings.setVehicle($scope.vehicle);
            $scope.fuelEfficiency = $scope.vehicle.fuelEfficiency;
        });
    }
    
    OSM.setUp();
    
    JasaMarga.tollRoute().success(function(data) {
        $scope.tollRoutes = data;
        $scope.form = {gateIn: JasaMarga.getGate($scope.tollRoutes, 'JM5', 7),
            gateOut: JasaMarga.getGate($scope.tollRoutes, 'JM6', 10)};
        OSM.setGateInLayer($scope.form.gateIn.lat, $scope.form.gateIn.long, $scope.form.gateIn.gerbang_tol_name);
        OSM.setGateOutLayer($scope.form.gateOut.lat, $scope.form.gateOut.long, $scope.form.gateOut.gerbang_tol_name);
    });
    JasaMarga.tollFare().success(function(data) {
        $scope.tollFares = data;
    });
    MoreData.fuels().success(function(data) {
        $scope.fuels = data;
    });
    
    $scope.calcRoute = function() {
        $log.info('Calculating', $scope.form.gateIn.ruas_tol_id, $scope.form.gateIn.gt_sequence, '-->',
                            $scope.form.gateOut.ruas_tol_id, $scope.form.gateOut.gt_sequence);
        OSM.clear();
        var route = JasaMarga.findRoute($scope.tollRoutes, $scope.form.gateIn.ruas_tol_id, $scope.form.gateIn.gt_sequence,
                            $scope.form.gateOut.ruas_tol_id, $scope.form.gateOut.gt_sequence);
        var latlngs = [];
        var lastCp = null;
        var distance = 0;
        for (var i = 0; i < route.length; i++) {
            var r = route[i];
            var latlng = new L.LatLng(r.gate.lat, r.gate.long, true);
            latlngs.push(latlng);
            if (i == 0) {
                OSM.addLayer(new L.Marker(latlng,
                    {title: 'Awal ' + r.gate.ruas_tol_id + '-' + r.gate.gt_sequence + ': ' + r.gate.gerbang_tol_name,
                    icon: OSM.originIcon()}));
            } else if (i == route.length - 1) {
                OSM.addLayer(new L.Marker(latlng,
                    {title: 'Tujuan ' + r.gate.ruas_tol_id + '-' + r.gate.gt_sequence + ': ' + r.gate.gerbang_tol_name,
                    icon: OSM.destIcon()}));
            } else if (i > 0 && i < route.length - 1) {
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
                OSM.addLayer(new L.Marker(latlng,
                    {title: r.kind + ' km ' + r.gate.km + ' ' + r.gate.ruas_tol_id + '-' + r.gate.gt_sequence +
                     ': ' + r.gate.gerbang_tol_name,
                    icon: icon}));
            }
            // calc distance
            if (lastCp != null) {
                distance += lastCp.distance( new geo.Point([r.gate.lat, r.gate.long]) );
            }
            lastCp = new geo.Point([r.gate.lat, r.gate.long]);
        }
        var polyline = L.polyline(latlngs, {color: 'red'});
        OSM.addLayer(polyline);
        OSM.map().fitBounds(polyline.getBounds());
        $scope.fuelConsumption = (distance / 1000) / $scope.fuelEfficiency;
        $scope.duration = (distance / 1000) / $scope.vehicle.avgSpeed;
        $scope.durationHours = parseInt($scope.duration, 10);
        $scope.durationMins = Math.round($scope.duration * 60) % 60;
        $scope.fuelUnitPrice = $scope.fuels[ $scope.vehicle.fuel ];
        $scope.fuelPrice = $scope.fuelConsumption * $scope.fuelUnitPrice;
        $log.info('Distance over', route.length, 'checkpoints is', distance, 'm',
                 'fuel', $scope.fuelConsumption, 'L ×', $scope.fuelUnitPrice, '=', $scope.fuelPrice,
                 'Duration', $scope.duration, '(', $scope.durationHours, ':', $scope.durationMins, ')');
        $scope.distanceKm = distance / 1000;
        
        JasaMarga.findFare($scope.tollFares, $scope.vehicle.vehicleType, route);
    };
})

.controller('FriendsCtrl', function($scope, Friends) {
  $scope.friends = Friends.all();
})

.controller('FriendDetailCtrl', function($scope, $stateParams, Friends) {
  $scope.friend = Friends.get($stateParams.friendId);
})

.controller('AccountCtrl', function($scope, $log, MoreData, Settings) {
    var vehicleId = Settings.getVehicle().vehicleId;
    $log.debug('Saved vehicle is', vehicleId);
    MoreData.vehicles().success(function(data) {
        $log.debug('Loaded', data.length, 'vehicles');
        $scope.vehicles = data;
        $scope.vehicle = _.find($scope.vehicles, function(v) { return v.vehicleId == vehicleId; });
    });
    $scope.vehicleChanged = function(vehicle) {
        $log.info('Saving vehicle', vehicle);
        Settings.setVehicle(vehicle);
    };
});
