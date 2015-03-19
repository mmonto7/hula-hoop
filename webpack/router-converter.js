var _ = require('underscore'),
    remapRoute = require('../lib/remap-route');

module.exports = exports = function() {};

exports.prototype.apply = function(compiler) {
  compiler.plugin('compilation', function(compilation) {
    compilation.plugin('circus-json', function(json) {
      if (json.routes) {
        if (!json.chunkDependencies) {
          throw new Error('Must be run in conjunction with the chunk dependencies plugin');
        }

        var componentName = compilation.options.output.component,
            components = compilation.options.components;
        var remapped = {
          routes: {},
          modules: {}
        };

        // Record the route to chunk mapping
        _.each(json.routes, function(moduleId, route) {
          remapped.routes[remapRoute(route)] = componentName + '_' + json.modules[moduleId].chunk;
        });

        _.each(json.chunks, function(chunk, id) {
          var dependencies = json.chunkDependencies[componentName + '_' + id];

          remapped.modules[componentName + '_' + id] = {
            js: _.map(dependencies.js, function(dependency) {
              return {href: mapFile(dependency.href, compilation), attr: 'data-circus-jsid="' + dependency.id + '"'};
            }),
            css: _.map(dependencies.css, function(dependency) {
              return {href: mapFile(dependency.href, compilation), attr: 'data-circus-cssid="' + dependency.id + '"'};
            }),

            serverRender: !!json.serverRender
          };
        });

        json.hulahoop = remapped;
      }
    });
  });
};

function mapFile(href, compilation) {
  if (!/\/\//.test(href) && !/^\//.test(href)) {
    return (compilation.options.output.publicPath || '') + href;
  } else {
    return href;
  }
}
