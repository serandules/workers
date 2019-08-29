exports.models = function () {
  var key;
  var name;
  var o = [];
  var type = 'model';
  var prefix = type.toUpperCase() + '_';
  var all = nconf.get();
  for (key in all) {
    if (!all.hasOwnProperty(key)) {
      continue;
    }
    if (key.indexOf(prefix) !== 0) {
      continue;
    }
    name = key.substring(prefix.length);
    name = name.toLowerCase().replace('_', '-');
    var value = all[key];
    o.push({
      type: 'model',
      name: type + '-' + name,
      version: value
    });
  }
  return o;
};

exports.load = function (modules) {
  modules.forEach(function (module) {
    require(module.name);
  });
};
