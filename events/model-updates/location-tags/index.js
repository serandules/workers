var log = require('logger')('events:model-updates:location-tags');
var _ = require('lodash');
var async = require('async');

var sera = require('sera');
var utils = sera.utils;
var validators = sera.validators;
var values = validators.values;

exports.timeout = 60000;

var findModel = function (model, done) {
  try {
    return done(null, sera.model(model));
  } catch (e) {
    done();
  }
};

var findObject = function (model, id, done) {
  model.findOne({_id: id}, function (err, o) {
    if (err) {
      return done(err);
    }
    done(null, utils.json(o));
  });
};

var findLocationFields = function (model) {
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
  var tagger = sera.model('locations').tagger;
  o.forEach(function (oo) {
    fields[oo.field] = tagger;
  });
  findObject(model, data.id, function (err, o) {
    if (err) {
      return done(err);
    }
    if (!o) {
      return done();
    }
    values.tags({server: fields})({
      data: o
    }, function (err, tags) {
      if (err) {
        return done(err);
      }
      var toKey = function (tag) {
        return tag.group + ':' + tag.name;
      }
      var pull = [];
      var tagsNew = _.keyBy(tags, function (tag) {
        return toKey(tag);
      });
      var tagsOld = o.tags || [];
      tagsOld.forEach(function (tag) {
        if (!tag.server) {
          return;
        }
        if (!tagsNew[toKey(tag)]) {
          return;
        }
        pull.push(tag);
      });
      model.update({_id: data.id}, {
        $pull: {
          tags: pull
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

var locationUpdated = function (data, done) {
  var models = ['vehicles', 'realestates'];
  var pending = [];
  async.eachLimit(models, 10, function (name, eachDone) {
    findModel(name, function (err, model) {
      if (err) {
        return eachDone(err);
      }
      if (!model) {
        log.error('model:not-found', 'model:%s', data.model);
        return eachDone();
      }
      var fields = findLocationFields(model);
      var or = [];
      fields.forEach(function (field) {
        var q = {};
        q[field] = data.id;
        or.push(q);
      });
      var select = fields.join(' ');
      model.find({
        $or: or
      }).select(select).exec(function (err, modelz) {
        if (err) {
          return eachDone(err);
        }
        if (!modelz.length) {
          return eachDone();
        }
        modelz.forEach(function (o) {
          o = utils.json(o);
          var updated = {};
          var affected = false;
          fields.forEach(function (field) {
            if (o[field] === data.id) {
              updated[field] = data.id;
              affected = true;
            }
          });
          if (!affected) {
            return;
          }
          pending.push({
            model: model,
            id: o.id,
            updated: updated
          });
        });
        eachDone();
      });
    });
  }, function (err) {
    if (err) {
      return done(err);
    }
    async.eachLimit(pending, 10, function (entry, eachDone) {
      modelUpdated(entry.model, {
        id: entry.id,
        action: 'update',
        updated: entry.updated
      }, eachDone);
    }, done);
  });
};

var modelUpdated = function (model, data, done) {
  var fields = findLocationFields(model);
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
};

exports.handle = function (ctx, done) {
  var data = ctx.data;
  if (data.model === 'locations') {
    return locationUpdated(data, done);
  }
  findModel(data.model, function (err, model) {
    if (err) {
      return done(err);
    }
    if (!model) {
      log.error('model:not-found', 'model:%s', data.model);
      return done();
    }
    modelUpdated(model, data, done);
  });
};
