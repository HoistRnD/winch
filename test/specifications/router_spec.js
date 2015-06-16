'use strict';
var router = require('../../app/router'),
	hoist = require('hoist-core'),
	Application = hoist.models.Application,
	Organisation = hoist.models.Organisation;


describe('router', function() {
	var app1;
	var app2;
	var app3;
	before(function(done) {
		new Organisation().save(function(err, org) {
			new Application({
				ownerOrganisation: org._id,
				fileBucket: 'app_1',
				subDomain: 'sparkle-motion-painer',
				environments: [{
					name: '_default',
					default: true,
          token:'token1',
					settings: {
						name: 'default'
					},
				}, {
					name: 'dev',
          token:'token2',
					settings: {
						name: 'dev'
					}
				}]
			}).save(function(err, app) {
				app1 = app;
				new Application({
					ownerOrganisation: org._id,
					fileBucket: 'app_2',
					subDomain: 'frank',
					environments: [{
						name: '_default',
            token:'token3',
						default: true,
						settings: {
							name: 'other default'
						}
					}]
				}).save(function(err, a2) {
					app2 = a2;
					new Application({
						ownerOrganisation: org._id,
						fileBucket: 'app_3',

						subDomain: 'cnamed',
						environments: [{
              token:'token4',
							name: '_default',
							default: true,
							settings: {
								name: 'other default'
							}
						},
						{
              token:'token5',
							name: 'live',
							default: false,
							cname:'testdomain.hoistapps.com',
							settings: {
								name: 'some live app'
							}
						}]
					}).save(function(err, a3) {
						app3 = a3;
						done();
					});
				});

			});
		});

	});
	after(function(done) {
		Application.remove({}, function() {
			Organisation.remove({}, done);
		});
	});
	describe('routing a known url default', function() {
		var result;
		before(function() {
			var request = {
        logger: require('hoist-core').logger,
				headers: {
					host: 'sparkle-motion-painer.app.hoi.io:8080'
				},
				url: '/javascript/my_js.js'
			};
			result = router.reroute(request);
		});
		it('should set the correct host_token', function() {
			return result.then(function(rerouted) {

				rerouted.host_token.should.equal('app_1-token1-app');
			});
		});
		it('should set the correct application on request', function() {
			return result.then(function(rerouted) {
				rerouted.application.equals(app1).should.eql(true);
			});
		});
		it('should set the correct envrionment on a request', function() {
			return result.then(function(rerouted) {
				rerouted.environment.settings.name.should.equal('default');
			});
		});
	});
	describe('routing a known environment url default', function() {
		var result;
		before(function() {
			var request = {
        logger: require('hoist-core').logger,
				headers: {
					host: 'sparkle-motion-painer-dev.app.hoi.io:8080'
				},
				url: '/javascript/my_js.js'
			};
			result = router.reroute(request);
		});
		it('should set the correct host_token', function() {
			return result.then(function(rerouted) {

				rerouted.host_token.should.equal('app_1-' + app1.environments[1].token + '-app');
			});
		});
		it('should set the correct application on request', function() {
			return result.then(function(rerouted) {
				rerouted.application.equals(app1).should.eql(true);
			});
		});
		it('should set the correct envrionment on a request', function() {
			return result.then(function(rerouted) {
				rerouted.environment.settings.name.should.equal('dev');
			});
		});
	});
	describe('routing a different know default url', function() {
		var result;
		before(function() {
			var request = {
        logger: require('hoist-core').logger,
				headers: {
					host: 'frank.app.hoi.io:9999'
				},
				url: '/javascript/my_js.js'
			};
			result = router.reroute(request);
		});
		it('should set the correct host token', function() {
			return result.then(function(rerouted) {
				rerouted.host_token.should.equal('app_2-token3-app');
			});
		});
		it('should set the correct application on request', function() {
			return result.then(function(rerouted) {
				rerouted.application.equals(app2).should.eql(true);
			});
		});
		it('should set the correct environment on a request', function() {
			return result.then(function(rerouted) {
				rerouted.environment.settings.name.should.equal('other default');
			});
		});
	});
	describe('routing to a cname', function() {
		var result;
		before(function() {
			var request = {
        logger: require('hoist-core').logger,
				headers: {
					host: 'testdomain.hoistapps.com:9999'
				},
				url: '/javascript/my_js.js'
			};
			result = router.reroute(request);
		});
		it('should set the correct host token', function() {
			return result.then(function(rerouted) {
				rerouted.host_token.should.equal('app_3-'+app3.environments[1].token+'-app');
			});
		});
		it('should set the correct application on request', function() {
			return result.then(function(rerouted) {
				rerouted.application.equals(app3).should.eql(true);
			});
		});
		it('should set the correct environment on a request', function() {
			return result.then(function(rerouted) {
				rerouted.environment.settings.name.should.equal('some live app');
			});
		});
	});
	describe('routing an unknown url', function() {
		var result;
		before(function() {
			var request = {
        logger: require('hoist-core').logger,
				headers: {
					host: 'unknown.app.hoi.io:9999'
				},
				url: '/javascript/my_js.js'
			};
			result = router.reroute(request);
		});
		it('should fail', function() {
			return result.should.be.rejectedWith('unable to find application');
		});
	});
});
