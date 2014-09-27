angular.module('starter.services', [])

.factory('JasaMarga', function($http, $log) {
    var segmentGateCounts = {
        'JM1': 11,
        'JM2': 4,
        'JM3': 13,
        'JM4': 15,
        'JM5': 8,
        'JM6': 11,
        'JM7': 4
    };
    return {
        tollRoute: function() {
            return $http({url: 'data/JM.toll.route.json'});
        },
        getGate: function(tollRoutes, segment, gateSeq) {
            var gate = _.find(tollRoutes, function(el) {
                return el.ruas_tol_id == segment && el.gt_sequence == gateSeq; });
            if (gate == null) {
                throw "Cannot find gate " + segment + " " + gateSeq;
            }
            return gate;
        },
        findRoute: function(tollRoutes, segmentOrigin, gateSeqOrigin,
                             segmentDest, gateSeqDest) {
            var gateOrigin = this.getGate(tollRoutes, segmentOrigin, gateSeqOrigin);
            var gateDest = this.getGate(tollRoutes, segmentDest, gateSeqDest);
            $log.debug('Origin:', gateOrigin.ruas_tol_id, gateOrigin.gerbang_tol_name, 
                       'Dest:', gateDest.ruas_tol_id, gateDest.gerbang_tol_name);
            var visitedSegments = [gateOrigin.ruas_tol_id];
            var route = this.findRouteNest(tollRoutes, gateOrigin, gateDest, visitedSegments);
            if (route != null) {
                route.unshift({kind: 'in', gate: gateOrigin});
                $log.info('Found route:', _.map(route, function(cp) {
                    return cp.kind + ' ' + cp.gate.ruas_tol_id + '_' + cp.gate.gt_sequence;
                }));
                return route;
            } else {
                $log.error('Route not found!');
            }
        },
        /**
         * get the passes as array, excluding both origin and dest
         */
        getPasses: function(tollRoutes, origin, dest) {
            var passes = [];
            if (dest.gt_sequence > origin.gt_sequence) {
                for (var gtseq = origin.gt_sequence + 1; gtseq < dest.gt_sequence; gtseq++) {
                    passes.push({kind: 'pass', gate: this.getGate(tollRoutes, origin.ruas_tol_id, gtseq)});
                }
            }
            if (dest.gt_sequence < origin.gt_sequence) {
                for (var gtseq = origin.gt_sequence - 1; gtseq > dest.gt_sequence; gtseq--) {
                    passes.push({kind: 'pass', gate: this.getGate(tollRoutes, origin.ruas_tol_id, gtseq)});
                }
            }
            return passes;
        },
        /**
         * visitedSegments must contain, at least, the origin's ruas_tol_id
         */
        findRouteNest: function(tollRoutes, origin, dest, visitedSegments) {
            // if origin and dest is the same segment then simply iterate:
            if (origin.ruas_tol_id == dest.ruas_tol_id) {
                $log.debug('same origin at', origin.ruas_tol_id, origin.gt_sequence, '->', dest.gt_sequence,
                           'visited', visitedSegments);
                var route = this.getPasses(tollRoutes, origin, dest);
                route.push({kind: 'out', gate: dest});
                return route; // got it!
            } else {
                // if different segments then check if we can use another segment
                for (var exitSeq = 1; exitSeq <= segmentGateCounts[origin.ruas_tol_id]; exitSeq++) {
                    var exitGate = this.getGate(tollRoutes, origin.ruas_tol_id, exitSeq);
                    if (exitGate.ruas_tol_intersection) {
                        for (var i in exitGate.ruas_tol_intersection) {
                            var el = exitGate.ruas_tol_intersection[i];
                            
                            var visited = visitedSegments.indexOf(el.ruas_tol_id) >= 0;
                            if (!visited) {
                                var transitGate = this.getGate(tollRoutes, el.ruas_tol_id, el.gt_sequence);
                                var newVisitedSegments = visitedSegments.slice(0);
                                $log.debug(el, newVisitedSegments);
                                newVisitedSegments.push(el.ruas_tol_id);
                                $log.debug('Exiting', exitGate.ruas_tol_id, exitGate.gt_sequence,
                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
                                           'visited', newVisitedSegments);
                                var transitRoute = this.findRouteNest(tollRoutes, transitGate, dest, newVisitedSegments);
                                if (transitRoute != null) {
                                    var route = this.getPasses(tollRoutes, origin, exitGate);
                                    route.push({kind: 'out', gate: exitGate}, {kind: 'in', gate: transitGate});
                                    route = route.concat(transitRoute);
                                    $log.debug('Got inner route exiting', exitGate.ruas_tol_id, exitGate.gt_sequence,
                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
                                           'visited', newVisitedSegments);
                                    return route;
                                }
                            }
                        }
                    }
                }
                // failed :(
                return null;
            }
        },
        tollFare: function() {
            return $http({url: 'data/JM.toll.fare.json'});
        },
        findFare: function(tollFares, route) {
            var segments = [];
            var lastIn = route[0].gate;
            for (var i = 1; i < route.length; i++) {
                var r = route[i];
                if (r.kind == 'out') {
                    segments.push({origin: lastIn, dest: r.gate});
                    lastIn = null;
                }
                if (r.kind == 'in') {
                    lastIn = r.gate;
                }
            }
            $log.info(segments.length, "segments:",
                _.map(segments, function(r) { 
                    return r.origin.ruas_tol_id + ' ' + r.origin.gt_sequence + '->' + r.dest.gt_sequence; }));
        }
    };
})

.factory('MoreData', function($http, $log) {
    return {
        vehicles: function() {
            return $http({url: 'data/vehicles.json'});
        },
        fuels: function() {
            return $http({url: 'data/fuels.json'});
        },
    };
})

.factory('Settings', function($log) {
    return {
        getVehicle: function() {
            var vehicleJson = window.localStorage.getItem('vehicle');
            return vehicleJson ? JSON.parse(vehicleJson) : null;
        },
        setVehicle: function(vehicle) {
            window.localStorage.setItem('vehicle', JSON.stringify(vehicle));
        },
    };
})

.factory('OSM', function() {
    var map;
    var ajaxRequest;
    var plotlist;
    var plotlayers=[];
    
    var originIcon = L.icon({
        iconUrl: 'img/place-origin41.png',
        iconRetinaUrl: 'img/place-origin82.png',
        iconSize: [41, 41],
        iconAnchor: [20, 40]
    });
    var destIcon = L.icon({
        iconUrl: 'img/place-dest41.png',
        iconRetinaUrl: 'img/place-dest82.png',
        iconSize: [41, 41],
        iconAnchor: [20, 40]
    });
    var inIcon = L.icon({
        iconUrl: 'img/place-in41.png',
        iconSize: [41, 41],
        iconAnchor: [33, 22]
    });
    var outIcon = L.icon({
        iconUrl: 'img/place-out41.png',
        iconSize: [41, 41],
        iconAnchor: [33, 22]
    });
    var passIcon = L.icon({
        iconUrl: 'img/place-pass41.png',
        iconSize: [41, 41],
        iconAnchor: [20, 37]
    });
    var passXsIcon = L.icon({
        iconUrl: 'img/place-pass20.png',
        iconSize: [20, 20],
        iconAnchor: [10, 18]
    });
    
    var gateInLayer = null;
    var gateOutLayer = null;

    return {
        originIcon: function() { return originIcon; },
        destIcon: function() { return destIcon; },
        passIcon: function() { return passIcon; },
        passXsIcon: function() { return passXsIcon; },
        inIcon: function() { return inIcon; },
        outIcon: function() { return outIcon; },
        setUp: function() {
            // set up the map
            map = new L.Map('map');

            // create the tile layer with correct attribution
            var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
            var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 12, attribution: osmAttrib});		

            // start the map in middle
            map.setView(new L.LatLng(-6.6, 107.0), 8);
            map.addLayer(osm);
        },
        map: function() { return map; },
        gateInLayer: function() { return gateInLayer; },
        gateOutLayer: function() { return gateOutLayer; },
        setGateInLayer: function(lat, lng, title) {
            if (gateInLayer != null) map.removeLayer(gateInLayer);
            gateInLayer = new L.Marker(new L.LatLng(lat, lng, true), {title: title, icon: originIcon});
            map.addLayer(gateInLayer);
            return gateInLayer;
        },
        setGateOutLayer: function(lat, lng, title) {
            if (gateOutLayer != null) map.removeLayer(gateOutLayer);
            gateOutLayer = new L.Marker(new L.LatLng(lat, lng, true), {title: title, icon: destIcon});
            map.addLayer(gateOutLayer);
            return gateOutLayer;
        },
    };
})
    
/**
 * A simple example service that returns some data.
 */
.factory('Friends', function() {
  // Might use a resource here that returns a JSON array

  // Some fake testing data
  var friends = [
    { id: 0, name: 'Scruff McGruff' },
    { id: 1, name: 'G.I. Joe' },
    { id: 2, name: 'Miss Frizzle' },
    { id: 3, name: 'Ash Ketchum' }
  ];

  return {
    all: function() {
      return friends;
    },
    get: function(friendId) {
      // Simple index lookup
      return friends[friendId];
    }
  }
});
