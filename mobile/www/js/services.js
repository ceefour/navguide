angular.module('starter.services', [])

.factory('TransJakarta', function($http, $log) {
    return {
        lines: function() {
            return $http({url: 'data/transjakarta-lines.json'});
        },
        stations: function() {
            return $http({url: 'data/transjakarta-stations.json'});
        },
        routes: function() {
            return $http({url: 'data/transjakarta-routes.json'});
        },
        /**
         * Get a RoutePoint (lineId + positioner)
         * based on stationId
         */
        findRoutePoint: function(routes, stationId) {
            var routePoint = _.find(routes, function(x) { return x.stationId == stationId; });
            return routePoint || null;
        },
        /**
         * Get station based on lineId and positioner.
         */
        getStation: function(stations, routes, lineId, positioner) {
            var routePoint = _.find(routes, function(el) {
                return el.lineId == lineId && el.positioner == positioner; });
            var station = _.find(stations, function(x) { return x.id == routePoint.stationId; });
            if (station == null) {
                throw "Cannot find station " + lineId + " position " + positioner;
            }
            return station;
        },
        /**
         * get the passes as array, excluding both origin and dest
         */
        getPasses: function(stations, routes, origin, dest) {
            var passes = [];
            if (dest.positioner > origin.positioner) {
                for (var gtseq = origin.positioner + 1; gtseq < dest.positioner; gtseq++) {
                    var station = _.clone(this.getStation(stations, routes, origin.lineId, gtseq));
                    station.lineId = origin.lineId;
                    station.positioner = gtseq;
                    passes.push({kind: 'pass', station: station});
                }
            }
            if (dest.positioner < origin.positioner) {
                for (var gtseq = origin.positioner - 1; gtseq > dest.positioner; gtseq--) {
                    var station = _.clone(this.getStation(stations, routes, origin.lineId, gtseq));
                    station.lineId = origin.lineId;
                    station.positioner = gtseq;
                    passes.push({kind: 'pass', station: station});
                }
            }
            return passes;
        },
        /**
         * Both origin and dest must be _.extend() with station+routepoint
         * visitedLines must contain, at least, the origin's lineId
         */
        findRouteNest: function(lines, stations, routes, origin, dest, visitedLines) {
            // if origin and dest is the same segment then simply iterate:
            if (origin.lineId == dest.lineId) {
                $log.debug('same origin at', origin.lineId, origin.positioner, '->', dest.positioner,
                           'visited', visitedLines);
                var route = this.getPasses(stations, routes, origin, dest);
                route.push({kind: 'out', station: dest});
                return route; // got it!
            } else {
                // if different segments then check if what other segments we can use, and find the shortest route
                var bestRoute = null;
                var bestGateCount = null;
                var bestExitGate = null;
                var bestTransitGate = null;
                var bestNewVisitedSegments = null;
                var stopCount = _.find(lines, function(l) { return l.id == origin.lineId; }).stopCount;
                for (var exitSeq = 1; exitSeq <= stopCount; exitSeq++) {
                    var exitGate = this.getGate(tollRoutes, origin.ruas_tol_id, exitSeq);
                    if (exitGate.ruas_tol_intersection) {
                        for (var i in exitGate.ruas_tol_intersection) {
                            var el = exitGate.ruas_tol_intersection[i];

                            var visited = visitedSegments.indexOf(el.ruas_tol_id) >= 0;
                            if (!visited) {
                                var transitGate = this.getGate(tollRoutes, el.ruas_tol_id, el.gt_sequence);
                                var newVisitedSegments = visitedSegments.slice(0);
                                //$log.debug(el, newVisitedSegments);
                                newVisitedSegments.push(el.ruas_tol_id);
                                $log.debug('Exiting', exitGate.ruas_tol_id, exitGate.gt_sequence,
                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
                                           'visited', newVisitedSegments);
                                var transitRoute = this.findRouteNest(tollRoutes, transitGate, dest, newVisitedSegments);
                                var gateCount = _.filter(transitRoute, function(r) { return r.kind == 'in'; }).length;
                                if (transitRoute != null && (bestRoute == null || gateCount < bestGateCount)) {
                                    var route = this.getPasses(tollRoutes, origin, exitGate);
                                    route.push({kind: 'out', gate: exitGate}, {kind: 'in', gate: transitGate});
                                    route = route.concat(transitRoute);
//                                    $log.debug('Got', gateCount, 'gates route exiting',
//                                               exitGate.ruas_tol_id, exitGate.gt_sequence,
//                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
//                                           'visited', newVisitedSegments);
                                    bestRoute = route;
                                    bestGateCount = gateCount;
                                    bestExitGate = exitGate;
                                    bestTransitGate = transitGate;
                                    bestNewVisitedSegments = newVisitedSegments;
                                }
                            }
                        }
                    }
                }
                // either bestRoute or failed
                if (bestRoute != null) {
                    $log.debug('Got', bestGateCount, 'gates route exiting', bestExitGate.ruas_tol_id, bestExitGate.gt_sequence,
                           'transiting', bestTransitGate.ruas_tol_id, bestTransitGate.gt_sequence,
                           'visited', bestNewVisitedSegments);
                }
                return bestRoute;
            }
        },
        /**
         * Find the best route from origin route-point to dest route-point.
         */
        findRoute: function(lines, stations, routes, originLineId, originPositioner,
                             destLineId, destPositioner) {
            var originStation = _.clone(this.getStation(stations, routes, originLineId, originPositioner));
            originStation.lineId = originLineId;
            originStation.positioner = originPositioner;
            var destStation = _.clone(this.getStation(stations, routes, destLineId, destPositioner));
            destStation.lineId = destLineId;
            destStation.positioner = destPositioner;
            $log.debug('Origin:', originStation.id, originStation.name,
                       'Dest:', destStation.id, destStation.name);
            var visitedLines = [originLineId];
            var route = this.findRouteNest(lines, stations, routes,
                                           originStation, destStation,
                                           visitedLines);
            if (route != null) {
                route.unshift({kind: 'in', station: originStation});
                $log.info('Found route:', _.map(route, function(cp) {
                    return cp.kind + ' ' + cp.station.lineId + '_' + cp.station.positioner;
                }));
                return route;
            } else {
                $log.error('Route not found!');
            }
        },
    };
})

.factory('Krl', function($http, $log) {
    return {
        lines: function() {
            return $http({url: 'data/krl-lines.json'});
        },
        stations: function() {
            return $http({url: 'data/krl-stations.json'});
        },
        waypoints: function() {
            return $http({url: 'data/krl-waypoints.json'});
        },
        /**
         * Get a Waypoint (lineId + positioner)
         * based on stationId
         */
        findWaypoint: function(routes, stationId) {
            var routePoint = _.find(routes, function(x) { return x.stationId == stationId; });
            return routePoint || null;
        },
        /**
         * Get station based on lineId and positioner.
         */
        getStation: function(stations, routes, lineId, positioner) {
            var waypoint = _.find(routes, function(el) {
                return el.lineId == lineId && el.positioner == positioner; });
            var station = _.find(stations, function(x) { return x.id == waypoint.stationId; });
            if (station == null) {
                throw "Cannot find station " + lineId + " position " + positioner;
            }
            return station;
        },
        /**
         * get the passes as array, excluding both origin and dest
         */
        getPasses: function(stations, routes, origin, dest) {
            var passes = [];
            if (dest.positioner > origin.positioner) {
                for (var gtseq = origin.positioner + 1; gtseq < dest.positioner; gtseq++) {
                    var station = _.clone(this.getStation(stations, routes, origin.lineId, gtseq));
                    station.lineId = origin.lineId;
                    station.positioner = gtseq;
                    passes.push({kind: 'pass', station: station});
                }
            }
            if (dest.positioner < origin.positioner) {
                for (var gtseq = origin.positioner - 1; gtseq > dest.positioner; gtseq--) {
                    var station = _.clone(this.getStation(stations, routes, origin.lineId, gtseq));
                    station.lineId = origin.lineId;
                    station.positioner = gtseq;
                    passes.push({kind: 'pass', station: station});
                }
            }
            return passes;
        },
        /**
         * Both origin and dest must be _.extend() with station+routepoint
         * visitedLines must contain, at least, the origin's lineId
         */
        findRouteNest: function(lines, stations, routes, origin, dest, visitedLines) {
            // if origin and dest is the same segment then simply iterate:
            if (origin.lineId == dest.lineId) {
                $log.debug('same origin at', origin.lineId, origin.positioner, '->', dest.positioner,
                           'visited', visitedLines);
                var route = this.getPasses(stations, routes, origin, dest);
                route.push({kind: 'out', station: dest});
                return route; // got it!
            } else {
                // if different segments then check if what other segments we can use, and find the shortest route
                var bestRoute = null;
                var bestGateCount = null;
                var bestExitGate = null;
                var bestTransitGate = null;
                var bestNewVisitedSegments = null;
                var stopCount = _.find(lines, function(l) { return l.id == origin.lineId; }).stopCount;
                for (var exitSeq = 1; exitSeq <= stopCount; exitSeq++) {
                    var exitGate = this.getGate(tollRoutes, origin.ruas_tol_id, exitSeq);
                    if (exitGate.ruas_tol_intersection) {
                        for (var i in exitGate.ruas_tol_intersection) {
                            var el = exitGate.ruas_tol_intersection[i];

                            var visited = visitedSegments.indexOf(el.ruas_tol_id) >= 0;
                            if (!visited) {
                                var transitGate = this.getGate(tollRoutes, el.ruas_tol_id, el.gt_sequence);
                                var newVisitedSegments = visitedSegments.slice(0);
                                //$log.debug(el, newVisitedSegments);
                                newVisitedSegments.push(el.ruas_tol_id);
                                $log.debug('Exiting', exitGate.ruas_tol_id, exitGate.gt_sequence,
                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
                                           'visited', newVisitedSegments);
                                var transitRoute = this.findRouteNest(tollRoutes, transitGate, dest, newVisitedSegments);
                                var gateCount = _.filter(transitRoute, function(r) { return r.kind == 'in'; }).length;
                                if (transitRoute != null && (bestRoute == null || gateCount < bestGateCount)) {
                                    var route = this.getPasses(tollRoutes, origin, exitGate);
                                    route.push({kind: 'out', gate: exitGate}, {kind: 'in', gate: transitGate});
                                    route = route.concat(transitRoute);
//                                    $log.debug('Got', gateCount, 'gates route exiting',
//                                               exitGate.ruas_tol_id, exitGate.gt_sequence,
//                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
//                                           'visited', newVisitedSegments);
                                    bestRoute = route;
                                    bestGateCount = gateCount;
                                    bestExitGate = exitGate;
                                    bestTransitGate = transitGate;
                                    bestNewVisitedSegments = newVisitedSegments;
                                }
                            }
                        }
                    }
                }
                // either bestRoute or failed
                if (bestRoute != null) {
                    $log.debug('Got', bestGateCount, 'gates route exiting', bestExitGate.ruas_tol_id, bestExitGate.gt_sequence,
                           'transiting', bestTransitGate.ruas_tol_id, bestTransitGate.gt_sequence,
                           'visited', bestNewVisitedSegments);
                }
                return bestRoute;
            }
        },
        /**
         * Find the best route from origin route-point to dest route-point.
         */
        findRoute: function(lines, stations, routes, originLineId, originPositioner,
                             destLineId, destPositioner) {
            var originStation = _.clone(this.getStation(stations, routes, originLineId, originPositioner));
            originStation.lineId = originLineId;
            originStation.positioner = originPositioner;
            var destStation = _.clone(this.getStation(stations, routes, destLineId, destPositioner));
            destStation.lineId = destLineId;
            destStation.positioner = destPositioner;
            $log.debug('Origin:', originStation.id, originStation.name,
                       'Dest:', destStation.id, destStation.name);
            var visitedLines = [originLineId];
            var route = this.findRouteNest(lines, stations, routes,
                                           originStation, destStation,
                                           visitedLines);
            if (route != null) {
                route.unshift({kind: 'in', station: originStation});
                $log.info('Found route:', _.map(route, function(cp) {
                    return cp.kind + ' ' + cp.station.lineId + '_' + cp.station.positioner;
                }));
                return route;
            } else {
                $log.error('Route not found!');
            }
        },
    };
})

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
        tolls: function() {
            return $http({url: 'data/JM.toll.list.json'});
        },
        tollRoute: function() {
            return $http({url: 'data/JM.toll.route.json'});
        },
        restAreas: function() {
            return $http({url: 'data/JM.toll.restarea.json'});
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
                // if different segments then check if what other segments we can use, and find the shortest route
                var bestRoute = null;
                var bestGateCount = null;
                var bestExitGate = null;
                var bestTransitGate = null;
                var bestNewVisitedSegments = null;
                for (var exitSeq = 1; exitSeq <= segmentGateCounts[origin.ruas_tol_id]; exitSeq++) {
                    var exitGate = this.getGate(tollRoutes, origin.ruas_tol_id, exitSeq);
                    if (exitGate.ruas_tol_intersection) {
                        for (var i in exitGate.ruas_tol_intersection) {
                            var el = exitGate.ruas_tol_intersection[i];
                            
                            var visited = visitedSegments.indexOf(el.ruas_tol_id) >= 0;
                            if (!visited) {
                                var transitGate = this.getGate(tollRoutes, el.ruas_tol_id, el.gt_sequence);
                                var newVisitedSegments = visitedSegments.slice(0);
                                //$log.debug(el, newVisitedSegments);
                                newVisitedSegments.push(el.ruas_tol_id);
                                $log.debug('Exiting', exitGate.ruas_tol_id, exitGate.gt_sequence,
                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
                                           'visited', newVisitedSegments);
                                var transitRoute = this.findRouteNest(tollRoutes, transitGate, dest, newVisitedSegments);
                                var gateCount = _.filter(transitRoute, function(r) { return r.kind == 'in'; }).length;
                                if (transitRoute != null && (bestRoute == null || gateCount < bestGateCount)) {
                                    var route = this.getPasses(tollRoutes, origin, exitGate);
                                    route.push({kind: 'out', gate: exitGate}, {kind: 'in', gate: transitGate});
                                    route = route.concat(transitRoute);
//                                    $log.debug('Got', gateCount, 'gates route exiting',
//                                               exitGate.ruas_tol_id, exitGate.gt_sequence,
//                                           'transiting', transitGate.ruas_tol_id, transitGate.gt_sequence,
//                                           'visited', newVisitedSegments);
                                    bestRoute = route;
                                    bestGateCount = gateCount;
                                    bestExitGate = exitGate;
                                    bestTransitGate = transitGate;
                                    bestNewVisitedSegments = newVisitedSegments;
                                }
                            }
                        }
                    }
                }
                // either bestRoute or failed
                if (bestRoute != null) {
                    $log.debug('Got', bestGateCount, 'gates route exiting', bestExitGate.ruas_tol_id, bestExitGate.gt_sequence,
                           'transiting', bestTransitGate.ruas_tol_id, bestTransitGate.gt_sequence,
                           'visited', bestNewVisitedSegments);
                }
                return bestRoute;
            }
        },
        tollFare: function() {
            return $http({url: 'data/JM.toll.fare.json'});
        },
        /**
         * Calculate Fares for a complete route.
         */
        findFare: function(tollFares, vehicle, fuelUnitPrice, route) {
            var segments = [];
            var lastIn = route[0].gate;
            var vias = [];
            for (var i = 1; i < route.length; i++) {
                var r = route[i];
                if (r.kind == 'out') {
                    segments.push({origin: lastIn, dest: r.gate, vias: vias});
                    lastIn = null;
                    vias = [];
                } else if (r.kind == 'in') {
                    lastIn = r.gate;
                } else {
                    vias.push(r.gate);
                }
            }
            $log.info(segments.length, "segments:",
                _.map(segments, function(r) { 
                    return r.origin.ruas_tol_id + ' ' + r.origin.gt_sequence + '->' + r.dest.gt_sequence; }));
            var cost = {total: 0};
            for (var i in segments) {
                var segment = segments[i];
                var fare = this.lookupFare(tollFares, vehicle.vehicleType, segment.origin.ruas_tol_id, 
                                segment.origin.gt_sequence, segment.dest.gt_sequence);
                segment.fare = fare;
                cost.total += fare;
                segment.distance = new geo.Point([segment.origin.lat, segment.origin.long])
                    .distance(new geo.Point([segment.dest.lat, segment.dest.long]));
                segment.distanceKm = segment.distance / 1000;
                segment.duration = segment.distanceKm / vehicle.avgSpeed;
                segment.durationHours = parseInt(segment.duration, 10);
                segment.durationMins = Math.round(segment.duration * 60) % 60;
                segment.fuelConsumption = segment.distanceKm / vehicle.fuelEfficiency;
                segment.fuelPrice = segment.fuelConsumption * fuelUnitPrice;
                $log.debug(segment.origin.ruas_tol_id, ' ', segment.origin.gt_sequence, '->', segment.dest.gt_sequence,
                           vehicle.vehicleType, '=', segment.fare, '(', cost.total, 'so far)',
                          'distance', segment.distanceKm, 'km');
            }
            cost.segments = segments;
            return cost;
        },
        lookupFare: function(tollFares, vehicleType, segment, inGate, outGate) {
            var fare = _.find(tollFares, function(f) {
                return f.ruas_tol_id == segment &&
                    (f.gt_sequence1.indexOf(inGate) >= 0 && f.gt_sequence2.indexOf(outGate) >= 0
                     || f.gt_sequence2.indexOf(inGate) >= 0 && f.gt_sequence1.indexOf(outGate) >= 0);
            });
            if (!fare) {
                throw "Cannot find fare for " + vehicleType + " " + segment + " " + inGate + "->" + outGate;
            }
            return fare[ vehicleType.toLowerCase() ];
        },
    };
})

.factory('BPJS', function($http, $log) {
    return {
        faskesGeos: function() {
            return $http({url: 'data/BPJS.faskes.branch.bandung.geolocated.json'});
        },
        faskesTypes: function() {
            return $http({url: 'data/BPJS.faskes.type.json'});
        },
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
    var restAreaIcon = L.icon({
        iconUrl: 'img/place-restarea37.png',
        iconSize: [32, 37],
        iconAnchor: [15, 34]
    });
    var bpjsIcon = L.icon({
        iconUrl: 'img/place-bpjs37.png',
        iconSize: [32, 37],
        iconAnchor: [15, 34]
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
        restAreaIcon: function() { return restAreaIcon; },
        bpjsIcon: function() { return bpjsIcon; },
        /**
         * For toll, use -6.6, 107.0, 8
         */
        setUp: function(elId, lat, lng, zoom) {
            // set up the map
            map = new L.Map(elId);

            // create the tile layer with correct attribution
            var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
            var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 12, attribution: osmAttrib});		

            // start the map in middle
            map.setView(new L.LatLng(lat, lng), zoom);
            map.addLayer(osm);
        },
        map: function() { return map; },
        gateInLayer: function() { return gateInLayer; },
        gateOutLayer: function() { return gateOutLayer; },
        clear: function() {
            plotlayers.forEach(function(l) {
                map.removeLayer(l);
            });
            plotlayers = [];
        },
        setGateInLayer: function(lat, lng, title) {
            if (gateInLayer != null) {
                map.removeLayer(gateInLayer);
                plotlayers = _.without(plotlayers, gateInLayer);
            }
            gateInLayer = new L.Marker(new L.LatLng(lat, lng, true), {title: title, icon: originIcon});
            gateInLayer.bindPopup(title);
            map.addLayer(gateInLayer);
            plotlayers.push(gateInLayer);
            return gateInLayer;
        },
        setGateOutLayer: function(lat, lng, title) {
            if (gateOutLayer != null) {
                map.removeLayer(gateOutLayer);
                plotlayers = _.without(plotlayers, gateOutLayer);
            }
            gateOutLayer = new L.Marker(new L.LatLng(lat, lng, true), {title: title, icon: destIcon});
            gateOutLayer.bindPopup(title);
            map.addLayer(gateOutLayer);
            plotlayers.push(gateOutLayer);
            return gateOutLayer;
        },
        addLayer: function(layer) {
            map.addLayer(layer);
            plotlayers.push(layer);
            return layer;
        },
        /**
         * options is title and icon
         */
        addMarker: function(latlng, options) {
            var layer = new L.Marker(latlng, options);
            layer.bindPopup(options.title);
            this.addLayer(layer);
            return layer;
        }
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
