'use strict';
var helper = require('../../app/helperMethods'),
  hoist = require('hoist-core'),
  sinon = require('sinon'),
  kue = require('kue'),
  q = hoist.q;

describe('Helper', function() {
  describe('#isReservedPath', function() {
    describe('if request is for a script path GET request', function() {
      var request = {
        url: "/hoist/newContacts",
        method: "GET",
        application: {}
      };
      var result;
      before(function() {
        result = helper.isReservedPath(request);
      });
      it('should return true', function() {
        result.should.eql(true);
      });
      it('should set request route time to script', function() {
        request.route._type.should.eql('script');
      });
      it('should set script path', function() {
        request.route.path.toLowerCase().should.eql('hoist/scripts/getnewcontacts.js');
      });
    });
    describe('if request is for a script path POST request', function() {
      var request = {
        url: "/hoist/newContacts",
        method: "POST",
        application: {}
      };
      var result;
      before(function() {
        result = helper.isReservedPath(request);
      });
      it('should return true', function() {
        result.should.eql(true);
      });
      it('should set request route time to script', function() {
        request.route._type.should.eql('script');
      });
      it('should set script path', function() {
        request.route.path.toLowerCase().should.eql('hoist/scripts/postnewcontacts.js');
      });
    });
  });
  describe('#serveReservedPath', function() {
    describe('if the request is for a script route', function() {

      var request = {
        application: {
          _id: hoist.mongoose.Types.ObjectId(),
          subDomain:'sub-domain',
          apiKey:'applicationApiKey'
        },
        environment: {
          _id: hoist.mongoose.Types.ObjectId()
        },
        headers: {
          'some-header': 'someValue',
          'x-forwarded-for': 'ip-address'
        },
        cookies:{
          'hoist-session-applicationapikey':'s:dcSRCKkI0er4N4CkjxM0ogTC.viSzzM8qjT3J+UQZJjIbfT7ewNpPCcW9TJqcpgWmysw'
        },
        url: '/hoist/newContacts',
        ip: 'other-ip',
        body: {
          'bodyKey': 'bodyVal'
        },
        query: {
          'queryKey': 'queryVal'
        },
        route: {
          path: 'hoist/scripts/getnewContacts',
          _type: 'script'
        }
      };
      describe('and theres no matching file in the index', function() {
        var responseReceived = q.defer();
        before(function() {
          new hoist.models.FileIndex({
            application: request.application._id,
            environment: request.environment._id,
            files: []
          }).saveQ().then(function() {
            var response = {
              send: function() {
                responseReceived.resolve(arguments);
              }
            };
            helper.serveReservedPath(request, response);
          }).done();
        });
        it('should return a 404 response', function() {
          return responseReceived.promise.spread(function(code, response) {
            code.should.eql(404);
            response.should.eql('File not found');
          });
        });
        after(function(done) {
          hoist.models.FileIndex.remove({}, done);
        });
      });
      describe('and theres no file index for the application', function() {
        var responseReceived = q.defer();
        before(function() {

          var response = {
            send: function() {
              responseReceived.resolve(arguments);
            }
          };
          helper.serveReservedPath(request, response);
        });
        it('should return a 404 response', function() {
          return responseReceived.promise.spread(function(code, response) {
            code.should.eql(404);
            response.should.eql('File not found');
          });
        });
      });
      describe('and there is a file [with a different case] matching the path, and the script takes more than 20s to respond', function() {
        var responseReceived = q.defer();
        var loadedFilePath;
        var savedJobName;
        var clock;
        var savedJobData;
        var saved;
        this.timeout(3000);
        before(function() {
          request.environment.getFile = function(filePath) {
            return q.fcall(function() {
              loadedFilePath = filePath;
              return 'file content';
            });
          };
          clock = sinon.useFakeTimers();
          sinon.stub(kue.singleton, 'create', function(jobName, data) {
            savedJobData = data;
            savedJobName = jobName;
            return {
              save: function() {
                saved = true;
              }
            };
          });

          new hoist.models.FileIndex({
            application: request.application._id,
            environment: request.environment._id,
            files: [{
              path: 'Hoist/Scripts/getNewContacts'
            }]
          }).saveQ().then(function() {
            var response = {
              send: function() {
                responseReceived.resolve(arguments);
              }
            };
            helper.serveReservedPath(request, response);
          }).then(function() {
            //we need to do a tick for the cookie parser it seems
            clock.tick(20);
          }).done();
        });
        it('should load the file from corrent path', function() {
          clock.tick(20000);
          return responseReceived.promise.then(function() {

            loadedFilePath.should.eql('Hoist/Scripts/getNewContacts');
          });
        });
        it('should trigger a job', function() {
          clock.tick(20000);
          return responseReceived.promise.then(function() {
            saved.should.eql(true);
          });
        });
        it('should return the job id', function() {
          clock.tick(20000);
          return responseReceived.promise.spread(function(code, response) {
            response.jobId.should.eql(savedJobData.id);
          });
        });
        after(function(done) {
          clock.restore();
          kue.singleton.create.restore();
          delete request.environment.getFile;
          hoist.models.FileIndex.remove({}, done);
        });
      });
      describe('and there is a file [with a different case] matching the path, and the script responds in less than 20s', function() {
        var responseReceived = q.defer();
        var loadedFilePath;
        var savedJobName;
       // var clock;
        var savedJobData;
        var saved;
        var responseText = '<html><body>hi</body></html>';
        before(function() {
          var jobid = require('uuid').v4();
          sinon.stub(helper, 'getId', function() {
            return jobid;
          });
          request.environment.getFile = function(filePath) {
            return q.fcall(function() {
              loadedFilePath = filePath;
              return 'file content';
            });
          };


          sinon.stub(kue.singleton, 'create', function(jobName, data) {
            savedJobData = data;
            savedJobName = jobName;
            return {
              save: function() {
                saved = true;
              }
            };
          });
          var redis = require('redis').createClient();
          setTimeout(function() {
            redis.publish('run:script:results:' + jobid, JSON.stringify({

              result: {
                status: 301,
                response: responseText
              }
            }));
          }, 1000);
          // clock = sinon.useFakeTimers();
          new hoist.models.FileIndex({
            application: request.application._id,
            environment: request.environment._id,
            files: [{
              path: 'Hoist/Scripts/getNewContacts'
            }]
          }).saveQ().then(function() {
            var response = {
              send: function() {
                responseReceived.resolve(arguments);
              }
            };
            return helper.serveReservedPath(request, response);
          }).then(function() {
            //clock.tick(1000);
          }).done();
        });
        it('should load the file from corrent path', function() {
          //clock.tick(10001);
          return responseReceived.promise.then(function() {

            loadedFilePath.should.eql('Hoist/Scripts/getNewContacts');
          });
        });
        it('should trigger a job', function() {
          //clock.tick(10001);
          return responseReceived.promise.then(function() {

            saved.should.eql(true);
          });
        });
        it('should return a 301 response', function() {
          //clock.tick(10001);
          return responseReceived.promise.spread(function(code) {

            code.should.eql(301);
          });
        });
        it('should return the job response', function() {
          //clock.tick(10001);
          return responseReceived.promise.spread(function(code, response) {
            response.should.eql(responseText);
          });
        });
        it('should pass the application id to the job', function() {
          return responseReceived.promise.then(function() {
            savedJobData.applicationId.should.eql(request.application._id);
          });
        });
        it('should pass the environment id to the job', function() {
          return responseReceived.promise.then(function() {
            savedJobData.environmentId.should.eql(request.environment._id);
          });
        });
        it('should pass the application subDomain to the job', function() {
          return responseReceived.promise.then(function() {
            savedJobData.applicationSubDomain.should.eql(request.application.subDomain);
          });
        });
        it('should pass the request url', function() {
           return responseReceived.promise.then(function() {
            savedJobData.request.url.should.eql(request.url);
          });
        });
        it('should pass the original user ip', function() {
           return responseReceived.promise.then(function() {
            savedJobData.request.ip.should.eql('ip-address');
          });
        });
        it('should pass the session id',function(){
          return responseReceived.promise.then(function(){
            savedJobData.sessionId.should.eql('dcSRCKkI0er4N4CkjxM0ogTC');
          });
        });
        after(function(done) {
          // clock.restore();
          helper.getId.restore();
          kue.singleton.create.restore();
          delete request.environment.getFile;
          hoist.models.FileIndex.remove({}, done);
        });
      });
    });
  });
});
