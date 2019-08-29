var log = require('logger')('workers:install');
var nconf = require('nconf').argv().env();

var utils = require('utils');

var env = utils.env();

nconf.defaults(require('./env/' + env + '.json'));

var worker = require('./index');

worker.install(function (err, modules) {
    if (err) {
        log.error('modules:errored', err);
        throw err;
    }
    log.info('modules:installed');
});
