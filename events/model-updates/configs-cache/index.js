var log = require('logger')('events:model-update:vehicle-makes');

var utils = require('utils');
var Configs = require('model-configs');

exports.timeout = 60000;

exports.handle = function (ctx, done) {
  var data = ctx.data;
  var model = data.model;
  if (model !== 'configs') {
    return done();
  }
  var action = data.action;
  if (action === 'remove') {
    return utils.cache('configs:' + config.name, null, done);
  }
  if (action !== 'create' && action !== 'update') {
    return done();
  }
  Configs.findOne({_id: data.id}, function (err, config) {
    if (err) {
      return done(err);
    }
    if (!config) {
      return done();
    }
    config = utils.json(config);
    utils.group('public', function (err, pub) {
      if (err) {
        return done(err);
      }
      utils.group('anonymous', function (err, anon) {
        if (err) {
          return done(err);
        }
        var permitted = utils.permitted({groups: [pub.id, anon.id]}, config, 'read');
        if (!permitted) {
          return done();
        }
        utils.cache('configs:' + config.name, JSON.stringify({id: config.id, value: config.value}), done);
      });
    });
  });
};
