'use strict';
require('heapdump');

process.env['NODE_ENV'] = process.env['NODE_ENV'] || 'local';

console.log(process.env['NODE_ENV']);

var config = require('config');


var app = require('./app');

app.listen(config.port, function() {
    console.log('winch listening at ', config.port);
});
