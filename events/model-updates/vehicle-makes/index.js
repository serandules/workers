var log = require('logger')('events:model-update:vehicle-makes');

var sera = require('sera');
var utils = sera.utils;
var vehicleUtils = require('vehicle-utils');

exports.timeout = 60000;

exports.handle = function (ctx, done) {
  var data = ctx.data;
  var model = data.model;
  if (['vehicle-makes', 'vehicle-models'].indexOf(model) === -1) {
    return done();
  }
  var action = data.action;
  if (action === 'remove') {
    return utils.cache('configs:' + data.name, null, done);
  }
  if (['create', 'update', 'remove'].indexOf(action) === -1) {
    return done();
  }
  vehicleUtils.allMakes(function (err, makes) {
    sera.model('configs').findOneAndUpdate({name: 'vehicle-makes'}, {
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
