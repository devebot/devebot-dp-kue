'use strict';

var events = require('events');
var util = require('util');
var lodash = Devebot.require('lodash');
var Jobdapter = require('./jobdapter');

var Service = function(params) {
  var self = this;
  params = params || {};

  var getSandboxName = function() {
    return params.sandboxName;
  };

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: getSandboxName()
  }).stringify({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var jqCfg = lodash.get(params, ['profileConfig', 'devebot', 'jobqueue'], {});

  Object.defineProperty(self, 'enabled', {
    get: function() { return jqCfg.enabled !== false; },
    set: function(value) {}
  });

  if (self.enabled) {
    var engine_hash = {};
    var engine_name = jqCfg.default || 'redis';
    var engine_list = jqCfg.engines || [];
    lodash.forEach(engine_list, function(engine_item) {
      engine_hash[engine_item.name] = engine_item.config;
    });
    var redis_conf = engine_hash[engine_name] || { host: '127.0.0.1', port: 6379, name: 'devebotjq' };
    LX.has('conlog') && LX.log('conlog', LT.add({
      sandboxName: getSandboxName(),
      redisConfig: util.inspect(redis_conf)
    }).stringify({
      text: ' - jobqueue in <{sandboxName}> with redis config: {redisConfig}'
    }));

    var jobdapter = new Jobdapter({ redis: redis_conf });
    lodash.assign(this, lodash.mapValues(lodash.pick(jobdapter, [
      'getJobQueue', 'getServiceInfo', 'getServiceHelp'
    ]), function(item) {
      return item.bind(jobdapter);
    }));
  } else {
    LX.has('conlog') && LX.log('conlog', LT.add({
      sandboxName: getSandboxName()
    }).stringify({
      text: ' - jobqueue in sandbox <{sandboxName}> is disabled'
    }));
  }

  var jobQueueOfRoutine = jqCfg.mappings || {};

  self.getJobQueueMappings = function() {
    return jobQueueOfRoutine;
  };

  self.getJobQueueOfRoutine = function(name) {
    var event = (jobQueueOfRoutine[name] ? jobQueueOfRoutine[name] : 'jobqueue-global');
    return event + '-' + getSandboxName();
  };

  LX.has('conlog') && LX.log('conlog', LT.stringify({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

module.exports = Service;
