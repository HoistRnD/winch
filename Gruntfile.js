'use strict';
var request = require('request');
module.exports = function(grunt) {
  require('time-grunt')(grunt);
  require('load-grunt-tasks')(grunt);
  var reloadPort = 35729,
    files;
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    develop: {
      server: {
        file: 'server.js',
        env: {
          NODE_ENV: 'development'
        }
      }
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      others: {
        src: ['Gruntfile.js', 'app.js', 'server.js', 'config/*.js']
      },
      lib: {
        src: ['app/**/*.js']
      },
      test: {
        src: ['test/**/*.js']
      },
    },
    watch: {
      options: {
        livereload: reloadPort
      },
      test: {
        files: ['<%= jshint.test.src %>'],
        tasks: ['jshint:test', 'mochaTest']
      },
      lib: {
        files: ['<%= jshint.lib.src %>'],
        tasks: ['jshint:lib', 'mochaTest', 'develop', 'delayed-livereload']
      },
      others: {
        files: ['<%= jshint.others.src %>'],
        tasks: ['jshint:others', 'mochaTest', 'develop']
      }
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          require: 'coverage/blanket',
          ui: 'bdd',
          growl: true
        },
        src: ['test/_bootstrap.js']
      },
      'html-cov': {
        options: {
          reporter: 'html-cov',
          // use the quiet flag to suppress the mocha console output
          quiet: true,
          captureFile: 'coverage-out/coverage.html'
        },
        src: ['<%= jshint.test.src %>'],
      },
      'travis-cov': {
        options: {
          reporter: 'travis-cov'
        },
        src: ['<%= jshint.test.src %>']
      }
    },

  });

  grunt.config.requires('watch.lib.files');
  files = grunt.config('watch.lib.files');
  files = grunt.file.expand(files);

  grunt.registerTask('delayed-livereload', 'Live reload after the node server has restarted.', function() {
    var done = this.async();
    setTimeout(function() {
      request.get('http://localhost:' + reloadPort + '/changed?files=' + files.join(','), function(err, res) {
        var reloaded = !err && res.statusCode === 200;
        if (reloaded) {
          grunt.log.ok('Delayed live reload successful.');
        } else {
          grunt.log.error('Unable to make a delayed live reload.');
        }
        done(reloaded);
      });
    }, 500);
  });
  grunt.registerTask('test', ['jshint', 'mochaTest']);
  grunt.registerTask('default', ['jshint', 'mochaTest', 'develop', 'watch']);
};