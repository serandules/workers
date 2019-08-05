var log = require('logger')('events:model-update:location-tags');

exports.timeout = 60000;

exports.handle = function (ctx, done) {
  console.log(ctx);
  done();
};
