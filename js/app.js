/**
 * app.js
 *
 * App definition for the webSCA project.
 */

angular.module('webSCA', ['webSCAConfig', 'redhawkServices', 'webSCADirectives', 'redhawkDirectives', 'ngRoute', 'ui.bootstrap', 'hljs'])
  .config(['$routeProvider',
    function($routeProvider) {
      $routeProvider
        .when('/overview', {
          templateUrl: 'views/overview.html',
          controller: 'Overview'
        })
        .when('/waveforms/:action?', {
          templateUrl: 'views/waveforms.html',
          controller: 'Waveforms'
        })
        .when('/deviceManagers', {
          templateUrl: 'views/device-managers.html',
          controller: 'DeviceManagers'
        })
        .when('/manager/:managerId/device/:deviceId', {
          templateUrl: 'views/device.html',
          controller: 'Device'
        })
        .when('/plot/waveform/:waveformId/port/:portName/:dataType?', {
          templateUrl: 'views/plot.html',
          controller: 'Plot'
        })
        .when('/plot/waveform/:waveformId/component/:componentId/port/:portName/:dataType?', {
          templateUrl: 'views/plot.html',
          controller: 'Plot'
        })
        .otherwise({
                redirectTo: '/overview'
        });
    }
  ])
  .config(function (hljsServiceProvider) {
    hljsServiceProvider.setOptions({
      // replace tab with 4 spaces
      tabReplace: ' '
    });
  })
  .config(function($logProvider){
    $logProvider.debugEnabled(true);
  })
  .filter('reverse', function () {
    return function(items) {
      return items.slice().reverse();
    };
  })
  .filter('limit', function () {
    return function(items, num) {
      return items.slice(0, num);
    };
  })
  .factory('user', ['RedhawkDomain', function(RedhawkDomain){
      var user = {domain: undefined};

      RedhawkDomain.getDomainIds().$promise.then(function(data){
        user.domain = data[0];
      });
      return user;
  }])
  .controller('UserSettings', ['$scope', '$modal', 'user', '$timeout', 'RedhawkDomain',
    function($scope, $modal, user, $timeout, RedhawkDomain){
      $scope.user = user;
      $scope.domains = RedhawkDomain.getDomainIds();
      $scope.domains.$promise.then(function(data){
        if(data.length == 0) {
          $scope.addDomain();
        }
      });

      $scope.addDomain = function() {
        $modal.open({
          templateUrl: 'components/websca/templates/add-domain.html',
          controller: function ($scope, $modalInstance) {
            $scope.id = 'REDHAWK_DEV';
            $scope.name = 'REDHAWK_DEV';
            $scope.uri = 'localhost';

            $scope.add = function(id, name, uri){
              RedhawkDomain.addDomain(id,name,uri).then(function(){
                //The properties don't load immediately on the
                // back end, so this mitigates the issue.
                $timeout(function(){
                  user.domain = id;
                }, 2000);
              });
              $modalInstance.close();
            };
            $scope.close = function() {
              $modalInstance.close();
            }
          },
          size: 'sm'
        });
      };
    }
  ])
  .controller('Overview', ['$scope', 'RedhawkSocket',  'RedhawkDomain', 'user',
    function($scope, RedhawkSocket, RedhawkDomain, user) {
      $scope.user = user;
      $scope.$watch('user.domain', function(domainId){
        if(!domainId) return;

        $scope.redhawk = RedhawkDomain.getDomain(domainId);
        var events = $scope.redhawk.getEvents();

        $scope.messages = events.getMessages();
        $scope.channels = events.getChannelNames();
      });

      $scope.configure = function(properties) {
        var data = [];
        angular.forEach(properties, function(value, key){
          data.push({id: key, value: value});
        });
        $scope.redhawk.configure(data);
      };
    }
  ])
  .controller('Waveforms', ['$scope', 'RedhawkDomain', 'user', function($scope, RedhawkDomain, user) {
    $scope.user = user;
    $scope.$watch('user.domain', function(domainId) {
      $scope.redhawk = RedhawkDomain.getDomain(domainId);

      $scope.redhawk.getLaunchableWaveforms().then(function(waveforms){
        $scope.waveforms = waveforms;
      });

      $scope.currentWaveform = null;
    });

    $scope.setWaveform = function(id) {
      if(id)
        $scope.currentWaveform = id;
      return $scope.currentWaveform;
    };

    $scope.launch = function(name) {
      $scope.redhawk.launch(name).then(function(waveform){
        console.log(waveform);
        //$scope.setWaveform(waveform.identifier);
        $scope.redhawk._reload();
        $scope.redhawk.$promise.then(function(){
          $scope.setWaveform(waveform.identifier);
        });
      })
    };
  }])
  .controller('DeviceManagers', ['$scope', 'RedhawkDomain', 'user', function($scope, RedhawkDomain, user) {
    $scope.user = user;
    $scope.$watch('user.domain', function(domainId) {
      $scope.redhawk = RedhawkDomain.getDomain(domainId);

      $scope.deviceManagers = [];
      $scope.redhawk.$promise.then(function(data) {
        angular.forEach(data.deviceManagers, function (value) {
          $scope.deviceManagers.push($scope.redhawk.getDeviceManager(value.id));
        });
      });
    });

    $scope.$watch('redhawk.deviceManagers', function(deviceMgrs){
      if( deviceMgrs && deviceMgrs.length > 0 && deviceMgrs.indexOf($scope.currentManager) == -1) {
        $scope.setManager(deviceMgrs[0].id);
      }
    });

    $scope.setManager = function(id) {
      if(!id)
        return $scope.currentManager;

      $scope.manager = $scope.redhawk.getDeviceManager(id);

      $scope.currentManager = id;
      return $scope.currentManager;
    };

  }])
  .controller('Device', ['$scope', '$window', '$filter', '$routeParams', 'RedhawkDomain', 'user',
    function($scope, $window, $filter, $routeParams, RedhawkDomain, user){
      $scope.user = user;
      $scope.$watch('user.domain', function(domainId) {
        $scope.device = RedhawkDomain.getDomain(domainId).getDevice($routeParams.deviceId, $routeParams.managerId);
      });
    }
  ])
  .controller('Plot', ['$scope', '$routeParams', 'RedhawkSocket', 'user',
    function($scope, $routeParams, RedhawkSocket, user){

    $scope.waveformId = $routeParams.waveformId;
    $scope.componentId = $routeParams.componentId;
    $scope.name = $routeParams.portName;

    var dataType = $routeParams.dataType ? $routeParams.dataType : 'double';

    var defaultSettings = {
      xdelta: 0.0002,
      xstart: 0,
      xunits: 1,
      ydelta : 1,
      ystart: 0,
      yunits: 11,
      size: 1,
      subsize: 1000
    };
    $scope.plotSettings = angular.copy(defaultSettings);

    $scope.useSRISettings = true;
    $scope.customSettings = angular.copy(defaultSettings);

    $scope.$watch('useSRISettings', function(value) {
      if(value) {
        $scope.customSettings = angular.copy($scope.plotSettings);
        setPlots($scope.plotSettings);
      }
    });

    var plot =  new sigplot.Plot(document.getElementById("plot"), {
      all: true,
      expand: true,
      autohide_panbars: true,
      gridBackground: ["rgba(255,255,255,1", "rgba(200,200,200,1"],
      xi: true,
      fillStyle: ["rgba(224, 255, 194, 0.0)", "rgba(0, 153, 51, 0.7)", "rgba(0, 0, 0, 1.0)"]
    });
    var layer = plot.overlay_array(null, defaultSettings);

    var raster =  new sigplot.Plot(document.getElementById("raster"), {
      all: true,
      expand: true,
      autol: 100,
      autohide_panbars: true,
      colors: {bg: "rgba(255,255,255,1)", fg: "rgba(0,0,0,1)"}
    });
    var layer2 = raster.overlay_pipe(angular.extend({type : 2000}, defaultSettings));

    raster.mimic(plot, {xzoom: true, unzoom: true});

    var setLayer = function(layer, settings) {
      var newSettings = angular.copy(settings);

      layer.xstart = newSettings['xstart'];
      layer.xdelta = newSettings['xdelta'];
      layer.ystart = newSettings['ystart'];
      layer.ydelta = newSettings['ydelta'];
      layer.xlab   = newSettings['xunits'];
      layer.ylab   = newSettings['yunits'];
    };

    var setPlots = function(settings) {
      if(settings['yunits'] == 0)
        settings['yunits'] = 11;

      var plotLayer = plot.get_layer(layer);
      plotLayer.hcb.size = settings['size'];
      setLayer( plotLayer, settings );

      var rasterLayer = raster.get_layer(layer2);
      rasterLayer.hcb.subsize = settings['subsize'];
      setLayer( rasterLayer, settings );
    };

    $scope.updateCustomSettings = function() {
      if(!$scope.useSRISettings) {
        setPlots($scope.customSettings);
      }
    };

    var getDataConverter = (function(){
      /*
       Create a map to convert the standard REDHAWK BulkIO Formats
       into Javascript equivalents.
       ----
       byte      = 8-bit signed
       char      = 8-bit unsigned
       octet     = 8-bit The signed-ness is undefined
       short     = 16-bit signed integer
       ushort    = 16-bit unsigned integer
       long      = 32-bit signed integer
       ulong     = 32-bit unsigned integer
       longlong  = 64-bit signed integer
       ulonglong = 64-bit unsigned integer
       float     = 32-bit floating point
       double    = 64-bit floating point
       ----
       */
      var conversionMap = {
        byte: Int8Array,
        char: Uint8Array,
        octet: Uint8Array,
        ushort: Uint16Array,
        short: Int16Array,
        long: Int32Array,
        ulong: Uint32Array,
        longlong: undefined, //This should be 64-bit
        ulonglong: undefined, //This should be 64-bit
        float: Float32Array,
        double: Float64Array
      };
      var defaultConversion = Float32Array;

      return function(type) {
        var fn = conversionMap[type];
        console.log("Requesting dataconverter for type '"+type+"'."+fn);

        if(type == 'octet')
          console.log("Plot::DataConverter::WARNING - Data type is 'octet' assuming unsigned.");

        if(!fn) {
          console.log("Plot::DataConverter::WARNING - Data type is '"+type+"' using default.");
          fn = defaultConversion;
        }

        return function(data) { return new fn(data); };
      };
    })();
    var dataConverter = getDataConverter(dataType);

    var lastDataSize = 1000;
    var on_data = function(data){
      var array = dataConverter(data);

      lastDataSize = array.length;

      plot.reload(layer, array );
      raster.push(layer2, array );
    };

    var updatePlotSettings = function(data) {
      var isDirty = false;
      angular.forEach(data, function(item, key){
        if(angular.isDefined($scope.plotSettings[key]) && !angular.equals($scope.plotSettings[key], item)) {
          isDirty = true;
          console.log("Plot settings change "+key+": "+$scope.plotSettings[key]+" -> "+item);
          $scope.plotSettings[key] = item;
        }
      });

      $scope.plotSettings['size'] = lastDataSize * $scope.plotSettings['xdelta'];
      if(data['subsize'] == 0) {
        $scope.plotSettings['subsize'] = lastDataSize;
      }

      if(isDirty && $scope.useSRISettings) {
        setPlots($scope.plotSettings);

        $scope.customSettings = angular.copy($scope.plotSettings);
      }
    };

    var sriData = {};
    var on_sri = function(sri) {
      updatePlotSettings(sri);

      angular.forEach(sri, function(value, key){
        if(angular.isArray(value)) {
          sriData[key] = value.join(", ");
        } else if(angular.isObject(value)) {
          var str = [];
          angular.forEach(value, function(value, key) {
            str.push(key+": "+value);
          });
          sriData[key] = str.join(', ');
        } else {
          sriData[ key ] =  value;
        }
      });

      $scope.sri = sriData;
    };

    $scope.port = RedhawkSocket.port(
        {domain: user.domain, waveform: $scope.waveformId, component: $scope.componentId, port: $scope.name},
        on_data,
        on_sri
    );

    $scope.$on("$destroy", function(){
      $scope.port.close();
    })
  }])
;