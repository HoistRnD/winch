var request = require('supertest'),
  hoist = require('hoist-core'),
  //mongoose = require('mongoose-q')(),
  Application = hoist.models.Application,
  Organisation = hoist.models.Organisation,
  User = hoist.models.User,
  Invite = hoist.models.Invite,
  SearchIndex = hoist.models.SearchIndex,
  q = hoist.q,
  http = require('http'),
  helper = require('../../app/helperMethods'),
  app = require('../../app');

describe('getting settings', function () {
  describe('for a registered application, using default host', function () {
    var responseReceived;
    before(function () {
      responseReceived =

      new Organisation().saveQ().
      then(function (org) {
        return new Application({
          apiKey: '_api_key',
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          environments: [{
            name: '_default',
            token: 'token',
            default: true,
            settings: {
              "name": "value"
            }
          }]
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/settings')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it("should return 200 response", function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
    it('should return the correct settings for the page', function () {
      return responseReceived.then(function (response) {
        response.body.should.eql({
          "name": "value",
          "environment": "_default",
          "apiKey": "_api_key",
          "subDomain": "sparkle-motion"
        });
      });
    });
    after(function (done) {
      Application.remove({}, function () {
        Organisation.remove({}, done);
      });
    });
  });
});

describe('app uri requests, ', function () {
  this.timeout(4000);
  describe('for an applicaiton domain that is registered', function () {
    var responseReceived;
    before(function () {
      responseReceived =

      new Organisation().saveQ().
      then(function (org) {
        return new Application({
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          fileBucket: 'app1',
          environments: [{
            name: '_default',
            token: 'token',
            default: true
          }]
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/index.html')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(200);
      });
    });
    it('should return content of index', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("<html>\n<head>\n</head>\n<body>\nthis is app 1\n</body>\n</html>\n");
      });
    });

    after(function (done) {
      Application.remove({}, function () {
        done();
      });
    });
  });
  describe('for an root of domain that is registered', function () {
    var responseReceived;
    before(function () {
      responseReceived = new Organisation().saveQ().then(function (org) {
        return new Application({
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          fileBucket: 'app2',
          environments: [{
            name: '_default',
            token: 'token',
            default: true
          }]
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(200);
      });
    });
    it('should return content of index', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("<html>\n<head>\n</head>\n<body>\nthis is app 2\n</body>\n</html>\n");
      });
    });
    after(function (done) {
      Application.remove({}, function () {
        done();
      });
    });
  });
  describe('accept invite url for a non registered application', function () {
    var responseReceived;
    before(function () {
      responseReceived = new Organisation().saveQ().then(function (org) {
        return new Application({
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          fileBucket: 'app2',
          environments: [{
            name: '_default',
            token: 'token',
            default: true
          }]
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/acceptInvite?code=MYCODE')
          .set('host', 'not-valid.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 500 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(500);
      });
    });
    it('should return not found body', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("unable to find application");
      });
    });
    after(function (done) {
      Application.remove({}, function () {
        Organisation.remove({}, done);
      });
    });
  });
  describe('accept invite url for a registered application', function () {
    var responseReceived;
    var oldHandleRequest;
    before(function () {
      responseReceived = new Organisation().saveQ().then(function (org) {
        return new Application({
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          fileBucket: 'app2',
          environments: [{
            name: '_default',
            token: 'token',
            default: true
          }]
        }).saveQ().then(function (app) {
          oldHandleRequest = helper.handleEnvironmentRequest;
          helper.handleEnvironmentRequest = function () {
            return q.fcall(function () {
              return {
                body: 'This is the test body'
              };
            });
          };
          return app.saveQ();
        });
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/acceptInvite?code=MYCODE')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(200);
      });
    });
    it('should return default invite text', function () {
      return responseReceived.then(function (response) {
        response.text.should.contain("This is the test body");
      });
    });
    after(function (done) {
      helper.handleEnvironmentRequest = oldHandleRequest;
      Invite.remove({}, function () {
        Application.remove({}, function () {
          Organisation.remove({}, function () {
            User.remove({}, done);
          });
        });
      });
    });
  });
  describe('accept invite POST for a registered application', function () {
    var responseReceived;
    before(function () {
      responseReceived = new Organisation().saveQ().then(function (org) {
        return new Application({
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          fileBucket: 'app2',
          environments: [{
            name: '_default',
            token: 'token',
            default: true
          }]
        }).saveQ();
      }).then(function (application) {
        return new User({
          emailAddresses: [{
            address: 'test@hoi.io'
          }]
        }).saveQ().then(function (user) {
          var member = application.environments[0].members.create({
            userId: user._id,
            role: 'Member'
          });
          application.environments[0].members.push(member);
          return application.saveQ()
            .then(function (app) {
              application = app;
              return new Invite({
                application: application._id,
                member: application.environments[0].members[0]._id,
                environment: application.environments[0]
              }).saveQ();
            });
        }).then(function (invite) {
          var r = request(http.createServer(app))
            .post('/acceptInvite?code=' + invite.activationCode)
            .send({
              inviteCode: invite.activationCode,
              password: 'Password123'
            })
            .set('host', 'sparkle-motion.app.hoi.io');
          return q.ninvoke(r, "end");
        });
      });
    });
    it('should return 302 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(302);
      });
    });
    it('should mark member as active', function () {
      return responseReceived.then(function () {
        return Application.findOneQ({});
      }).then(function (application) {
        application.environments[0].members[0].status.should.eql('ACTIVE');
      });
    });
    it('should save the member password', function () {
      return responseReceived.then(function () {
        return Application.findOneQ({});
      }).then(function (application) {
        application.environments[0].members[0].verifyPassword("Password123").should.eql(true);
      });
    });
    after(function (done) {
      Invite.remove({}, function () {
        Application.remove({}, function () {
          Organisation.remove({}, function () {
            User.remove({}, done);
          });
        });
      });
    });
  });
  describe('non existing file for an root of domain that is registered', function () {
    var responseReceived;
    before(function () {
      responseReceived =
        new Organisation().saveQ().then(function (org) {
          return new Application({
            ownerOrganisation: org._id,
            subDomain: 'sparkle-motion',
            fileBucket: 'app2',
            environments: [{
              name: '_default',
              token: 'token',
              default: true
            }]

          }).saveQ();
        }).then(function () {
          var r = request(http.createServer(app))
            .get('/not_here.js')
            .set('host', 'sparkle-motion.app.hoi.io');
          return q.ninvoke(r, "end");
        });
    });
    it('should return 404 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(404);
      });
    });
    it('should return not found body', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("");
      });
    });
    after(function (done) {
      Application.remove({}, function () {
        done();
      });
    });
  });
  describe('for an applicaiton domain that is not registered', function () {
    var responseReceived;
    before(function () {
      responseReceived =
        new Organisation().saveQ().then(function (org) {
          return new Application({
            ownerOrganisation: org._id,
            name: "test_app",
            fileBucket: 'app2',
            apiKey: 'api1',
            environments: [{
              name: '_default',
              token: 'token',
              default: true
            }]
          }).saveQ().then(function () {
            var r = request(http.createServer(app))
              .get('/index.html')
              .set('host', 'not-here.app.hoi.io');
            return q.ninvoke(r, "end");
          });
        });
    });
    it('should return 500 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(500);
      });
    });
    it('should return not found body', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("unable to find application");
      });
    });
    after(function (done) {
      Application.remove({}, function () {
        done();
      });
    });
  });
  describe('for an ajax escaped url for a registered application', function () {
    var responseReceived;
    before(function () {
      var saveEntities = [
        new SearchIndex({
          pages: [{
            path: '/#!test',
            content: "<html>\n<head>\n</head>\n<body>\nthis is test\n</body>\n</html>"
          }]
        }).saveQ(),
        new Organisation().saveQ()
      ];
      responseReceived = q.allSettled(saveEntities).then(function (entities) {
        return new Application({
          ownerOrganisation: entities[1].value._id,
          environments: [{
            name: '_default',
            token: 'default',
            searchIndex: entities[0].value._id,
            isDefault: true
          }],
          subDomain: 'sparkle-motion'
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/?_escaped_fragment_=test')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 200 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(200);
      });
    });
    it('should return content of #!test', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("<html>\n<head>\n</head>\n<body>\nthis is test\n</body>\n</html>");
      });
    });
    after(function (done) {
      SearchIndex.remove({}, function () {
        Organisation.remove({}, function () {
          Application.remove({}, done);
        });
      });
    });
  });
  describe('for a non-existant ajax escaped url for a registered application', function () {
    var responseReceived;
    before(function () {
      var saveEntities = [
        new SearchIndex({
          pages: [{
            path: '/#!test',
            content: "<html>\n<head>\n</head>\n<body>\nthis is test\n</body>\n</html>"
          }]
        }).saveQ(),
        new Organisation().saveQ()
      ];
      responseReceived = q.allSettled(saveEntities).then(function (entities) {
        return new Application({
          ownerOrganisation: entities[1].value._id,
          environments: [{
            name: '_default',
            token: 'default',
            searchIndex: entities[0].value._id,
            isDefault: true
          }],
          subDomain: 'sparkle-motion'
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/?_escaped_fragment_=not')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 404 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(404);
      });
    });
    it('should return blank body', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal('{}');
      });
    });
    after(function (done) {
      SearchIndex.remove({}, function () {
        Organisation.remove({}, function () {
          Application.remove({}, done);
        });
      });
    });
  });
  describe('HEAD request for root', function () {
    var responseReceived;
    before(function () {
      responseReceived = new Organisation().saveQ().then(function (org) {
        return new Application({
          ownerOrganisation: org._id,
          subDomain: 'sparkle-motion',
          fileBucket: 'app2',
          environments: [{
            name: '_default',
            token: 'token',
            default: true
          }]

        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .head('/')
          .set('host', 'sparkle-motion.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should not throw an error', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.eql(200);
      });
    });
    after(function (done) {

      Organisation.remove({}, function () {
        Application.remove({}, done);
      });
    });
  });
  describe('for an ajax escaped url for an unregistered application', function () {
    var responseReceived;
    before(function () {
      var saveEntities = [
        new SearchIndex({
          pages: [{
            path: '/#!test',
            content: "<html>\n<head>\n</head>\n<body>\nthis is test\n</body>\n</html>"
          }]
        }).saveQ(),
        new Organisation().saveQ()
      ];
      responseReceived = q.allSettled(saveEntities).then(function (entities) {
        return new Application({
          ownerOrganisation: entities[1].value._id,
          environments: [{
            name: '_default',
            token: 'default',
            searchIndex: entities[0].value._id,
            isDefault: true
          }]
        }).saveQ();
      }).then(function () {
        var r = request(http.createServer(app))
          .get('/?_escaped_fragment_=test')
          .set('host', 'not-here.app.hoi.io');
        return q.ninvoke(r, "end");
      });
    });
    it('should return 500 response', function () {
      return responseReceived.then(function (response) {
        response.statusCode.should.equal(500);
      });
    });
    it('should return not found body', function () {
      return responseReceived.then(function (response) {
        response.text.should.equal("unable to find application");
      });
    });
    after(function (done) {
      SearchIndex.remove({}, function () {
        Organisation.remove({}, function () {
          Application.remove({}, done);
        });
      });
    });
  });
});
