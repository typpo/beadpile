var express = require('express')
  , _ = require('underscore')
  , app = express.createServer()
  , rutil = require('./redis.js')

// Express config
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(express.cookieParser());
app.use(express.favicon(__dirname + '/public/favicon.ico'));
app.use(express.static(__dirname + '/public'));
app.use(express.bodyParser());
var RedisStore = require('connect-redis')(express);
app.use(express.session({secret: "barkbark. barkbarkbark", store: new RedisStore}));

// App
app.get('/', function(req, res) {
  req.session.cookie.expires = false; // don't kill cookie after restarting browser
  req.session.cookie.maxAge = 31 * 24 * 60 * 60 * 1000 * 12 * 5; // 5 yrs

  if (!req.session.anonid)
    req.session.anonid = Math.floor(Math.random() * 1000);

  if (!req.session.beads) req.session.beads = 0;
  var redis = rutil.getConnection();
  redis.get('beadpile:pile:beads', function(err, num) {
    redis.zrevrange('beadpile:beaders', 0, -1, 'withscores', function(err, result) {
      beaders = [];
      var idx = 0;
      for (var i=0; i < result.length; i++) {
        if (i==0 || i%2 == 0) {
          beaders[idx] = [result[i], 0];
        }
        else {
          beaders[idx][1] = result[i];
          idx++;
        }
      }
      res.render('index', {
        total_beads: num,
        your_beads: req.session.beads,
        beaders: beaders,
        name: req.session.anonid,
      });
    });
  });
});

app.get('/add20', function(req, res) {
  var redis = rutil.getConnection();
  for (var i=0; i < 20; i++)
    redis.incr('beadpile:pile:beads')
  setTimeout(function() {
    res.redirect('/beadpile')
  }, 1000);
});

app.get('/take', function(req, res) {
  var redis = rutil.getConnection();
  redis.get('beadpile:pile:beads', function(err, num) {
    if (parseInt(num) < 1) {
      res.send("wait for more beads :(.  <a href="/">home</a>");
      return;
    }
    redis.decr('beadpile:pile:beads');
    req.session.beads++;
    redis.zadd('beadpile:beaders', req.session.beads, req.session.anonid);
    setTimeout(function() {
      res.redirect('/beadpile')
    }, 1000);
  });
});
app.get('/give', function(req, res) {
  var redis = rutil.getConnection();
  redis.incr('beadpile:pile:beads');
  if (req.session.beads < 1) {
    res.send("you don't have any beads.  <a href="/">home</a>");
    return;
  }
  req.session.beads--;
  redis.zadd('beadpile:beaders', req.session.beads, req.session.anonid);
  setTimeout(function() {
    res.redirect('/beadpile')
  }, 1000);
});

var port = process.env.PORT || 4348;
app.listen(port);

console.log('Started listening on port ' + port);
