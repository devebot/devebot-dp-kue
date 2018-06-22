'use strict';

var events = require('events');
var util = require('util');
var lodash = Devebot.require('lodash');
var Jobdapter = require('./jobdapter');

var JobqueueCommon = function(params) {
  params = params || {};

  var self = this;
  var sandboxName = params.sandboxName;
  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  LX.has('conlog') && LX.log('conlog', LT.add({
    sandboxName: sandboxName
  }).toMessage({
    tags: [ 'constructor-begin' ],
    text: ' + constructor start in sandbox <{sandboxName}>'
  }));

  var jqCfg = params.sandboxConfig || {};

  Object.defineProperty(self, 'enabled', {
    get: function() { return jqCfg.enabled !== false; },
    set: function(value) {}
  });

  if (self.enabled) {
    var redis_conf = jqCfg.config || { host: '127.0.0.1', port: 6379, name: 'devebotjq' };
    LX.has('conlog') && LX.log('conlog', LT.add({
      sandboxName: sandboxName,
      redisConfig: util.inspect(redis_conf)
    }).toMessage({
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
      sandboxName: sandboxName
    }).toMessage({
      text: ' - jobqueue in sandbox <{sandboxName}> is disabled'
    }));
  }

  var jobQueueOfRoutine = jqCfg.mappings || {};

  self.getJobQueueMappings = function() {
    return jobQueueOfRoutine;
  };

  self.getJobQueueOfRoutine = function(name) {
    var event = (jobQueueOfRoutine[name] ? jobQueueOfRoutine[name] : 'jobqueue-global');
    return event + '-' + sandboxName;
  };

  LX.has('conlog') && LX.log('conlog', LT.toMessage({
    tags: [ 'constructor-end' ],
    text: ' - constructor has finished'
  }));
};

module.exports = JobqueueCommon;
