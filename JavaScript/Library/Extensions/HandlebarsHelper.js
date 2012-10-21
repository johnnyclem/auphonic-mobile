var User = require('Store/User');

var Handlebars = require('Handlebars');

Handlebars.registerHelper('format-url', function(url) {
  return new Handlebars.SafeString(url.replace(/https?\:\/\//, '').replace(/\/$/, ''));
});

// Used for cache invalidation
var time = Date.now();
Handlebars.registerHelper('image', function(url) {
  if (!url) return 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

  var now = Date.now();
  if (now - 60000 > time) time = now;

  return new Handlebars.SafeString(url + (~url.indexOf('?') ? '&' : '?') + time + User.getToken('&bearer_token='));
});
