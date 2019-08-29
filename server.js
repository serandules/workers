var nconf = require('nconf').use('memory').argv().env();
var log = require('logger')('workers:server');

var workers = require('./index');

workers.start(function (err) {
  if (err) {
    return log.error('workers:errored', err);
  }
});
