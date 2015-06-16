var
	hoist = require('hoist-core'),
  q = hoist.q,
	Application = hoist.models.Application,
	url = require('url'),
	_ = require('lodash');

var Router = function() {

};
var self;

Router.prototype = {
	findApplication: function(request) {
		var host = url.parse("http://" + request.headers.host).hostname;
		var suffix = '.app.'+hoist.utils.defaults.domains.api;
		//console.log(suffix);
		var isCname = host.indexOf(suffix, host.length - suffix.length) === -1;
		host = host.replace('.app.'+hoist.utils.defaults.domains.api, '');
		var altHost;
		if (!isCname) {

			var parts = host.split('-');

			if (parts.length > 1) {
				_.each(_.first(parts, parts.length - 1), function(part) {
					altHost = altHost || '';
					if (altHost.length > 0) {
						altHost += '-';
					}
					altHost += part;
				});
			}
		}

		var query = Application.findOne({
			'subDomain': host
		});
		if(isCname){
			query = Application.findOne({
				'environments.cname':host
			});
		}
		else if (altHost) {
			query = Application.findOne({$or:
				[{
				'subDomain': host
			}, {
				'subDomain': altHost
			}]});
		}

		return query.execQ();
	},
	selectEnvironment: function(request, application) {
		var host = url.parse("http://" + request.headers.host).hostname;
		host = host.replace('.app.'+hoist.utils.defaults.domains.api, '');

		return _.find(application.environments, function(environment) {
			return environment.host === host||environment.cname===host;
		}) || _.find(application.environments, function(environment) {
			return environment.default;
		});
	},
	reroute: function(request) {

		return q.fcall(function() {
			return self.findApplication(request)
				.then(function(application) {
					if (!application) {
						throw new Error('unable to find application');
					}
					application.save();
					//request.url = "/"+application.fileBucket.toLowerCase()+"-app"+request.url;

					request.application = application;
					request.environment = self.selectEnvironment(request, application);
					var environmentModifier = '';
					if(request.environment){
            request.logger.log('using environment',request.environment.token);
						environmentModifier = '-'+request.environment.token;
					}
					request.host_token = application.fileBucket.toLowerCase()+ environmentModifier + "-app";
					request.logger.log('using bucket',request.host_token);
					return request;
				});

		});
	}
};

module.exports = self = new Router();
