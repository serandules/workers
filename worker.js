var log = require('logger')('workers:worker');
var nconf = require('nconf').use('memory').argv().env();
var async = require('async');

var utils = require('utils');

var sqs = utils.sqs();

var event = nconf.get('EVENT');
var processor = nconf.get('PROCESSOR');
var concurrency = parseInt(nconf.get('CONCURRENCY'), 10);

var handler = require('./events/' + event + '/' + processor);

var DELAY = (handler.timeout / 1000);

var TIMEOUT_THRESHOLD = handler.timeout + 5000;

async.times(concurrency, function (n, timeDone) {
  console.log(event + '-' + n + '.fifo')
  sqs.getQueueUrl({
    QueueName: event + '-' + n + '.fifo'
  }, function (err, o) {
    if (err) {
      return timeDone(err);
    }
    async.whilst(function () {
      return true
    }, function (whilstDone) {
      var startedAt = Date.now();
      sqs.receiveMessage({
        QueueUrl: o.QueueUrl,
        MaxNumberOfMessages: 1,
        VisibilityTimeout: DELAY,
        WaitTimeSeconds: 0
      }, function (err, oo) {
        if (err) {
          return utils.delayed(5000, whilstDone, err);
        }
        if (!Array.isArray(oo.Messages)) {
          return utils.delayed(5000, whilstDone);
        }
        async.eachSeries(oo.Messages, function (message, eachDone) {
          var data;
          try {
            data = JSON.parse(message.Body);
          } catch (e) {
            log.error('message:errored', 'message:%s', message.Body, e);
            return eachDone();
          }
          process(data, function (err) {
            if (err) {
              log.error('process:errored', 'message:%j', data, err);
              return eachDone();
            }
            var endedAt = Date.now();
            if (endedAt - startedAt > TIMEOUT_THRESHOLD) {
              log.error('process:delayed', 'event:%s, processor:%s, concurrency:%s, message:%j', event, processor, concurrency, data);
              return eachDone();
            }
            sqs.deleteMessage({
              QueueUrl: o.QueueUrl,
              ReceiptHandle: message.ReceiptHandle
            }, eachDone);
          });
        }, whilstDone);
      })
    }, function (err) {
      if (err) {
        log.error('thread:errored', err);
        return setTimeout(timeDone, 5000);
      }
    });
  });
}, function (err) {
  if (err) {
    return log.error('worker:errored', err);
  }
});

var process = function (body, done) {
  handler.handle({
    data: body
  }, done);
};

log.info('worker:started', 'event:%s processor:%s concurrency:%s', event, processor, concurrency);
