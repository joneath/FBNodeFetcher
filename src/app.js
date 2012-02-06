var http = require('http'),
    url = require("url"),
    journey = require('journey'),
    FBNodeFetcher = require("../src/fb_node_fetcher");

(function() {
  var router = new(journey.Router);
  var fbFetcher = new FBNodeFetcher();

  router.map(function () {
    router.post('/fetch').bind(function (req, res, data) {
      if (data.nodes) {
        fbFetcher.fetch(data.nodes, data.callbackUrl);
      }
      res.send("");
    });

    router.post('/ratchet').bind(function (req, res, data) {
      fbFetcher.ratchet(data);
      res.send("");
    });
  });

  http.createServer(function (request, response) {
    var body = "";

    request.addListener('data', function (chunk) { body += chunk; });
    request.addListener('end', function () {
      router.handle(request, body, function (result) {
        response.writeHead(result.status, result.headers);
        response.end(result.body);
      });
    });
  }).listen(1337, "127.0.0.1");
}).call(this);
