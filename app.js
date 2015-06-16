var hoist = require('hoist-core');
var static = require('node-static');
var path = require('path');
var loggly = require('loggly');

var client = loggly.createClient({
  token: "16b6791a-18fc-4203-9c29-36fcb972d603",
  subdomain: "winch",
  tags: ["NodeJS"],
  json:true
});


var servers = {};

hoist.init();

var config = hoist.defaults;


if (!config.debug) {
  require('newrelic');
}

function createServer(request){
  var filePath = path.join(config.winch.directory,'app',request.application.fileBucket,request.environment.token);
  var server = new static.Server(filePath,{serverInfo: "hoist",gzip:true});
  hoist.logger.debug('setting up server for path',filePath);
  client.log('setting up server for path' + filePath);
  servers[request.application._id+':'+request.environment._id] = server;
  return server;
}

var router = require('./app/router');
var helper = require('./app/helperMethods');

var express = require('express');
var app = express();
app.use(express.bodyParser());
app.use(hoist.middleware.logging);
app.use(express.cookieParser());
app.use(function (request, response) {
  router
    .reroute(request)
    .then(function (rerouted) {
      if (!helper.isReservedPath(rerouted)) {
        hoist.logger.info('serving static path');
        client.log('serving static path');
        hoist.logger.debug("serving static file for " + request.url);
        client.log("serving static file for " + request.url);
        var server = servers[request.application._id+':'+request.environment._id]||createServer(request);
        server.serve(request, response);
      } else {
        hoist.logger.info('serving reserved path');
        hoist.logger.debug("serving reserved path for " + rerouted.url);
        helper.serveReservedPath(request, response);
      }
    }).fail(function (err) {
      hoist.logger.error(err);
      hoist.logger.debug('sending response');
      response.send(500, err.message);
    }).done();
});

module.exports = app;
