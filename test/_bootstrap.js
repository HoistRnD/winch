'use strict';
var chai = require("chai"),
	chaiAsPromised = require("chai-as-promised");



chai.use(chaiAsPromised);
chai.should();

process.env['NODE_ENV'] = 'test';

require('hoist-core').init();

var fs = require('fs');
var Glob = require("glob").Glob;
var match = new Glob("./test/*/*.js", {
	sync: true
});


match.found.forEach(function(file) {
	console.log("requiring ", file);
	require(fs.realpathSync(file));
});
