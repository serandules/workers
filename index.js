var log = require('logger')('workers');
var nconf = require('nconf').use('memory').argv().env();
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var utils = require('utils');

var env = utils.env();

nconf.defaults(require('./env/' + env + '.json'));

var findConcurrency = function (event, processor) {
  var concurrency = nconf.get('CONCURRENCY_' + event + '_' + processor);
  if (concurrency) {
    return parseInt(concurrency, 10);
  }
  concurrency = nconf.get('CONCURRENCY_' + event);
  if (concurrency) {
    return parseInt(concurrency, 10);
  }
  return 1;
};

var spawn = function (event, processor, concurrency) {
  var worker = childProcess.fork('worker.js', process.argv.slice(2), {
    env: {
      EVENT: event,
      PROCESSOR: processor,
      CONCURRENCY: concurrency
    }
  });
  worker.on('error', function (err) {
    log.error('worker:errored', err);
  });
  worker.on('exit', function (code, signal) {
    log.error('worker:exit', 'code:%s, signal:%s', code, signal);
    setTimeout(function () {
      spawn(event, processor, concurrency);
    }, 5000);
  });
  log.info('worker:queued', 'event:%s processor:%s concurrency:%s', event, processor, concurrency);
};

var initialize = function (done) {
  fs.readdir('events', function (err, events) {
    if (err) {
      return done(err);
    }
    events.forEach(function (event) {
      var processor = path.join(__dirname, 'events', event);
      fs.readdir(processor, function (err, processors) {
        if (err) {
          return done(err);
        }
        processors.forEach(function (processor) {
          spawn(event, processor, findConcurrency(event, processor));
        });
      });
    });
  });
};

initialize(function (err) {
  if (err) {
    return log.error(err);
  }
});
