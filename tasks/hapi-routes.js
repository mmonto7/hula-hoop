var _ = require('underscore'),
    Lumbar = require('lumbar'),

    remapRoute = require('../lib/remap-route');

module.exports = function(grunt) {
  grunt.registerMultiTask('hapi-routes', 'outputs a projects module map', function() {
    var done = this.async();

    var config = this.options({config: './lumbar.json'}),
        lumbarFile = config.config,
        outputFile = config.dest;

    var options = _.omit(config, 'config', 'dest', 'package'),
        lumbar = Lumbar.init(lumbarFile, options);

    lumbar.moduleMap(config.package, {routeCallbacks: true, localPath: true}, function(err, map) {
      if (err) {
        throw err;
      }

      var ret = {
        modules: {},
        routes: {},
        loadPrefix: ''
      };

      // Extract any maps that are embedded in the response
      function processMap(map, package) {
        if (map.isMap) {
          ret.loadPrefix = ret.loadPrefix || map.loadPrefix;

          _.each(map.modules, function(module, moduleName) {
            ret.modules[moduleName] = resolveModule(ret, map, moduleName);
          });

          // Record the route -> module mapping
          _.each(map.routes, function(moduleName, route) {
            var hapiRoute = remapRoute(route);
            ret.routes[hapiRoute] = moduleName;
            ret.modules[moduleName].routes[hapiRoute] = map.modules[moduleName].routes[route];
          });
        } else {
          // Walk the structure to try to find map objects
          _.each(map, function(map, name) {
            // This sneaky bit extracts the package and platform name, based on the nesting,
            // while still supporting non-named platforms
            processMap(map, package || name, package ? name : undefined);
          });
        }
      }
      processMap(map);

      grunt.file.write(outputFile, JSON.stringify(ret, undefined, 2));
      done();
    });
  });
};


// Determines all of the dependency information needed to load a module in one pass
function resolveModule(ret, map, moduleName) {
  /*jshint boss:true */
  if (ret.modules[moduleName]) {
    return ret.modules[moduleName];
  }

  var module = map.modules[moduleName];
  var hapiModule = {
    module: moduleName,
    serverRender: module.serverRender,

    routes: {},
    js: [map.base.js],
    css: [selectCSS(map.base)]
  };

  // Merge any dependencies in order
  if (module.depends) {
    _.each(module.depends, function(moduleName) {
      var depend = resolveModule(ret, map, moduleName);
      hapiModule.js = _.union(hapiModule.js, depend.js);
      hapiModule.css = _.union(hapiModule.css, depend.css);
    });
  }

  hapiModule.js = _.compact(_.union(hapiModule.js, module.js));
  hapiModule.css = _.compact(_.union(hapiModule.css, selectCSS(module)));

  ret.modules[moduleName] = hapiModule;
  return hapiModule;
}

// Selects the "best option" CSS file. Of there are multiple css source files this will
// select the highest pixel ratio version.
function selectCSS(module) {
  // A bit of a hack, but just select the largest dpr available or fail over to
  // the first entry if nothing defineds a greater than value
  var css = module.css;
  if (_.isArray(css)) {
    css = _.filter(module.css, function(css) { return css.minRatio; });
    css = _.sortBy(css, 'minRatio');
    css = _.last(css);
  }
  return css && css.href;
}
