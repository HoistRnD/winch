var hoist = require('hoist-core'),
  url = require('url'),
  _ = require('lodash'),
  config = hoist.defaults,
  kue = require('kue').createQueue({
    redis: {
      port: config.kue.redis.port,
      host: config.kue.redis.host,
    }
  }),
  q = hoist.q,
  extend = require('extend');

var Helper = function () {

};
var self;

Helper.prototype = {
  getId: function () {
    return require('uuid').v4();
  },
  isReservedPath: function (req) {

    var path = url.parse(req.url).pathname;
    var searchRegex = /\?_escaped_fragment_=(.*)/;
    var scriptRegex = /^\/hoist\/([^\/]*)/;
    var route = {};
    if (searchRegex.test(req.url)) {
      hoist.logger.info('path matched a search route');
      route.path = req.url.replace(searchRegex, '#!' + decodeURIComponent('$1'));
      route._type = 'search';
    } else if (scriptRegex.test(path)) {
      hoist.logger.info('path matched a script route');
      var match = path.match(scriptRegex);
      if (match.length > 1) {
        route.path = 'hoist/scripts/' + req.method.toLowerCase() + match[1] + '.js';
        route._type = 'script';
      }
    } else {
      route = _.find(req.application.routes, function (value, key) {
        if (value.path === path) {
          req.routeKey = key;
          hoist.logger.info('path matched an application route');
          return true;
        }
      });
    }
    if (route) {
      hoist.logger.info('route found of type',route._type);
      req.route = route;
      return true;
    }
    return false;
  },
  handleEnvironmentRequest: function (environment, request) {
    return environment.handleRequest(request);
  },
  serveReservedPath: function (request, response) {
    var self = this;
    hoist.logger.info('serving reserved path');
    switch (request.route._type) {
    case 'script':
      //find the correct js file
      hoist.logger.info('running a script task', request.route.path);
      hoist.models.FileIndex.findOneQ({
        application: request.application._id,
        environment: request.environment._id
      }).then(function (fileIndex) {
        var file;
        if (fileIndex) {
          hoist.logger.debug('finding file in index');
          file = _.find(fileIndex.files, function (f) {
            return f.path.toLowerCase() === request.route.path.toLowerCase();
          });
        }
        if (!file) {
          hoist.logger.warn('unable to find file in index');
          throw new hoist.errors.request.NotFound("File not found");
        }
        hoist.logger.debug('getting file content');
        return request.environment.getFile(file.path)
          .then(function (content) {
            hoist.logger.debug('creating job');
            var originalHeaders = _.clone(request.headers);
            delete originalHeaders['x-forwarded-for'];
            delete originalHeaders['x-real-ip'];
            delete originalHeaders['x-forwarded-proto'];
            var id = self.getId();
            var job = {
              id: id,
              script: content,
              request: {
                url: request.url,
                headers: originalHeaders,
                ip: request.headers['x-real-ip'] || request.headers['x-forwarded-for'] || request.ip,
                body: request.body,
                query: request.query,
                host: request.host
              },
              sessionId: hoist.auth.session(hoist.logger).getSessionId(request),
              applicationId: request.application._id,
              environmentId: request.environment._id,
              applicationSubDomain: request.application.subDomain,
              environmentToken: request.environment.token,
              tid: hoist.tid
            };

            var channel = 'run:script:results:' + id;
            hoist.logger.debug('listening to channel', channel, 'on host', config.redis.host, 'port', config.redis.port);
            var client = require('redis').createClient(config.redis.port, config.redis.host);
            var timeout;
            client.once('message', function (channel, message) {
              hoist.logger.debug('message receieved', message);
              clearTimeout(timeout);
              client.removeAllListeners('message');
              client.unsubscribe(channel);
              client.end();
              message = JSON.parse(message);
              response.send(message.result.status || 200, message.result.response);
            });
            timeout = setTimeout(function () {
              hoist.logger.debug('timeout tick\'d');
              client.removeAllListeners('message');
              client.unsubscribe(channel);
              client.end();
              response.send(201, {
                jobId: id
              });
            }, 20000);
            hoist.logger.debug('subscribing to channel', channel);
            client.subscribe(channel);
            kue.create('run:script', job).save();

          });

      }).fail(function (err) {
        if (!err.resCode) {
          hoist.logger.error(err);
          err = new hoist.errors.server.ServerError();
        }
        response.send(err.resCode, err.message);
      }).done();
      break;
      //load the contents of the file
      //put a job on the queue to run the file
      //wait for a result over redis
    case 'content':
      q.fcall(function () {
        return self.handleEnvironmentRequest(request.environment, request).then(
          function (res) {
            if (res.redirect) {
              response.redirect(res.redirect);
            } else {
              response.send(200, res.body);
            }
          });
      }).fail(function (err) {
        if (!err.resCode) {
          hoist.error(err, request, request.application);
        }
        response.send(err.resCode || 500, err.message ||
          "Oops, an error occured");
      }).done();
      break;
    case 'special':
      var defaultEnvironment = _.find(request.application.environments,
        function (environment) {
          return environment.default;
        }) || {};
      var settings = extend(defaultEnvironment.settings, request.environment.settings);
      settings.environment = request.environment.name;
      settings.apiKey = request.application.apiKey;
      settings.subDomain = request.environment.host;
      response.send(settings);
      break;
    case 'search':
      hoist.models.SearchIndex.findByIdQ(request.environment.searchIndex)
        .then(function (searchIndex) {
          if (!searchIndex) {
            response.status(404);
            response.send({});
            return;
          }
          var page = _.find(searchIndex.pages, function (p) {
            return p.path === request.route.path; // might need to be changed for case with meta tag ie original path does not contain #!
          });
          if (page) {
            response.set('Content-Type', 'text/html');
            response.send(200, page.content);
          } else {
            response.status(404);
            response.send({});
          }
        }).fail(function (error) {
          hoist.error(error, request, request.user);
          response.send(500, error.message);
        }).done();
      break;
    }
  }
};

module.exports = self = new Helper();
