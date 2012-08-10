var express = require('express');
var RSS = require('rss');
var http = require('http');
var _ = require('underscore');
var async = require('async');

var diffbotAPIKey = 'e6366ac27635f24e1f2ed901b950ed04';

app = express();
app.listen(4243);

app.get('/rss/secret::secret/u::username/network/', function (req, res) {
    var url = 'http://feeds.pinboard.in/json/secret:' + req.params.secret + '/u:' + req.params.username + '/network/';

    http.get(url, function(pinRes) {
        console.log('Status: ' + pinRes.statusCode);

        var body = '';

        pinRes.on('data', function(chunk) {
            body += chunk;
        });

        pinRes.on('end', function() {
           if (pinRes.statusCode != 200) {
               res.statusCode = pinRes.statusCode;
               res.contentType = pinRes.statusCode;
               res.send(body);
           } else {
               console.log('got data');
               var articles = JSON.parse(body);

               async.forEach(articles, function(article, next) {
                   var url = 'http://www.diffbot.com/api/article' +
                       '?token=' + diffbotAPIKey +
                       '&url=' + encodeURIComponent(article.u) +
                       '&html=true';

                   http.get(url, function(diffbotRes) {
                       var body = '';

                       if (diffbotRes.statusCode != 200) {
                           console.dir(diffbotRes);
                           next();
                           return;
                       }

                       diffbotRes.on('data', function(chunk) {
                           body += chunk;
                       });

                       diffbotRes.on('end', function() {
                           console.log('response from diffbot');
                           var diffbotArticle = JSON.parse(body);

                           article.full = diffbotArticle;

                           next();
                       });
                   });
               }, function(err) {

                   var feed = new RSS({
                       title: 'Pinboard – network items for ' + req.params.username,
                       description: 'bookmarks from your network',
                       feed_url: 'http://example.com/rss.xml',
                       site_url: 'http://pinboard.in/'
                   });

                   _.each(articles, function(article) {
                       console.dir(article);

                       var body = '<h1>' + (article.full.icon ? '<img src="' + article.full.icon + '">' : '') +
                           article.full.title + '</h1>' + article.full.html;

                       if (article.n) {
                           body = article.n + '<hr>' + body;
                       }

                       feed.item({
                           title:  article.d,
                           description: body,
                           url: article.u,
                           guid: article.u + '-' + article.a,
                           author: article.a,
                           date: article.dt
                       });
                   });

                   res.send(feed.xml());
               });
           }
        });
    });
});

