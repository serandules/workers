var log = require('logger')('events:model-updates:vehicle-brands');

var sera = require('sera');
var utils = sera.utils;
var modelUtils = require('model-utils');
var brandUtils = modelUtils.brands;

exports.timeout = 60000;

exports.handle = function (ctx, done) {
  var data = ctx.data;
  var model = data.model;
  if (['brands', 'models'].indexOf(model) === -1) {
    return done();
  }
  var action = data.action;
  if (action === 'remove') {
    return utils.cache('configs:' + data.name, null, done);
  }
  if (['create', 'update', 'remove'].indexOf(action) === -1) {
    return done();
  }
  brandUtils.find('vehicles', function (err, brands) {
    sera.model('configs').findOneAndUpdate({name: 'brands-vehicles'}, {
      value: JSON.stringify(brands)
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
