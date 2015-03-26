angular.module('starter.controllers', [])

.controller('AppCtrl', function($scope, $ionicModal, $timeout) {
  // Form data for the login modal
  $scope.loginData = {};

  // Create the login modal that we will use later
  $ionicModal.fromTemplateUrl('templates/login.html', {
    scope: $scope
  }).then(function(modal) {
    $scope.modal = modal;
  });

  // Triggered in the login modal to close it
  $scope.closeLogin = function() {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.login = function() {
    $scope.modal.show();
  };

  // Perform the login action when the user submits the login form
  $scope.doLogin = function() {
    console.log('Doing login', $scope.loginData);

    // Simulate a login delay. Remove this and replace with your login
    // code if using a login system
    $timeout(function() {
      $scope.closeLogin();
    }, 1000);
  };
})

.controller('PublicTransportCtrl', function($scope, $log, OSM, JasaMarga, TransJakarta, MoreData, Settings) {
    
    $scope.form = {};

    OSM.setUp('mappubtrans', -6.21, 106.8, 11);

    $scope.$watch('form.gateIn', function(newV, oldV) {
        if ($scope.form.gateIn) {
            OSM.setGateInLayer($scope.form.gateIn.lat, $scope.form.gateIn.lng, $scope.form.gateIn.name);
            // too edge!
//            var latlngs = [
//                new L.LatLng($scope.form.gateIn.lat, $scope.form.gateIn.long, true),
//                new L.LatLng($scope.form.gateOut.lat, $scope.form.gateOut.long, true) ];
//            var polyline = L.polyline(latlngs, {color: 'red'});
//            OSM.map().fitBounds(polyline.getBounds());
        }
    });
    $scope.$watch('form.gateOut', function(newV, oldV) {
        if ($scope.form.gateOut) {
            OSM.setGateOutLayer($scope.form.gateOut.lat, $scope.form.gateOut.lng, $scope.form.gateOut.name);
            // too edge!
//            var latlngs = [
//                new L.LatLng($scope.form.gateIn.lat, $scope.form.gateIn.long, true),
//                new L.LatLng($scope.form.gateOut.lat, $scope.form.gateOut.long, true) ];
//            var polyline = L.polyline(latlngs, {color: 'red'});
//            OSM.map().fitBounds(polyline.getBounds());
        }
    });

    TransJakarta.lines().success(function(data) {
        $scope.lines = data;
    });
    TransJakarta.stations().success(function(data) {
        $scope.stations = data;
        $scope.form = {
            gateIn: $scope.stations[0],
            gateOut: $scope.stations[10]
        };
    });
    TransJakarta.routes().success(function(data) {
        $scope.routes = data;
    });

    $scope.calcRoute = function() {
        $log.info('Calculating', $scope.form.gateIn.id, $scope.form.gateIn.name, '-->',
                            $scope.form.gateOut.id, $scope.form.gateOut.name);
        OSM.clear();

        var inPoint = TransJakarta.findRoutePoint($scope.routes, $scope.form.gateIn.id);
        var outPoint = TransJakarta.findRoutePoint($scope.routes, $scope.form.gateOut.id);
        $log.info('Route points:', inPoint, '-->', outPoint);

        var route = TransJakarta.findRoute(
            $scope.lines, $scope.stations, $scope.routes,
            inPoint.lineId, inPoint.positioner,
            outPoint.lineId, outPoint.positioner);
        var latlngs = [];
        var lastCp = null;
        var distance = 0;
        for (var i = 0; i < route.length; i++) {
            var r = route[i];
            var latlng = new L.LatLng(r.station.lat, r.station.lng, true);
            latlngs.push(latlng);
            if (i == 0) {
                OSM.addMarker(latlng,
                    {title: 'Awal ' + r.station.lineId + '-' + r.station.positioner + ': ' + r.station.name,
                    icon: OSM.originIcon()});
            } else if (i == route.length - 1) {
                OSM.addMarker(latlng,
                    {title: 'Tujuan ' + r.station.lineId + '-' + r.station.positioner + ': ' + r.station.name,
                    icon: OSM.destIcon()});
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
                    {title: r.kind + ' km ' + r.station.lineId + '-' + r.station.positioner +
                     ': ' + r.station.name,
                    icon: icon}));
            }
            // calc distance
            if (lastCp != null) {
                distance += lastCp.distance( new geo.Point([r.station.lat, r.station.lng]) );
            }
            lastCp = new geo.Point([r.station.lat, r.station.lng]);
        }
        var polyline = L.polyline(latlngs, {color: 'red'});
        OSM.addLayer(polyline);
        OSM.map().fitBounds(polyline.getBounds());
        var avgSpeed = 20;
        $scope.duration = (distance / 1000) / avgSpeed;
        $scope.durationHours = parseInt($scope.duration, 10);
        $scope.durationMins = Math.round($scope.duration * 60) % 60;
        $log.info('Distance over', route.length, 'checkpoints is', distance, 'm',
                 'Duration', $scope.duration, '(', $scope.durationHours, ':', $scope.durationMins, ')');
        $scope.distanceKm = distance / 1000;
        $scope.steps = route;
        $log.debug('Steps:', $scope.steps);
    };
})

.controller('HighwayCtrl', function($scope, $log, OSM, JasaMarga, MoreData, Settings) {

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
    
    OSM.setUp('mapdash', -6.6, 107.0, 8);
    
    $scope.$watch('form.gateIn', function(newV, oldV) {
        if ($scope.form.gateIn) {
            OSM.setGateInLayer($scope.form.gateIn.lat, $scope.form.gateIn.long, $scope.form.gateIn.gerbang_tol_name);
            // too edge!
//            var latlngs = [
//                new L.LatLng($scope.form.gateIn.lat, $scope.form.gateIn.long, true),
//                new L.LatLng($scope.form.gateOut.lat, $scope.form.gateOut.long, true) ];
//            var polyline = L.polyline(latlngs, {color: 'red'});
//            OSM.map().fitBounds(polyline.getBounds());
        }
    });
    $scope.$watch('form.gateOut', function(newV, oldV) {
        if ($scope.form.gateOut) {
            OSM.setGateOutLayer($scope.form.gateOut.lat, $scope.form.gateOut.long, $scope.form.gateOut.gerbang_tol_name);
            // too edge!
//            var latlngs = [
//                new L.LatLng($scope.form.gateIn.lat, $scope.form.gateIn.long, true),
//                new L.LatLng($scope.form.gateOut.lat, $scope.form.gateOut.long, true) ];
//            var polyline = L.polyline(latlngs, {color: 'red'});
//            OSM.map().fitBounds(polyline.getBounds());
        }
    });
    
    JasaMarga.tollRoute().success(function(data) {
        $scope.tollRoutes = data;
        $scope.form = {gateIn: JasaMarga.getGate($scope.tollRoutes, 'JM5', 7),
            gateOut: JasaMarga.getGate($scope.tollRoutes, 'JM6', 10)};
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
                OSM.addMarker(latlng,
                    {title: 'Awal ' + r.gate.ruas_tol_id + '-' + r.gate.gt_sequence + ': ' + r.gate.gerbang_tol_name,
                    icon: OSM.originIcon()});
            } else if (i == route.length - 1) {
                OSM.addMarker(latlng,
                    {title: 'Tujuan ' + r.gate.ruas_tol_id + '-' + r.gate.gt_sequence + ': ' + r.gate.gerbang_tol_name,
                    icon: OSM.destIcon()});
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
        
        $scope.cost = JasaMarga.findFare($scope.tollFares, $scope.vehicle, $scope.fuelUnitPrice, route);
        $log.info('Cost:', $scope.cost);
    };
})

.controller('RestAreasCtrl', function($scope, $log, JasaMarga, OSM) {
    OSM.setUp('maprestareas', -6.6, 107.4, 8);
    $scope.vmodel = {toll: null};
    $scope.updateMap = function() {
        if ($scope.vmodel.toll) {
            OSM.clear();
            var filtered = _.filter($scope.restAreas, function(ra) { return ra.ruas_tol == $scope.vmodel.toll.ruas_tol_id; });
            $log.debug('Filtered rest areas:', filtered);
            for (var i = 0; i < filtered.length; i++) {
                var ra = filtered[i];
                var latlng = new L.LatLng(ra.lat, ra.long, true);    
                OSM.addMarker(latlng,
                    {title: ra.ruas_tol + ' KM ' + ra.km + ' (' + ra.type + ')',
                    icon: OSM.restAreaIcon()});
            }
        }
    };
    JasaMarga.tolls().success(function(data) {
        $scope.tolls = data;
        $scope.vmodel = {toll: $scope.tolls[5]};
        $scope.updateMap();
    });
    JasaMarga.restAreas().success(function(data) {
        $scope.restAreas = data;
        $scope.updateMap();
    });
    $scope.$watch('vmodel.toll', $scope.updateMap);
})

.controller('BpjsCtrl', function($scope, $log, BPJS, OSM) {
    OSM.setUp('mapbpjs', -6.92, 107.6, 12);
    $scope.vmodel = {faskesType: null};
    $scope.updateMap = function() {
        if ($scope.vmodel.faskesType) {
            OSM.clear();
            var filtered = _.filter($scope.faskesGeos, function(faskes) { 
                return $scope.vmodel.faskesType.id == faskes.type; });
            $log.debug('Filtered faskes:', filtered);
            for (var i = 0; i < filtered.length; i++) {
                var faskes = filtered[i];
                var latlng = new L.LatLng(faskes.lat, faskes.long, true);    
                OSM.addMarker(latlng,
                    {title: faskes.name, icon: OSM.bpjsIcon()});
            }
        }
    };
    BPJS.faskesTypes().success(function(data) {
        $scope.faskesTypes = data;
        $log.debug('got', $scope.faskesTypes.length, 'faskes types');
        $scope.vmodel = {faskesType: $scope.faskesTypes[10]};
        $scope.updateMap();
    });
    BPJS.faskesGeos().success(function(data) {
        $scope.faskesGeos = data;
        $log.debug('got', $scope.faskesGeos.length, 'faskes geos');
        $scope.updateMap();
    });
    $scope.$watch('vmodel.faskesType', $scope.updateMap);
})

.controller('RealtimeCtrl', function($scope, $log, JasaMarga, OSM) {
    OSM.setUp('maprealtime', -6.6, 107.0, 8);
})

.controller('TrackerCtrl', function($scope, $log, JasaMarga, OSM) {
    OSM.setUp('maptracker', -6.6, 107.0, 8);
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
