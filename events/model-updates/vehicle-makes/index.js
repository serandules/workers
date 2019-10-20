var log = require('logger')('events:model-update:vehicle-makes');

var utils = require('utils');
var Configs = require('model-configs');
var vutils = require('vehicle-utils');

exports.timeout = 60000;

exports.handle = function (ctx, done) {
  var data = ctx.data;
  var model = data.model;
  if (['vehicle-makes', 'vehicle-models'].indexOf(model) === -1) {
    return done();
  }
  var action = data.action;
  if (action === 'remove') {
    return utils.cache('configs:' + config.name, null, done);
  }
  if (['create', 'update', 'remove'].indexOf(action) === -1) {
    return done();
  }
  vutils.allMakes(function (err, makes) {
    Configs.findOneAndUpdate({name: 'vehicle-makes'}, {
      value: JSON.stringify(makes)
    }, {new: true}, function (err, config) {
      if (err) {
        return done(err);
      }
      if (!config) {
        return done();
      }
      config = utils.json(config);
      utils.notify('configs', config.id, 'update', {value: config.value}, done);
    });
  });
};
