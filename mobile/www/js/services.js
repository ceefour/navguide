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
            return _.find(tollRoutes, function(el) {
                return el.ruas_tol_id == segment && el.gt_sequence == gateSeq; });
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
                $log.info('Found route:', _.map(route, function(cp) {
                    return cp.kind + ' ' + cp.gate.ruas_tol_id + '_' + cp.gate.gt_sequence;
                }));
            } else {
                $log.error('Route not found!');
            }
        },
        /**
         * visitedSegments must contain, at least, the origin's ruas_tol_id
         */
        findRouteNest: function(tollRoutes, origin, dest, visitedSegments) {
            var JasaMarga = this;
            // if origin and dest is the same segment then simply iterate:
            if (origin.ruas_tol_id == dest.ruas_tol_id) {
                $log.debug('same origin at', origin.ruas_tol_id, 'visited', visitedSegments);
                return [{kind: 'out', gate: dest}]; // got it!
            } else {
                // if different segments then check if we can use another segment
                for (var exitSeq = 1; exitSeq <= segmentGateCounts[origin.ruas_tol_id]; exitSeq++) {
                    var exitGate = JasaMarga.getGate(tollRoutes, origin.ruas_tol_id, exitSeq);
                    if (exitGate.ruas_tol_intersection) {
                        for (var i in exitGate.ruas_tol_intersection) {
                            var el = exitGate.ruas_tol_intersection[i];
                            
                            var visited = visitedSegments.indexOf(el.ruas_tol_id) >= 0;
                            if (!visited) {
                                var transitGate = JasaMarga.getGate(tollRoutes, el.ruas_tol_id, el.gt_sequence);
                                var newVisitedSegments = visitedSegments.slice(0);
                                $log.debug(el, newVisitedSegments);
                                newVisitedSegments.push(el.ruas_tol_id);
                                $log.debug('Exiting', exitGate.ruas_tol_id, exitGate.gt_sequence,
                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
                                           'visited', newVisitedSegments);
                                var route = JasaMarga.findRouteNest(tollRoutes, transitGate, dest, newVisitedSegments);
                                if (route != null) {
                                    route.unshift({kind: 'out', gate: exitGate}, 
                                                  {kind: 'in', gate: transitGate});
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
    };
})

.factory('OSM', function() {
    var map;
    var ajaxRequest;
    var plotlist;
    var plotlayers=[];
    
    var gateInLayer = null;
    var gateOutLayer = null;

    return {
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
            gateInLayer = new L.Marker(new L.LatLng(lat, lng, true), {title: title});
            map.addLayer(gateInLayer);
            return gateInLayer;
        },
        setGateOutLayer: function(lat, lng, title) {
            if (gateOutLayer != null) map.removeLayer(gateOutLayer);
            gateOutLayer = new L.Marker(new L.LatLng(lat, lng, true), {title: title});
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
