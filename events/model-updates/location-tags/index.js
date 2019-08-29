var log = require('logger')('events:model-update:location-tags');
var _ = require('lodash');
var async = require('async');

var mongoose = require('mongoose');

var utils = require('utils');

var Locations = require('model-locations');

var values = require('validators').values;

exports.timeout = 60000;

var findModel = function (model, done) {
  return done(null, mongoose.model(model));
};

var findObject = function (model, id, done) {
  model.findOne({_id: id}, function (err, o) {
    if (err) {
      return done(err);
    }
    done(null, utils.json(o));
  });
};

var findFields = function (model) {
  var schema = model.schema;
  var paths = schema.paths;
  var locations = [];
  Object.keys(paths).forEach(function (path) {
    var o = paths[path];
    var options = o.options;
    var ref = options.ref;
    if (!ref || ref !== 'locations') {
      return;
    }
    locations.push(path);
  });
  return locations;
};

var process = function (data, model, o, done) {
  var fields = {};
  o.forEach(function (oo) {
    fields[oo.field] = Locations.tagger.value;
  });
  findObject(model, data.id, function (err, o) {
    if (err) {
      return done(err);
    }
    if (!o) {
      return done();
    }
    values.tags(fields)({
      data: utils.json(o)
    }, function (err, tags) {
      if (err) {
        return done(err);
      }
      var pull = [];
      var tagsOld = o.tags;
      var fieldNames = Object.keys(fields);
      var numUpdatedFields = fieldNames.length;
      tagsOld.forEach(function (tag) {
        var name = tag.name;
        var i;
        var field;
        for (i = 0; i < numUpdatedFields; i++) {
          field = fieldNames[i];
          if (name.indexOf(field + ':locations:') !== 0) {
            continue;
          }
          pull.push(name);
          break;
        }
      });
      model.update({_id: data.id}, {
        $pull: {
          tags: {
            name: {
              $in: pull
            }
          }
        }
      }, function (err) {
        if (err) {
          return done(err);
        }
        model.update({_id: data.id}, {
          $push: {
            tags: tags
          }
        }, done);
      });
    });
  });
};

exports.handle = function (ctx, done) {
  var data = ctx.data;
  findModel(data.model, function (err, model) {
    if (err) {
      return done(err);
    }
    if (!model) {
      log.error('model:not-found', 'model:%s', data.model);
      return done();
    }
    var fields = findFields(model);
    var updated = data.updated;
    var o = [];
    fields.forEach(function (field) {
      if (!updated[field]) {
        return;
      }
      o.push({
        field: field,
        value: updated[field]
      });
    });
    if (!o.length) {
      return done();
    }
    process(data, model, o, function (err) {
      done(err);
    });
  });
};
