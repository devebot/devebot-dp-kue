module.exports = {
  plugins: {
    kue: {
      config: {
        host: '127.0.0.1',
        port: 6379,
        name: 'devebot-dp-kue'
      }
    }
  }
};
