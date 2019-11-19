var log = require('logger')('workers:worker');
var nconf = require('nconf').use('memory').argv().env();
var mongoose = require('mongoose');
var async = require('async');
var fs = require('fs');
var path = require('path');
var utils = require('utils');

var env = utils.env();

nconf.defaults(require('./env/' + env + '.json'));

var commons = require('./commons');

var sqs = utils.sqs();

var event = nconf.get('EVENT');
var concurrentProcessors = parseInt(nconf.get('CONCURRENT_PROCESSORS'), 10);

var mongourl = nconf.get('MONGODB_URI');

var ssl = !!nconf.get('MONGODB_SSL');

var models = commons.models();

mongoose.connect(mongourl, {
  authSource: 'admin',
  ssl: ssl
});

var db = mongoose.connection;

db.on('error', function (err) {
  log.error('db:errored', err);
});

db.once('open', function () {
  log.info('db:opened');

  commons.load(models);

  fs.readdir(path.join('events', event), function (err, processors) {
    if (err) {
      return log.error('processors:errored', err);
    }

    var handlers = [];

    var visibilityTimeout = 0;

    processors.forEach(function (processor) {
      var handler = require('./events/' + event + '/' + processor);
      if (handler.timeout > visibilityTimeout) {
        visibilityTimeout = handler.timeout;
      }
      handlers.push({
        handle: handler.handle
      });
    });

    var TIMEOUT_THRESHOLD = visibilityTimeout - 5000;

    visibilityTimeout = Math.floor(visibilityTimeout / 1000);

    async.each(processors, function (processor, eachDone) {

      async.times(concurrentProcessors, function (n, queueDone) {
        sqs.getQueueUrl({
          QueueName: utils.queue(event) + '.fifo'
        }, function (err, o) {
          if (err) {
            return queueDone(err);
          }
          async.whilst(function () {
            return true
          }, function (whilstDone) {
            var startedAt = Date.now();
            sqs.receiveMessage({
              QueueUrl: o.QueueUrl,
              MaxNumberOfMessages: 1,
              VisibilityTimeout: visibilityTimeout,
              WaitTimeSeconds: 0
            }, function (err, oo) {
              if (err) {
                log.error('receive:errored', 'message:%s', err.message, err);
                return utils.delayed(5000, whilstDone);
              }
              if (!Array.isArray(oo.Messages)) {
                return utils.delayed(5000, whilstDone);
              }
              async.eachSeries(oo.Messages, function (message, processed) {
                var data;
                try {
                  data = JSON.parse(message.Body);
                } catch (e) {
                  log.error('message:errored', 'message:%s', message.Body, e);
                  return processed();
                }
                async.each(handlers, function (handler, handled) {
                  handler.handle({
                    data: data
                  }, handled);
                }, function (err) {
                  if (err) {
                    log.error('process:errored', 'message:%j', data, err);
                    return processed();
                  }
                  var endedAt = Date.now();
                  if (endedAt - startedAt > TIMEOUT_THRESHOLD) {
                    log.error('process:delayed', 'event:%s, processor:%s, concurrency:%s, message:%j', event, processor, concurrentProcessors, data);
                    return processed();
                  }
                  sqs.deleteMessage({
                    QueueUrl: o.QueueUrl,
                    ReceiptHandle: message.ReceiptHandle
                  }, function (err) {
                    if (err) {
                      log.error('delete:errored', 'message:%s', err.message, err);
                      return utils.delayed(5000, processed);
                    }
                    processed();
                  });
                });
              }, whilstDone);
            });
          }, queueDone);
        });
      }, eachDone);
    }, function (err) {
      if (err) {
        log.error('worker:errored', err);
      }
    });
  });

  log.info('worker:started', 'event:%s processor:%s concurrency:%s', event, concurrentProcessors);
});
