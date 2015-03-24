// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services'])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider, $compileProvider) {
    
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|tel|app|chrome-extension):/);
    $compileProvider.imgSrcSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|tel|app|chrome-extension):/);
    
  $stateProvider

  .state('app', {
    url: "/app",
    abstract: true,
    templateUrl: "templates/menu.html",
    controller: 'AppCtrl'
  })
  
    // Each tab has its own nav history stack:

    .state('app.dash', {
      url: '/dash',
      views: {
        'tab-dash': {
          templateUrl: 'templates/app-dash.html',
          controller: 'DashCtrl'
        }
      }
    })

    .state('app.restareas', {
      url: '/restareas',
      views: {
        'tab-restareas': {
          templateUrl: 'templates/app-restareas.html',
          controller: 'RestAreasCtrl'
        }
      }
    })

    .state('app.bpjs', {
      url: '/bpjs',
      views: {
        'tab-bpjs': {
          templateUrl: 'templates/app-bpjs.html',
          controller: 'BpjsCtrl'
        }
      }
    })
  
    .state('app.realtime', {
      url: '/realtime',
      views: {
        'tab-realtime': {
          templateUrl: 'templates/app-realtime.html',
          controller: 'RealtimeCtrl'
        }
      }
    })
  
    .state('app.tracker', {
      url: '/tracker',
      views: {
        'tab-tracker': {
          templateUrl: 'templates/app-tracker.html',
          controller: 'TrackerCtrl'
        }
      }
    })
  
    .state('app.account', {
      url: '/account',
      views: {
        'tab-account': {
          templateUrl: 'templates/app-account.html',
          controller: 'AccountCtrl'
        }
      }
    });

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/dash');
});
