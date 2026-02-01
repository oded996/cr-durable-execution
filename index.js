try {
  console.log('Loading durableEventFunction...');
  const { durableEventFunction } = require('./dist/examples/workflow');
  exports.durableEventFunction = durableEventFunction;
  console.log('durableEventFunction loaded successfully');
} catch (err) {
  console.error('Failed to load durableEventFunction:', err);
  throw err;
}
