var log = require('logger')('workers');
var nconf = require('nconf').use('memory').argv().env();
var _ = require('lodash');
var fs = require('fs');
var express = require('express');
var async = require('async');
var childProcess = require('child_process');

var utils = require('utils');

var env = utils.env();

nconf.defaults(require('./env/' + env + '.json'));

var port = nconf.get('PORT');

var spawn = function (event, processorsPerFork, done) {
  var workerEnv = _.clone(nconf.get());
  workerEnv.EVENT = event;
  workerEnv.CONCURRENT_PROCESSORS = processorsPerFork;
  var worker = childProcess.fork('worker.js', process.argv.slice(2), {
    env: workerEnv
  });
  worker.on('error', function (err) {
    log.error('worker:errored', err);
  });
  worker.on('exit', function (code, signal) {
    log.error('worker:exit', 'code:%s, signal:%s', code, signal);
    setTimeout(function () {
      spawn(event, processorsPerFork, done);
    }, 5000);
  });
  log.info('worker:queued', 'event:%s processorsPerFork:%s', event, processorsPerFork);
  done();
};

var findEnv = function (prefix, name) {
  return parseInt(nconf.get(prefix + name.toUpperCase().replace(/-/g, '_')) || '1', 10);
};

var initialize = function (done) {

  var apps = express();

  apps.get('/status', function (req, res) {
    res.json({
      status: 'healthy'
    });
  });

  apps.listen(port, function (err) {
    if (err) {
      return done(err);
    }
    fs.readdir('events', function (err, events) {
      if (err) {
        return done(err);
      }
      async.each(events, function (event, eachDone) {
        var forksPerQueue = findEnv('EVENT_CONCURRENCY_', event);
        var processorsPerFork = findEnv('FORK_CONCURRENCY_', event);
        async.times(forksPerQueue, function (n, timesDone) {
          spawn(event, processorsPerFork, timesDone);
        }, eachDone);
      }, done);
    });
  });
};

initialize(function (err) {
  if (err) {
    return log.error(err);
  }
  log.info('server:started', 'port:%s', port);
});
