var express = require('express');
var RSS = require('rss');
var http = require('http');
var _ = require('underscore');

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

               var feed = new RSS({
                   title: 'Pinboard – network items for ' + req.params.username,
                   description: 'bookmarks from your network',
                   feed_url: 'http://example.com/rss.xml',
                   site_url: 'http://pinboard.in/'
               });

               _.each(articles, function(article) {
                   console.dir(article);

                   feed.item({
                       title:  article.d,
                       description: article.d,
                       url: article.u,
                       guid: article.u + '-' + article.a,
                       author: article.a,
                       date: article.dt
                   });
               });

               res.send(feed.xml());
           }
        });
    });
});

