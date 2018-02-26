module.exports = {
  devebot: {
    jobqueue: {
      enabled: true,
      pluginId: 'devebot-dp-kue',
      default: 'redis',
      engines: [
        {
          name: 'redis',
          config: {
            host: '127.0.0.1',
            port: 6379,
            name: 'devebotjq'
          }
        }
      ]
    }
  },
  newFeatures: {
    devebotDpKue: {
      logoliteEnabled: true,
      sandboxConfig: true
    }
  }
}