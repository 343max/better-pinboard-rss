var express = require('express');
var RSS = require('rss');
var http = require('http');
var _ = require('underscore');
var async = require('async');
var mongoose = require('mongoose');

var diffbotAPIKey = 'e6366ac27635f24e1f2ed901b950ed04';

mongoose.connect('mongodb://localhost/better-pinboard-rss');
app = express();
app.listen(4243);

app.configure(function() {
    app.use(express.logger());
});


app.configure('development', function() {
    app.use(express.errorHandler( { dumpExceptions: true, showStack: true} ));
});

var diffbotArticleShema = new mongoose.Schema({
    url: { type: String, required: true, unique: true},
    created: { type: Date, default: Date.now },
    icon: String,
    title: String,
    html: String
});

diffbotArticleShema.statics.findByURL = function(url, next) {
    this.model('DiffbotArticle').findOne({ url: url }, function(err, article) {
        next(err, article);
    });
}

var DiffbotArticle = mongoose.model('DiffbotArticle', diffbotArticleShema);

app.get('/rss/secret::secret/u::username/network/', function (req, res) {
    var url = 'http://feeds.pinboard.in/json/secret:' + req.params.secret + '/u:' + req.params.username + '/network/';

    http.get(url, function(pinRes) {
        console.log('Status: ' + pinRes.statusCode);
        if (pinRes.headers.etag) {
            res.set('ETag', pinRes.headers.etag);
        }

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
                    DiffbotArticle.findByURL(article.u, function(err, savedArticle) {
                        if (savedArticle) {
                            console.log('article from cache');
                            article.full = savedArticle;
                            next();
                        } else {
                            console.log('loading article');
                            var url = 'http://www.diffbot.com/api/article' +
                                '?token=' + diffbotAPIKey +
                                '&url=' + encodeURIComponent(article.u) +
                                '&html=true';

                            http.get(url, function(diffbotRes) {
                                var body = '';

                                if (diffbotRes.statusCode != 200) {
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

                                    var savedArticle = new DiffbotArticle({
                                        url: diffbotArticle.url,
                                        icon: diffbotArticle.icon,
                                        title: diffbotArticle.title,
                                        html: diffbotArticle.html
                                    });
                                    savedArticle.save();
                                });
                            });
                        }
                    });


               }, function(err) {
                   var feed = new RSS({
                       title: 'Pinboard – network items for ' + req.params.username,
                       description: 'bookmarks from your network',
                       feed_url: 'http://' + req.headers.host + req.url,
                       site_url: 'http://pinboard.in/'
                   });

                   _.each(articles, function(article) {
//                       console.dir(article);

                       var body = '<h1>' + (article.full.icon ? '<img width="16" height="16" src="' + article.full.icon + '">' : '') +
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

                   res.set('Content-Type', 'application/rss+xml');
                   res.send(feed.xml());
               });
           }
        });
    });
});

